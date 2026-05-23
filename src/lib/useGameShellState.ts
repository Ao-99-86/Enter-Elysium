"use client";

import { Chess, type PieceSymbol, type Square } from "chess.js";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import type { SceneMoveAnimation } from "@/components/ElysiumScene";
import { getCapturedPieces, type CapturedPieces } from "@/lib/captured";
import { getCheckState } from "@/lib/inCheck";
import type {
  SoloColorChoice
} from "@/lib/rooms/service";
import type {
  PlayerColor,
  PublicRoom,
  RoomMode
} from "@/lib/rooms/types";

export type Session = {
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

export type BusyAction = "create" | "solo" | "join" | "move" | "refresh" | null;

export type PromotionChoice = Extract<PieceSymbol, "q" | "r" | "b" | "n">;

export type PendingPromotion = {
  from: Square;
  to: Square;
  targets: Square[];
};

export type DifficultyChoice = "gentle" | "balanced" | "studied";
export type TimeControlChoice = "bullet" | "blitz" | "classical" | "infinite";

export type PendingSoloConfig = {
  color: SoloColorChoice;
  difficulty: DifficultyChoice;
  timeControl: TimeControlChoice;
};

const DEFAULT_SOLO_CONFIG: PendingSoloConfig = {
  color: "white",
  difficulty: "balanced",
  timeControl: "classical"
};

const SESSION_KEY = "enter-elysium-session";

const INVERSION_TURN_SPAN = 3;
const FIRST_INVERSION_MIN_DELAY = 4;
const FIRST_INVERSION_DELAY_SPREAD = 4;
const INVERSION_MIN_DELAY = 7;
const INVERSION_DELAY_SPREAD = 5;
const ENGULF_TURN_SPAN = 6;
const FIRST_ENGULF_MIN_DELAY = 8;
const FIRST_ENGULF_DELAY_SPREAD = 6;
const ENGULF_MIN_DELAY = 12;
const ENGULF_DELAY_SPREAD = 8;
const MOVE_PHASE_MS = 820;
const TILE_SETTLE_MS = 280;

type OrientationLockable = ScreenOrientation & {
  lock?: (orientation: "landscape" | "portrait" | "any") => Promise<void>;
  unlock?: () => void;
};

function requestImmersiveDisplay(): void {
  const root =
    typeof document !== "undefined" ? document.documentElement : null;

  if (root?.requestFullscreen && !document.fullscreenElement) {
    root.requestFullscreen().catch(() => {});
  }

  const orientation = window.screen?.orientation as
    | OrientationLockable
    | undefined;
  orientation?.lock?.("landscape").catch(() => {});
}

function releaseImmersiveDisplay(): void {
  if (typeof document === "undefined") {
    return;
  }

  if (document.fullscreenElement && document.exitFullscreen) {
    document.exitFullscreen().catch(() => {});
  }

  const orientation = window.screen?.orientation as
    | OrientationLockable
    | undefined;
  orientation?.unlock?.();
}

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

function engulfEpisodeDelay(
  roomId: string,
  episode: number,
  minimum: number,
  spread: number
): number {
  return minimum + (hashString(`${roomId}:engulf:${episode}`) % (spread + 1));
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

function isPlanetEngulfActive(room: PublicRoom | null): boolean {
  if (!room || room.status !== "active") {
    return false;
  }

  const moveCount = room.moves.length;
  let episode = 0;
  let triggerMoveCount = engulfEpisodeDelay(
    room.id,
    episode,
    FIRST_ENGULF_MIN_DELAY,
    FIRST_ENGULF_DELAY_SPREAD
  );

  while (moveCount >= triggerMoveCount + ENGULF_TURN_SPAN) {
    episode += 1;
    triggerMoveCount +=
      ENGULF_TURN_SPAN +
      engulfEpisodeDelay(
        room.id,
        episode,
        ENGULF_MIN_DELAY,
        ENGULF_DELAY_SPREAD
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

export function normalizeRoomCode(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
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

function isOwnPiece(
  room: PublicRoom,
  square: Square,
  playerColor?: PlayerColor
): boolean {
  if (!playerColor) {
    return false;
  }

  const chess = new Chess(room.fen);
  const piece = chess.get(square);
  return Boolean(
    piece && piece.color === (playerColor === "white" ? "w" : "b")
  );
}

function detectPromotion(
  room: PublicRoom,
  from: Square,
  to: Square
): boolean {
  try {
    const chess = new Chess(room.fen);
    return chess
      .moves({ square: from, verbose: true })
      .some((move) => move.to === to && move.flags.includes("p"));
  } catch {
    return false;
  }
}

export type GameShellState = ReturnType<typeof useGameShellState>;

export function useGameShellState() {
  const [room, setRoom] = useState<PublicRoom | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioIntensity, setAudioIntensity] = useState(0);
  const [audioPlaying, setAudioPlaying] = useState(true);
  const [audioVolume, setAudioVolume] = useState(0.22);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [displayFen, setDisplayFen] = useState<string | null>(null);
  const [heldLegalTargets, setHeldLegalTargets] = useState<Square[]>([]);
  const [moveAnimation, setMoveAnimation] = useState<SceneMoveAnimation | null>(
    null
  );
  const [focusMode, setFocusMode] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [pendingPromotion, setPendingPromotion] =
    useState<PendingPromotion | null>(null);
  const [pendingSoloConfig, setPendingSoloConfig] =
    useState<PendingSoloConfig | null>(null);

  const animationLockRef = useRef(false);
  const animationRunRef = useRef(0);

  const enterFocusMode = useCallback(() => {
    setFocusMode(true);
    requestImmersiveDisplay();
  }, []);

  const exitFocusMode = useCallback(() => {
    setFocusMode(false);
    releaseImmersiveDisplay();
  }, []);

  const toggleFocusMode = useCallback(() => {
    setFocusMode((current) => {
      if (current) {
        releaseImmersiveDisplay();
        return false;
      }
      requestImmersiveDisplay();
      return true;
    });
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }

    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setFocusMode(false);
      }
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, []);

  const playerColor = room?.playerColor ?? session?.color;
  const boardInverted = useMemo(() => isBoardInversionActive(room), [room]);
  const planetEngulfActive = useMemo(
    () => isPlanetEngulfActive(room),
    [room]
  );

  const cancelMoveAnimation = useCallback(() => {
    animationRunRef.current += 1;
    animationLockRef.current = false;
    setDisplayFen(null);
    setHeldLegalTargets([]);
    setMoveAnimation(null);
  }, []);

  // Restore session and read ?room= param on first mount.
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const queryRoom = new URLSearchParams(window.location.search).get("room");
    if (queryRoom) {
      setJoinCode(normalizeRoomCode(queryRoom));
    }

    const stored = loadSession();
    if (stored) {
      setSession(stored);
    }
  }, []);

  // Poll for refreshes whenever we have an active session.
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

        if (!animationLockRef.current) {
          setRoom(refreshed);
          setDisplayFen(null);
        }

        if (refreshed.mode === "single-player") {
          setJoinCode("");
        }

        if (
          refreshed.playerColor &&
          (refreshed.playerColor !== session.color ||
            refreshed.mode !== session.mode)
        ) {
          const updatedSession: Session = {
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
            refreshError instanceof Error
              ? refreshError.message
              : "Refresh failed."
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

  const legalTargets = useMemo<Square[]>(() => {
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

  const sceneLegalTargets =
    heldLegalTargets.length > 0 ? heldLegalTargets : legalTargets;

  const canMove =
    Boolean(room && playerColor) &&
    room?.status === "active" &&
    room.turn === playerColor &&
    busy !== "move";

  const checkState = useMemo(() => {
    if (!room || room.status !== "active") {
      return { inCheck: false, kingSquare: null as Square | null };
    }
    return getCheckState(displayFen ?? room.fen);
  }, [room, displayFen]);

  const captured = useMemo<CapturedPieces>(
    () => getCapturedPieces(room?.moves ?? []),
    [room]
  );

  const startSoloSetup = useCallback(() => {
    setPendingSoloConfig({ ...DEFAULT_SOLO_CONFIG });
  }, []);

  const updateSoloConfig = useCallback(
    (patch: Partial<PendingSoloConfig>) => {
      setPendingSoloConfig((current) =>
        current ? { ...current, ...patch } : { ...DEFAULT_SOLO_CONFIG, ...patch }
      );
    },
    []
  );

  const cancelSoloSetup = useCallback(() => {
    setPendingSoloConfig(null);
  }, []);

  const createNewRoom = useCallback(async () => {
    cancelMoveAnimation();
    setBusy("create");
    setError(null);

    try {
      const result = await api<RoomActionResponse>("/api/rooms", {
        method: "POST"
      });
      const nextSession: Session = {
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
      setError(
        createError instanceof Error ? createError.message : "Create failed."
      );
    } finally {
      setBusy(null);
    }
  }, [cancelMoveAnimation]);

  const createSoloRoom = useCallback(
    async (config?: Partial<PendingSoloConfig>) => {
      cancelMoveAnimation();
      setBusy("solo");
      setError(null);

      const merged: PendingSoloConfig = {
        ...DEFAULT_SOLO_CONFIG,
        ...(pendingSoloConfig ?? {}),
        ...(config ?? {})
      };

      try {
        const result = await api<RoomActionResponse>("/api/rooms/solo", {
          body: JSON.stringify({ color: merged.color }),
          method: "POST"
        });
        const nextSession: Session = {
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
        setPendingSoloConfig(null);
      } catch (soloError) {
        setError(
          soloError instanceof Error ? soloError.message : "Solo game failed."
        );
      } finally {
        setBusy(null);
      }
    },
    [cancelMoveAnimation, pendingSoloConfig]
  );

  const joinExistingRoom = useCallback(
    async (event?: FormEvent) => {
      event?.preventDefault();
      const roomId = normalizeRoomCode(joinCode);

      if (!roomId) {
        setError("Enter a room code.");
        return;
      }

      cancelMoveAnimation();
      setBusy("join");
      setError(null);

      try {
        const result = await api<RoomActionResponse>(
          `/api/rooms/${roomId}/join`,
          { method: "POST" }
        );
        const nextSession: Session = {
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
    [cancelMoveAnimation, joinCode]
  );

  const submitMove = useCallback(
    async (
      from: Square,
      to: Square,
      targets: Square[],
      promotion?: PromotionChoice
    ) => {
      if (!room || !session) {
        return;
      }

      const runId = animationRunRef.current + 1;
      const startingFen = room.fen;
      const previousMoveCount = room.moves.length;

      animationRunRef.current = runId;
      animationLockRef.current = true;
      setBusy("move");
      setError(null);
      setDisplayFen(startingFen);
      setHeldLegalTargets(targets);

      const isActiveRun = () => animationRunRef.current === runId;

      try {
        const updated = await api<PublicRoom>(
          `/api/rooms/${room.id}/move`,
          {
            body: JSON.stringify({
              from,
              to,
              playerToken: session.playerToken,
              ...(promotion ? { promotion } : {})
            }),
            method: "POST"
          }
        );
        const confirmedMoves = updated.moves.slice(previousMoveCount);

        if (confirmedMoves.length === 0) {
          setRoom(updated);
          setDisplayFen(null);
          setHeldLegalTargets([]);
          setSelectedSquare(null);
          return;
        }

        for (let index = 0; index < confirmedMoves.length; index += 1) {
          const move = confirmedMoves[index];

          if (!isActiveRun()) {
            return;
          }

          setMoveAnimation({
            color: move.color,
            from: move.from,
            id: `${updated.id}-${move.playedAt}-${move.lan}-${index}`,
            piece: move.piece,
            to: move.to
          });

          await wait(MOVE_PHASE_MS);

          if (!isActiveRun()) {
            return;
          }

          setMoveAnimation(null);
          setDisplayFen(move.fen);

          if (index === 0) {
            setSelectedSquare(null);
            setHeldLegalTargets([]);
            await wait(TILE_SETTLE_MS);
          }
        }

        if (!isActiveRun()) {
          return;
        }

        setRoom(updated);
        setDisplayFen(null);
      } catch (moveError) {
        setError(moveError instanceof Error ? moveError.message : "Move failed.");
        setDisplayFen(null);
        setHeldLegalTargets([]);
        setMoveAnimation(null);
      } finally {
        if (isActiveRun()) {
          animationLockRef.current = false;
          setBusy(null);
        }
      }
    },
    [room, session]
  );

  const handleSquareClick = useCallback(
    (square: Square, options?: { autoPromote?: boolean }) => {
      if (!room || !canMove) {
        return;
      }

      if (selectedSquare && legalTargets.includes(square)) {
        const promotionNeeded = detectPromotion(room, selectedSquare, square);

        if (promotionNeeded && !options?.autoPromote) {
          setPendingPromotion({
            from: selectedSquare,
            to: square,
            targets: legalTargets
          });
          return;
        }

        submitMove(
          selectedSquare,
          square,
          legalTargets,
          promotionNeeded ? "q" : undefined
        );
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

  const confirmPromotion = useCallback(
    (piece: PromotionChoice) => {
      if (!pendingPromotion) {
        return;
      }
      const { from, to, targets } = pendingPromotion;
      setPendingPromotion(null);
      submitMove(from, to, targets, piece);
    },
    [pendingPromotion, submitMove]
  );

  const cancelPromotion = useCallback(() => {
    setPendingPromotion(null);
  }, []);

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
    cancelMoveAnimation();
    exitFocusMode();
    clearStoredSession();
    setSession(null);
    setRoom(null);
    setSelectedSquare(null);
    setError(null);
    setPendingPromotion(null);
    setPendingSoloConfig(null);
  }, [cancelMoveAnimation, exitFocusMode]);

  return {
    room,
    session,
    joinCode,
    setJoinCode,
    selectedSquare,
    busy,
    error,
    setError,
    audioIntensity,
    setAudioIntensity,
    audioPlaying,
    setAudioPlaying,
    audioVolume,
    setAudioVolume,
    audioError,
    setAudioError,
    displayFen,
    sceneLegalTargets,
    legalTargets,
    moveAnimation,
    focusMode,
    panelCollapsed,
    setPanelCollapsed,
    pendingPromotion,
    pendingSoloConfig,
    playerColor,
    boardInverted,
    planetEngulfActive,
    checkState,
    captured,
    canMove,
    startSoloSetup,
    updateSoloConfig,
    cancelSoloSetup,
    createNewRoom,
    createSoloRoom,
    joinExistingRoom,
    handleSquareClick,
    confirmPromotion,
    cancelPromotion,
    copyRoomCode,
    leaveRoom,
    enterFocusMode,
    exitFocusMode,
    toggleFocusMode
  };
}
