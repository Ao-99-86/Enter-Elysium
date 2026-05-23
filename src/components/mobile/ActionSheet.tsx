"use client";

import {
  Copy,
  DoorOpen,
  Flag,
  HelpCircle,
  Maximize2,
  Settings,
  Sparkles,
  Volume2,
  VolumeX,
  X
} from "lucide-react";
import { SheetRow } from "./SheetRow";
import styles from "./Mobile.module.css";

export type ActionSheetProps = {
  roomCode?: string;
  onCopyCode?: () => void;
  isMultiplayer: boolean;
  isPlay: boolean;
  soundOn: boolean;
  onToggleSound: () => void;
  onOpenSettings: () => void;
  onEnterFocus: () => void;
  onResign?: () => void;
  onLeave: () => void;
  onClose: () => void;
};

export function ActionSheet({
  roomCode,
  onCopyCode,
  isMultiplayer,
  isPlay,
  soundOn,
  onToggleSound,
  onOpenSettings,
  onEnterFocus,
  onResign,
  onLeave,
  onClose
}: ActionSheetProps) {
  return (
    <>
      <div className={styles.scrim} onClick={onClose} role="presentation" />
      <div className={styles.sheet} role="dialog" aria-label="Actions">
        <div className={styles.grabber} />
        <div className={styles.sheetHeader}>
          <h2 className={styles.sheetTitle}>Actions</h2>
          <button
            aria-label="Close"
            className={styles.sheetClose}
            onClick={onClose}
            type="button"
          >
            <X size={16} />
          </button>
        </div>

        {isMultiplayer && roomCode ? (
          <div className={styles.sheetRoomRow}>
            <div>
              <div className={styles.sheetRoomLabel}>Room</div>
              <div className={styles.sheetRoomCode}>{roomCode}</div>
            </div>
            <button
              className={styles.copyButton}
              onClick={onCopyCode}
              type="button"
            >
              <Copy size={14} />
              Copy
            </button>
          </div>
        ) : null}

        <div className={styles.sheetGroup}>
          <SheetRow
            disabled={!isPlay}
            icon={<Sparkles size={18} />}
            label="Hint"
            onClick={() => {}}
            sub="Highlight a strong move"
          />
          <SheetRow
            icon={soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
            label={soundOn ? "Sound on" : "Sound off"}
            onClick={onToggleSound}
            sub={soundOn ? "Ambient mix is playing" : "Tap to start audio"}
          />
          <SheetRow
            icon={<Maximize2 size={18} />}
            label="Focus mode"
            onClick={onEnterFocus}
            sub="Hide chrome, fill screen"
          />
          <SheetRow
            icon={<Settings size={18} />}
            label="Settings"
            onClick={onOpenSettings}
            sub="Audio, haptics, board"
          />
          <SheetRow
            icon={<HelpCircle size={18} />}
            label="Controls"
            onClick={() => {}}
            sub="Tap a piece, then a target"
          />
          {isPlay && onResign ? (
            <SheetRow
              danger
              icon={<Flag size={18} />}
              label="Resign"
              onClick={onResign}
              sub="End this game"
            />
          ) : null}
          <SheetRow
            danger
            icon={<DoorOpen size={18} />}
            label="Leave room"
            onClick={onLeave}
            sub="Back to the lobby"
          />
        </div>
      </div>
    </>
  );
}
