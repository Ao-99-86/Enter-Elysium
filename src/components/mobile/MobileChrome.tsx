"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { ActionSheet } from "./ActionSheet";
import { CapturedStrip } from "./CapturedStrip";
import { CheckRipple } from "./CheckRipple";
import { FocusMode } from "./FocusMode";
import { GameOverBanner } from "./GameOverBanner";
import { Lobby } from "./Lobby";
import { OverflowButton } from "./OverflowButton";
import { PlayerChip } from "./PlayerChip";
import { PromotionSheet } from "./PromotionSheet";
import { SettingsSheet, type MobileSettings } from "./SettingsSheet";
import { SoloSetupScreen } from "./SoloSetupScreen";
import { StatusPill, type StatusPillTone } from "./StatusPill";
import { TurnBand } from "./TurnBand";
import { WaitingOverlay } from "./WaitingOverlay";
import { useLocalStorageState } from "@/lib/useLocalStorageState";
import type { GameShellState, PromotionChoice } from "@/lib/useGameShellState";
import type { PlayerColor, PublicRoom } from "@/lib/rooms/types";
import styles from "./Mobile.module.css";

const ElysiumScene = dynamic(
  () => import("../ElysiumScene").then((module) => module.ElysiumScene),
  {
    ssr: false,
    loading: () => null
  }
);

const SETTINGS_KEY = "elysium.mobile.settings";
const DEFAULT_SETTINGS: MobileSettings = {
  haptics: true,
  coordinates: true,
  autoPromote: false
};

type Sheet = "actions" | "settings" | null;

type StatusInfo = {
  label: string;
  tone: StatusPillTone;
  hint: string;
  isOver: boolean;
};

function statusInfo(
  room: PublicRoom | null,
  playerColor: PlayerColor | undefined,
  inCheck: boolean
): StatusInfo {
  if (!room) {
    return {
      label: "No game",
      tone: "amber",
      hint: "Choose a mode below.",
      isOver: false
    };
  }

  if (room.status === "waiting") {
    return {
      label: "Waiting…",
      tone: "blue",
      hint: "Share your code.",
      isOver: false
    };
  }

  if (room.status === "over") {
    const me = playerColor;
    const winner = room.winner;
    let label = "Game over";
    if (room.result === "checkmate" && winner) {
      label = `Checkmate · ${winner === "white" ? "White" : "Black"}`;
    } else if (room.result) {
      label = `Draw · ${room.result}`;
    }
    const hint =
      me && winner
        ? winner === me
          ? "You won. Rematch?"
          : "Try again."
        : "Tap rematch.";
    return { label, tone: "red", hint, isOver: true };
  }

  const yourTurn = room.turn === playerColor;
  if (inCheck) {
    return {
      label: "Check!",
      tone: "red",
      hint: yourTurn ? "Address the threat." : "Opponent under threat.",
      isOver: false
    };
  }

  if (yourTurn) {
    return {
      label: "Your move",
      tone: "amber",
      hint: "Tap a piece, then a target.",
      isOver: false
    };
  }

  return {
    label: room.mode === "single-player" ? "AI thinking" : "Opponent thinking",
    tone: "blue",
    hint:
      room.mode === "single-player"
        ? "AI is responding."
        : "Waiting for their move.",
    isOver: false
  };
}

function lastMoveLabel(room: PublicRoom | null): string {
  const last = room?.lastMove;
  if (!last) {
    return "";
  }
  const who = last.color === "white" ? "White" : "Black";
  return `${who} played ${last.san}`;
}

function describeGameOver(room: PublicRoom, playerColor?: PlayerColor) {
  let title = "Game over";
  if (room.result === "checkmate" && room.winner) {
    const winner = room.winner === "white" ? "White" : "Black";
    title = `Checkmate — ${winner} wins`;
  } else if (room.result === "stalemate") {
    title = "Stalemate";
  } else if (room.result === "threefold-repetition") {
    title = "Draw — repetition";
  } else if (room.result === "insufficient-material") {
    title = "Draw — material";
  } else if (room.result === "fifty-move") {
    title = "Draw — 50 move rule";
  } else if (room.result === "draw") {
    title = "Draw";
  }

  const subtitle = lastMoveLabel(room) ||
    (room.winner === playerColor
      ? "Well played."
      : "Better luck next round.");
  return { title, subtitle };
}

function triggerHaptic(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // ignore
  }
}

export function MobileChrome({ state }: { state: GameShellState }) {
  const {
    room,
    busy,
    error,
    joinCode,
    setJoinCode,
    playerColor,
    selectedSquare,
    sceneLegalTargets,
    boardInverted,
    planetEngulfActive,
    displayFen,
    moveAnimation,
    audioIntensity,
    audioPlaying,
    setAudioPlaying,
    focusMode,
    enterFocusMode,
    exitFocusMode,
    checkState,
    captured,
    pendingPromotion,
    pendingSoloConfig,
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
    leaveRoom
  } = state;

  const [settings, setSettings] = useLocalStorageState<MobileSettings>(
    SETTINGS_KEY,
    DEFAULT_SETTINGS
  );
  const [sheet, setSheet] = useState<Sheet>(null);

  // Wrap the click handler with haptics + auto-promote.
  const onSquareClick = useCallback(
    (square: Parameters<GameShellState["handleSquareClick"]>[0]) => {
      if (settings.haptics) {
        triggerHaptic(8);
      }
      handleSquareClick(square, { autoPromote: settings.autoPromote });
    },
    [handleSquareClick, settings.autoPromote, settings.haptics]
  );

  // Vibrate on opponent's move arrival / check.
  const moveCount = room?.moves.length ?? 0;
  useEffect(() => {
    if (!settings.haptics || !room || room.status !== "active") {
      return;
    }
    const last = room.lastMove;
    if (!last || last.color === playerColor) {
      return;
    }
    if (last.captured) {
      triggerHaptic([15, 30, 15]);
    } else {
      triggerHaptic(15);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moveCount]);

  useEffect(() => {
    if (settings.haptics && checkState.inCheck) {
      triggerHaptic([40, 30, 80]);
    }
  }, [checkState.inCheck, settings.haptics]);

  const info = statusInfo(room, playerColor, checkState.inCheck);
  const inGame = Boolean(room);
  const isLobby = !inGame && !pendingSoloConfig;
  const isSoloSetup = !inGame && Boolean(pendingSoloConfig);
  const isWaiting = room?.status === "waiting";
  const isOver = room?.status === "over";
  const isMultiplayer = room?.mode === "multiplayer";
  const isPlay = room?.status === "active";

  const opponentColor: PlayerColor =
    playerColor === "black" ? "white" : "black";
  const opponentName =
    room?.mode === "single-player" ? "AI Elysium" : "Opponent";
  const opponentActive = isPlay && room?.turn === opponentColor;
  const youActive = isPlay && room?.turn === playerColor;

  const toggleSound = useCallback(() => {
    setAudioPlaying(!audioPlaying);
  }, [audioPlaying, setAudioPlaying]);

  const handleRematch = useCallback(() => {
    if (!room) {
      return;
    }
    if (room.mode === "single-player") {
      void createSoloRoom({ color: playerColor ?? "white" });
    } else {
      leaveRoom();
    }
  }, [createSoloRoom, leaveRoom, playerColor, room]);

  const handlePromotionPick = useCallback(
    (piece: PromotionChoice) => {
      confirmPromotion(piece);
    },
    [confirmPromotion]
  );

  return (
    <>
      <div
        className={`${styles.sceneLayer}${isOver ? ` ${styles.boardFrozen}` : ""}`}
        aria-label="Three dimensional chess board"
      >
        <ElysiumScene
          audioIntensity={audioIntensity}
          boardInverted={boardInverted}
          displayFen={displayFen ?? undefined}
          legalTargets={sceneLegalTargets}
          moveAnimation={moveAnimation}
          onSquareClick={onSquareClick}
          planetEngulfActive={planetEngulfActive}
          playerColor={playerColor}
          room={room}
          selectedSquare={selectedSquare}
        />
      </div>

      {isLobby ? (
        <Lobby
          busy={Boolean(busy)}
          error={error}
          joinCode={joinCode}
          onCreate={createNewRoom}
          onJoin={joinExistingRoom}
          onSolo={startSoloSetup}
          setJoinCode={setJoinCode}
        />
      ) : null}

      {isSoloSetup && pendingSoloConfig ? (
        <SoloSetupScreen
          busy={Boolean(busy)}
          config={pendingSoloConfig}
          onBegin={() => void createSoloRoom()}
          onCancel={cancelSoloSetup}
          onChange={updateSoloConfig}
        />
      ) : null}

      {inGame && !focusMode ? (
        <>
          <StatusPill
            isOver={info.isOver}
            label={info.label}
            tone={info.tone}
          />
          <OverflowButton onClick={() => setSheet("actions")} />

          <div className={`${styles.playerStrip} ${styles.playerStripTop}`}>
            <PlayerChip
              active={Boolean(opponentActive)}
              color={opponentColor}
              name={opponentName}
              sub={opponentColor === "white" ? "White" : "Black"}
            />
            <CapturedStrip
              captor={opponentColor}
              counts={captured[opponentColor]}
            />
          </div>

          {!isOver && playerColor ? (
            <div className={`${styles.playerStrip} ${styles.playerStripBottom}`}>
              <PlayerChip
                active={Boolean(youActive)}
                color={playerColor}
                name="You"
                sub={playerColor === "white" ? "White" : "Black"}
              />
              <CapturedStrip
                captor={playerColor}
                counts={captured[playerColor]}
              />
            </div>
          ) : null}

          {checkState.inCheck ? <CheckRipple /> : null}

          {isOver ? (
            (() => {
              const { title, subtitle } = describeGameOver(room!, playerColor);
              return (
                <GameOverBanner
                  onRematch={handleRematch}
                  subtitle={subtitle}
                  title={title}
                />
              );
            })()
          ) : !pendingPromotion ? (
            <TurnBand hint={info.hint} />
          ) : null}
        </>
      ) : null}

      {inGame && focusMode && playerColor ? (
        <FocusMode
          captured={captured}
          onExit={exitFocusMode}
          opponentCaptor={opponentColor}
          playerCaptor={playerColor}
          soundOn={audioPlaying}
          statusLabel={info.label}
        />
      ) : null}

      {isWaiting && room ? (
        <WaitingOverlay code={room.id} onCopy={copyRoomCode} />
      ) : null}

      {pendingPromotion && playerColor ? (
        <PromotionSheet
          color={playerColor}
          onCancel={cancelPromotion}
          onPick={handlePromotionPick}
        />
      ) : null}

      {sheet === "actions" ? (
        <ActionSheet
          isMultiplayer={Boolean(isMultiplayer)}
          isPlay={Boolean(isPlay)}
          onClose={() => setSheet(null)}
          onCopyCode={copyRoomCode}
          onEnterFocus={() => {
            setSheet(null);
            enterFocusMode();
          }}
          onLeave={() => {
            setSheet(null);
            leaveRoom();
          }}
          onOpenSettings={() => setSheet("settings")}
          onResign={() => {
            setSheet(null);
            leaveRoom();
          }}
          onToggleSound={toggleSound}
          roomCode={room?.id}
          soundOn={audioPlaying}
        />
      ) : null}

      {sheet === "settings" ? (
        <SettingsSheet
          onChange={setSettings}
          onClose={() => setSheet(null)}
          onToggleSound={(next) => setAudioPlaying(next)}
          settings={settings}
          soundOn={audioPlaying}
        />
      ) : null}

      {error && inGame ? <div className={styles.errorToast}>{error}</div> : null}
    </>
  );
}
