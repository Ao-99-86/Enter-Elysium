"use client";

import { ChevronLeft } from "lucide-react";
import type {
  DifficultyChoice,
  PendingSoloConfig,
  TimeControlChoice
} from "@/lib/useGameShellState";
import type { SoloColorChoice } from "@/lib/rooms/service";
import styles from "./Mobile.module.css";

const COLOR_OPTIONS: Array<{
  value: SoloColorChoice;
  glyph: string;
  glyphColor: string;
  name: string;
  sub: string;
}> = [
  {
    value: "white",
    glyph: "♔",
    glyphColor: "#f6efdc",
    name: "White",
    sub: "First move"
  },
  {
    value: "random",
    glyph: "⚄",
    glyphColor: "#f6efdc",
    name: "Random",
    sub: "Toss-up"
  },
  {
    value: "black",
    glyph: "♚",
    glyphColor: "#181a1d",
    name: "Black",
    sub: "Counter"
  }
];

const DIFFICULTIES: Array<{
  value: DifficultyChoice;
  name: string;
  sub: string;
}> = [
  { value: "gentle", name: "Gentle", sub: "Learns the ropes" },
  { value: "balanced", name: "Balanced", sub: "A steady test" },
  { value: "studied", name: "Studied", sub: "Punishes mistakes" }
];

const TIME_CONTROLS: Array<{
  value: TimeControlChoice;
  display: string;
  label: string;
}> = [
  { value: "bullet", display: "3", label: "Bullet" },
  { value: "blitz", display: "10", label: "Blitz" },
  { value: "classical", display: "30", label: "Classical" },
  { value: "infinite", display: "∞", label: "No clock" }
];

export type SoloSetupScreenProps = {
  config: PendingSoloConfig;
  busy: boolean;
  onChange: (patch: Partial<PendingSoloConfig>) => void;
  onCancel: () => void;
  onBegin: () => void;
};

export function SoloSetupScreen({
  config,
  busy,
  onChange,
  onCancel,
  onBegin
}: SoloSetupScreenProps) {
  return (
    <div className={styles.setupScreen}>
      <div className={styles.setupHeader}>
        <button
          aria-label="Back to lobby"
          className={styles.setupBack}
          onClick={onCancel}
          type="button"
        >
          <ChevronLeft size={18} />
        </button>
        <div className={styles.setupTitleBlock}>
          <span className={styles.setupKicker}>Solo</span>
          <h2 className={styles.setupTitle}>Configure match</h2>
        </div>
      </div>

      <div className={styles.setupGroup}>
        <p className={styles.setupGroupLabel}>You play as</p>
        <div className={styles.setupColors}>
          {COLOR_OPTIONS.map((option) => (
            <button
              className={styles.setupColor}
              data-selected={config.color === option.value}
              key={option.value}
              onClick={() => onChange({ color: option.value })}
              type="button"
            >
              <span
                className={styles.setupColorGlyph}
                style={{ color: option.glyphColor }}
              >
                {option.glyph}
              </span>
              <span className={styles.setupColorName}>{option.name}</span>
              <span className={styles.setupColorSub}>{option.sub}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.setupGroup}>
        <p className={styles.setupGroupLabel}>Difficulty</p>
        <div className={styles.setupDifficulty}>
          {DIFFICULTIES.map((option) => (
            <button
              className={styles.setupDifficultyRow}
              data-selected={config.difficulty === option.value}
              key={option.value}
              onClick={() => onChange({ difficulty: option.value })}
              type="button"
            >
              <span className={styles.setupDifficultyDot} />
              <span className={styles.setupDifficultyText}>
                <span className={styles.setupDifficultyName}>
                  {option.name}
                </span>
                <span className={styles.setupDifficultySub}>{option.sub}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.setupGroup}>
        <p className={styles.setupGroupLabel}>Time control</p>
        <div className={styles.setupTimes}>
          {TIME_CONTROLS.map((option) => (
            <button
              className={styles.setupTime}
              data-selected={config.timeControl === option.value}
              key={option.value}
              onClick={() => onChange({ timeControl: option.value })}
              type="button"
            >
              <span className={styles.setupTimeValue}>{option.display}</span>
              <span className={styles.setupTimeLabel}>{option.label}</span>
            </button>
          ))}
        </div>
      </div>

      <button
        className={`${styles.lobbyPrimary} ${styles.setupBegin}`}
        disabled={busy}
        onClick={onBegin}
        type="button"
      >
        Begin game
      </button>
    </div>
  );
}
