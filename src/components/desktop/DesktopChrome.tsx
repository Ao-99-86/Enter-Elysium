"use client";

import dynamic from "next/dynamic";
import {
  Bot,
  ChevronDown,
  ChevronUp,
  Clipboard,
  DoorOpen,
  Gamepad2,
  LogIn,
  Maximize2,
  Minimize2,
  MousePointer2,
  Plus,
  RotateCw,
  Smartphone,
  Volume2,
  VolumeX
} from "lucide-react";
import { useCallback } from "react";
import { normalizeRoomCode, type GameShellState } from "@/lib/useGameShellState";
import type { PlayerColor, PublicRoom } from "@/lib/rooms/types";

const ElysiumScene = dynamic(
  () =>
    import("../ElysiumScene").then((module) => module.ElysiumScene),
  {
    ssr: false,
    loading: () => <div className="scene-fallback">Loading board</div>
  }
);

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

type DesktopAudioPanelProps = {
  playing: boolean;
  volume: number;
  error: string | null;
  onTogglePlaying: () => void;
  onVolumeChange: (volume: number) => void;
};

function DesktopAudioPanel({
  playing,
  volume,
  error,
  onTogglePlaying,
  onVolumeChange
}: DesktopAudioPanelProps) {
  return (
    <div className="audio-panel">
      <div className="audio-top">
        <span className="kicker">Sound</span>
        <button
          className="icon-button"
          onClick={onTogglePlaying}
          title={playing ? "Pause audio" : "Play audio"}
          type="button"
        >
          {playing ? <VolumeX size={18} /> : <Volume2 size={18} />}
          {playing ? "Pause" : "Play"}
        </button>
      </div>
      <label className="volume-row">
        <Volume2 size={18} />
        <input
          aria-label="Volume"
          max="1"
          min="0"
          onChange={(event) => onVolumeChange(Number(event.target.value))}
          step="0.01"
          type="range"
          value={volume}
        />
      </label>
      {error ? <div className="error-text">{error}</div> : null}
    </div>
  );
}

export function DesktopChrome({ state }: { state: GameShellState }) {
  const {
    room,
    busy,
    error,
    joinCode,
    setJoinCode,
    focusMode,
    panelCollapsed,
    setPanelCollapsed,
    playerColor,
    sceneLegalTargets,
    boardInverted,
    planetEngulfActive,
    displayFen,
    moveAnimation,
    selectedSquare,
    audioIntensity,
    audioPlaying,
    setAudioPlaying,
    audioVolume,
    setAudioVolume,
    audioError,
    createNewRoom,
    createSoloRoom,
    joinExistingRoom,
    handleSquareClick,
    copyRoomCode,
    leaveRoom,
    exitFocusMode,
    toggleFocusMode
  } = state;

  const toggleAudio = useCallback(() => {
    setAudioPlaying(!audioPlaying);
  }, [audioPlaying, setAudioPlaying]);

  return (
    <main
      className={`app-shell${focusMode ? " focus-mode" : ""}${
        panelCollapsed ? " panel-collapsed" : ""
      }`}
    >
      <section className="scene-region" aria-label="Three dimensional chess board">
        <ElysiumScene
          audioIntensity={audioIntensity}
          boardInverted={boardInverted}
          displayFen={displayFen ?? undefined}
          legalTargets={sceneLegalTargets}
          moveAnimation={moveAnimation}
          onSquareClick={handleSquareClick}
          planetEngulfActive={planetEngulfActive}
          playerColor={playerColor}
          room={room}
          selectedSquare={selectedSquare}
        />
        {focusMode ? (
          <button
            aria-label="Exit focus mode"
            className="focus-exit"
            onClick={exitFocusMode}
            title="Exit focus mode"
            type="button"
          >
            <Minimize2 size={18} />
          </button>
        ) : null}
        <div className="rotate-hint" role="status">
          <Smartphone size={18} />
          <span>Rotate your device to landscape for the best view.</span>
        </div>
      </section>
      <aside className="side-panel">
        <button
          aria-expanded={!panelCollapsed}
          aria-label={panelCollapsed ? "Show panel" : "Hide panel"}
          className="panel-toggle"
          onClick={() => setPanelCollapsed(!panelCollapsed)}
          type="button"
        >
          <span>{panelCollapsed ? "Show panel" : "Hide panel"}</span>
          {panelCollapsed ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
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
              onClick={() => {
                void createSoloRoom();
              }}
              type="button"
            >
              <Bot size={18} />
              Solo vs AI
            </button>
            <button
              className="secondary-button"
              disabled={Boolean(busy)}
              onClick={() => {
                void createNewRoom();
              }}
              type="button"
            >
              <Plus size={18} />
              New room
            </button>
          </div>

          <div className="button-row">
            <button
              className="secondary-button"
              disabled={!room}
              onClick={toggleFocusMode}
              title={
                focusMode
                  ? "Exit focus mode"
                  : "Focus mode hides the panel and fills the screen"
              }
              type="button"
            >
              {focusMode ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              {focusMode ? "Exit focus" : "Focus mode"}
            </button>
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
              onChange={(event) =>
                setJoinCode(normalizeRoomCode(event.target.value))
              }
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

        <DesktopAudioPanel
          error={audioError}
          onTogglePlaying={toggleAudio}
          onVolumeChange={setAudioVolume}
          playing={audioPlaying}
          volume={audioVolume}
        />
      </aside>
    </main>
  );
}
