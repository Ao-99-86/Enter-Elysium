"use client";

import { Minimize2 } from "lucide-react";
import { CapturedStrip } from "./CapturedStrip";
import { EQBars } from "./EQBars";
import type { CapturedPieces } from "@/lib/captured";
import styles from "./Mobile.module.css";

export function FocusMode({
  statusLabel,
  captured,
  playerCaptor,
  opponentCaptor,
  soundOn,
  onExit
}: {
  statusLabel: string;
  captured: CapturedPieces;
  playerCaptor: "white" | "black";
  opponentCaptor: "white" | "black";
  soundOn: boolean;
  onExit: () => void;
}) {
  return (
    <>
      <div className={styles.focusStatus}>
        <span className={styles.focusDot} />
        <span>{statusLabel}</span>
      </div>
      <button
        aria-label="Exit focus mode"
        className={styles.focusExit}
        onClick={onExit}
        type="button"
      >
        <Minimize2 size={14} />
        Exit
      </button>
      <div className={styles.focusBottomRow}>
        <div className={styles.focusCaptureBlock}>
          <span className={styles.focusCaptureLabel}>You took</span>
          <CapturedStrip
            captor={playerCaptor}
            counts={captured[playerCaptor]}
          />
        </div>
        {soundOn ? (
          <div className={styles.focusEq}>
            <EQBars bars={5} height={18} />
          </div>
        ) : null}
        <div className={styles.focusCaptureBlock}>
          <span className={styles.focusCaptureLabel}>They took</span>
          <CapturedStrip
            captor={opponentCaptor}
            counts={captured[opponentCaptor]}
          />
        </div>
      </div>
    </>
  );
}
