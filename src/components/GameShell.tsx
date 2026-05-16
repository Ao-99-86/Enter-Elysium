"use client";

import dynamic from "next/dynamic";
import { Chess, type Square } from "chess.js";
import {
  Bot,
  ChevronDown,
  Clipboard,
  DoorOpen,
  Gamepad2,
  LogIn,
  MousePointer2,
  Plus,
  RotateCw,
  Smartphone,
  Volume2,
  VolumeX
} from "lucide-react";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import type { PlayerColor, PublicRoom, RoomMode } from "@/lib/rooms/types";

const ElysiumScene = dynamic(
  () => import("./ElysiumScene").then((module) => module.ElysiumScene),
  {
    ssr: false,
    loading: () => <div className="scene-fallback">Loading board</div>
  }
);

type Session = {
  roomId: string;
  playerToken: string;
  color: PlayerColor;
  mode?: RoomMode;
};

type RoomActionResponse = {
  roomId: string;
  playerToken: string;
  color: PlayerColor;
  room: PublicRoom;
};

type BusyAction = "create" | "solo" | "join" | "move" | "refresh" | null;

const SESSION_KEY = "enter-elysium-session";
const INVERSION_TURN_SPAN = 3;
const FIRST_INVERSION_MIN_DELAY = 4;
const FIRST_INVERSION_DELAY_SPREAD = 4;
const INVERSION_MIN_DELAY = 7;
const INVERSION_DELAY_SPREAD = 5;

function hashString(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function deterministicMoveDelay(
  roomId: string,
  episode: number,
  minimum: number,
  spread: number
): number {
  return minimum + (hashString(`${roomId}:${episode}`) % (spread + 1));
}

function isBoardInversionActive(room: PublicRoom | null): boolean {
  if (!room || room.status !== "active") {
    return false;
  }

  const moveCount = room.moves.length;
  let episode = 0;
  let triggerMoveCount = deterministicMoveDelay(
    room.id,
    episode,
    FIRST_INVERSION_MIN_DELAY,
    FIRST_INVERSION_DELAY_SPREAD
  );

  while (moveCount >= triggerMoveCount + INVERSION_TURN_SPAN) {
    episode += 1;
    triggerMoveCount +=
      INVERSION_TURN_SPAN +
      deterministicMoveDelay(
        room.id,
        episode,
        INVERSION_MIN_DELAY,
        INVERSION_DELAY_SPREAD
      );
  }

  return moveCount >= triggerMoveCount;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    cache: "no-store",
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers
    }
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    throw new Error(payload?.error?.message ?? "Request failed.");
  }

  return (await response.json()) as T;
}

function normalizeRoomCode(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

function saveSession(session: Session): void {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  window.history.replaceState(null, "", `/?room=${session.roomId}`);
}

function clearStoredSession(): void {
  window.localStorage.removeItem(SESSION_KEY);
  window.history.replaceState(null, "", "/");
}

function loadSession(): Session | null {
  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as Session;
  } catch {
    clearStoredSession();
    return null;
  }
}

function statusText(room: PublicRoom | null, playerColor?: PlayerColor): string {
  if (!room) {
    return "Start a solo game, create a room, or join by code.";
  }

  if (room.status === "waiting") {
    return `Room ${room.id} is waiting for black.`;
  }

  if (room.status === "over") {
    if (room.mode === "single-player" && room.winner) {
      return room.winner === playerColor
        ? "Checkmate. You win."
        : "Checkmate. Elysium AI wins.";
    }

    if (room.result === "checkmate" && room.winner) {
      return `Checkmate. ${room.winner === "white" ? "White" : "Black"} wins.`;
    }

    return `Game over by ${room.result ?? "draw"}.`;
  }

  if (room.mode === "single-player") {
    if (room.turn === playerColor) {
      return "Your move. Tap a piece, then a highlighted square.";
    }

    return "Elysium AI to move.";
  }

  const turn = room.turn === "white" ? "White" : "Black";
  const marker = playerColor === room.turn ? " Your move." : "";
  return `${turn} to move.${marker}`;
}

function statusClass(room: PublicRoom | null): string {
  if (!room) {
    return "";
  }

  if (room.status === "over") {
    return "over";
  }

  if (room.status === "active") {
    return "active";
  }

  return "";
}

function isOwnPiece(room: PublicRoom, square: Square, playerColor?: PlayerColor): boolean {
  if (!playerColor) {
    return false;
  }

  const chess = new Chess(room.fen);
  const piece = chess.get(square);
  return Boolean(piece && piece.color === (playerColor === "white" ? "w" : "b"));
}

function MoveList({ moves }: { moves: PublicRoom["moves"] }) {
  const rows = [];
  for (let index = 0; index < moves.length; index += 2) {
    rows.push({
      moveNumber: index / 2 + 1,
      white: moves[index],
      black: moves[index + 1]
    });
  }

  if (rows.length === 0) {
    return <div className="empty-moves">No moves yet</div>;
  }

  return rows.slice(-16).map((row) => (
    <div className="move-row" key={row.moveNumber}>
      <span>{row.moveNumber}.</span>
      <strong>{row.white?.san ?? ""}</strong>
      <strong>{row.black?.san ?? ""}</strong>
    </div>
  ));
}

function AudioControl({
  onIntensity
}: {
  onIntensity: (value: number) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const frameRef = useRef<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.65);
  const [audioError, setAudioError] = useState<string | null>(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    if (!isPlaying || !analyserRef.current) {
      onIntensity(0);
      return undefined;
    }

    const analyser = analyserRef.current;
    const data = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteFrequencyData(data);
      const sum = data.reduce((total, value) => total + value, 0);
      onIntensity(sum / data.length / 255);
      frameRef.current = window.requestAnimationFrame(tick);
    };

    tick();

    return () => {
      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, [isPlaying, onIntensity]);

  const ensureAudioGraph = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) {
      return null;
    }

    if (!contextRef.current) {
      const AudioContextCtor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;

      if (!AudioContextCtor) {
        setAudioError("Web Audio is unavailable.");
        return null;
      }

      contextRef.current = new AudioContextCtor();
      analyserRef.current = contextRef.current.createAnalyser();
      analyserRef.current.fftSize = 128;
    }

    if (!sourceRef.current && analyserRef.current && contextRef.current) {
      sourceRef.current = contextRef.current.createMediaElementSource(audio);
      sourceRef.current.connect(analyserRef.current);
      analyserRef.current.connect(contextRef.current.destination);
    }

    return contextRef.current;
  }, []);

  const toggle = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    const context = ensureAudioGraph();
    if (!context) {
      return;
    }

    try {
      await context.resume();
      await audio.play();
      setAudioError(null);
      setIsPlaying(true);
    } catch {
      setAudioError("Audio could not start.");
      setIsPlaying(false);
    }
  }, [ensureAudioGraph, isPlaying]);

  return (
    <div className="audio-panel">
      <audio
        ref={audioRef}
        loop
        preload="metadata"
        src="/audio/entering-elysium.mp3"
      />
      <div className="audio-top">
        <span className="kicker">Sound</span>
        <button
          className="icon-button"
          onClick={toggle}
          title={isPlaying ? "Pause audio" : "Play audio"}
          type="button"
        >
          {isPlaying ? <VolumeX size={18} /> : <Volume2 size={18} />}
          {isPlaying ? "Pause" : "Play"}
        </button>
      </div>
      <label className="volume-row">
        <Volume2 size={18} />
        <input
          aria-label="Volume"
          max="1"
          min="0"
          onChange={(event) => setVolume(Number(event.target.value))}
          step="0.01"
          type="range"
          value={volume}
        />
      </label>
      {audioError ? <div className="error-text">{audioError}</div> : null}
    </div>
  );
}

function ControlsGuide() {
  return (
    <details className="controls-guide">
      <summary>
        <span>
          <Gamepad2 size={18} />
          Controls
        </span>
        <ChevronDown size={18} />
      </summary>
      <div className="guide-items">
        <div className="guide-item">
          <MousePointer2 size={18} />
          <span>Tap one of your pieces to select it, then tap a green square to move.</span>
        </div>
        <div className="guide-item">
          <Smartphone size={18} />
          <span>Drag the board to rotate the view. Pinch or scroll to zoom.</span>
        </div>
        <div className="guide-item">
          <Bot size={18} />
          <span>In Solo vs AI, the AI answers automatically after your move.</span>
        </div>
      </div>
    </details>
  );
}

export function GameShell() {
  const [room, setRoom] = useState<PublicRoom | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioIntensity, setAudioIntensity] = useState(0);

  const playerColor = room?.playerColor ?? session?.color;
  const boardInverted = useMemo(() => isBoardInversionActive(room), [room]);

  useEffect(() => {
    const queryRoom = new URLSearchParams(window.location.search).get("room");
    if (queryRoom) {
      setJoinCode(normalizeRoomCode(queryRoom));
    }

    const stored = loadSession();
    if (stored) {
      setSession(stored);
    }
  }, []);

  useEffect(() => {
    if (!session) {
      return undefined;
    }

    let cancelled = false;

    const refresh = async () => {
      try {
        const refreshed = await api<PublicRoom>(
          `/api/rooms/${session.roomId}?playerToken=${encodeURIComponent(
            session.playerToken
          )}`
        );

        if (cancelled) {
          return;
        }

        setRoom(refreshed);
        if (refreshed.mode === "single-player") {
          setJoinCode("");
        }

        if (
          refreshed.playerColor &&
          (refreshed.playerColor !== session.color || refreshed.mode !== session.mode)
        ) {
          const updatedSession = {
            ...session,
            color: refreshed.playerColor,
            mode: refreshed.mode
          };
          setSession(updatedSession);
          saveSession(updatedSession);
        }
      } catch (refreshError) {
        if (!cancelled) {
          setError(
            refreshError instanceof Error ? refreshError.message : "Refresh failed."
          );
        }
      }
    };

    refresh();
    const interval = window.setInterval(
      refresh,
      room?.status === "waiting" ? 1500 : 2000
    );

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [room?.status, session]);

  const legalTargets = useMemo(() => {
    if (!room || !selectedSquare || room.status !== "active") {
      return [];
    }

    try {
      return new Chess(room.fen)
        .moves({ square: selectedSquare, verbose: true })
        .map((move) => move.to);
    } catch {
      return [];
    }
  }, [room, selectedSquare]);

  const canMove =
    Boolean(room && playerColor) &&
    room?.status === "active" &&
    room.turn === playerColor &&
    busy !== "move";

  const createNewRoom = useCallback(async () => {
    setBusy("create");
    setError(null);

    try {
      const result = await api<RoomActionResponse>("/api/rooms", {
        method: "POST"
      });
      const nextSession = {
        roomId: result.roomId,
        playerToken: result.playerToken,
        color: result.color,
        mode: result.room.mode
      };
      saveSession(nextSession);
      setSession(nextSession);
      setRoom(result.room);
      setJoinCode(result.roomId);
      setSelectedSquare(null);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Create failed.");
    } finally {
      setBusy(null);
    }
  }, []);

  const createSoloRoom = useCallback(async () => {
    setBusy("solo");
    setError(null);

    try {
      const result = await api<RoomActionResponse>("/api/rooms/solo", {
        method: "POST"
      });
      const nextSession = {
        roomId: result.roomId,
        playerToken: result.playerToken,
        color: result.color,
        mode: result.room.mode
      };
      saveSession(nextSession);
      setSession(nextSession);
      setRoom(result.room);
      setJoinCode("");
      setSelectedSquare(null);
    } catch (soloError) {
      setError(soloError instanceof Error ? soloError.message : "Solo game failed.");
    } finally {
      setBusy(null);
    }
  }, []);

  const joinExistingRoom = useCallback(
    async (event?: FormEvent) => {
      event?.preventDefault();
      const roomId = normalizeRoomCode(joinCode);

      if (!roomId) {
        setError("Enter a room code.");
        return;
      }

      setBusy("join");
      setError(null);

      try {
        const result = await api<RoomActionResponse>(`/api/rooms/${roomId}/join`, {
          method: "POST"
        });
        const nextSession = {
          roomId: result.roomId,
          playerToken: result.playerToken,
          color: result.color,
          mode: result.room.mode
        };
        saveSession(nextSession);
        setSession(nextSession);
        setRoom(result.room);
        setJoinCode(result.roomId);
        setSelectedSquare(null);
      } catch (joinError) {
        setError(joinError instanceof Error ? joinError.message : "Join failed.");
      } finally {
        setBusy(null);
      }
    },
    [joinCode]
  );

  const submitMove = useCallback(
    async (from: Square, to: Square) => {
      if (!room || !session) {
        return;
      }

      setBusy("move");
      setError(null);

      try {
        const updated = await api<PublicRoom>(`/api/rooms/${room.id}/move`, {
          body: JSON.stringify({
            from,
            to,
            playerToken: session.playerToken
          }),
          method: "POST"
        });
        setRoom(updated);
        setSelectedSquare(null);
      } catch (moveError) {
        setError(moveError instanceof Error ? moveError.message : "Move failed.");
      } finally {
        setBusy(null);
      }
    },
    [room, session]
  );

  const handleSquareClick = useCallback(
    (square: Square) => {
      if (!room || !canMove) {
        return;
      }

      if (selectedSquare && legalTargets.includes(square)) {
        submitMove(selectedSquare, square);
        return;
      }

      if (isOwnPiece(room, square, playerColor)) {
        setSelectedSquare(square);
        return;
      }

      setSelectedSquare(null);
    },
    [canMove, legalTargets, playerColor, room, selectedSquare, submitMove]
  );

  const copyRoomCode = useCallback(async () => {
    if (!room) {
      return;
    }

    try {
      await navigator.clipboard.writeText(room.id);
    } catch {
      setError("Could not copy the room code.");
    }
  }, [room]);

  const leaveRoom = useCallback(() => {
    clearStoredSession();
    setSession(null);
    setRoom(null);
    setSelectedSquare(null);
    setError(null);
  }, []);

  return (
    <main className="app-shell">
      <section className="scene-region" aria-label="Three dimensional chess board">
        <ElysiumScene
          audioIntensity={audioIntensity}
          boardInverted={boardInverted}
          legalTargets={legalTargets}
          onSquareClick={handleSquareClick}
          playerColor={playerColor}
          room={room}
          selectedSquare={selectedSquare}
        />
      </section>
      <aside className="side-panel">
        <div className="brand-block">
          <span className="kicker">Online Chess</span>
          <h1>Entering Elysium</h1>
        </div>

        <div className="status-line">
          <span className={`status-dot ${statusClass(room)}`} />
          <span>
            <strong>
              {room?.mode === "single-player"
                ? "Solo vs AI"
                : playerColor
                  ? `${playerColor} player`
                  : "No seat"}
            </strong>{" "}
            {statusText(room, playerColor)}
          </span>
        </div>

        <div className="control-group">
          <div className="button-row">
            <button
              className="primary-button"
              disabled={Boolean(busy)}
              onClick={createSoloRoom}
              type="button"
            >
              <Bot size={18} />
              Solo vs AI
            </button>
            <button
              className="secondary-button"
              disabled={Boolean(busy)}
              onClick={createNewRoom}
              type="button"
            >
              <Plus size={18} />
              New room
            </button>
          </div>

          <div className="button-row single-action">
            <button
              className="secondary-button"
              disabled={!room || Boolean(busy)}
              onClick={leaveRoom}
              type="button"
            >
              <DoorOpen size={18} />
              Leave
            </button>
          </div>

          <form className="button-row" onSubmit={joinExistingRoom}>
            <input
              aria-label="Room code"
              maxLength={8}
              onChange={(event) => setJoinCode(normalizeRoomCode(event.target.value))}
              placeholder="ROOM CODE"
              value={joinCode}
            />
            <button
              className="secondary-button"
              disabled={Boolean(busy)}
              type="submit"
            >
              <LogIn size={18} />
              Join
            </button>
          </form>

          {room?.mode === "multiplayer" ? (
            <div className="room-code">
              <div>
                <span>Room</span>
                <strong>{room.id}</strong>
              </div>
              <button
                className="icon-button"
                onClick={copyRoomCode}
                title="Copy room code"
                type="button"
              >
                <Clipboard size={18} />
                Copy
              </button>
            </div>
          ) : room ? (
            <div className="room-code solo-room">
              <div>
                <span>Opponent</span>
                <strong>AI BLACK</strong>
              </div>
            </div>
          ) : null}
        </div>

        {error ? (
          <div className="status-line">
            <span className="status-dot over" />
            <span className="error-text">{error}</span>
          </div>
        ) : null}

        <ControlsGuide />

        <div className="moves">
          {busy === "refresh" ? <RotateCw size={18} /> : null}
          <MoveList moves={room?.moves ?? []} />
        </div>

        <AudioControl onIntensity={setAudioIntensity} />
      </aside>
    </main>
  );
}
