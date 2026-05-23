"use client";

import { Copy } from "lucide-react";
import styles from "./Mobile.module.css";

export function WaitingOverlay({
  code,
  onCopy
}: {
  code: string;
  onCopy: () => void;
}) {
  return (
    <div className={styles.waitingCard} role="status" aria-live="polite">
      <div className={styles.waitingHeader}>
        <span className={styles.waitingDot} />
        <span className={styles.waitingKicker}>Waiting for opponent</span>
      </div>
      <p className={styles.waitingSubtitle}>
        Share this code to start the game.
      </p>
      <div className={styles.waitingCodeRow}>
        <span className={styles.waitingCode}>{code}</span>
        <button
          className={styles.copyButton}
          onClick={onCopy}
          type="button"
        >
          <Copy size={14} />
          Copy
        </button>
      </div>
      <p className={styles.waitingFootnote}>
        The first player to join takes black.
      </p>
    </div>
  );
}
