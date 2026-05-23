"use client";

import { Crown, RotateCw } from "lucide-react";
import styles from "./Mobile.module.css";

export function GameOverBanner({
  title,
  subtitle,
  onRematch
}: {
  title: string;
  subtitle: string;
  onRematch?: () => void;
}) {
  return (
    <div className={styles.gameOverBanner} role="status">
      <span aria-hidden="true" className={styles.gameOverIcon}>
        <Crown size={18} />
      </span>
      <span className={styles.gameOverText}>
        <span className={styles.gameOverTitle}>{title}</span>
        <span className={styles.gameOverSub}>{subtitle}</span>
      </span>
      {onRematch ? (
        <button
          className={styles.gameOverRematch}
          onClick={onRematch}
          type="button"
        >
          <RotateCw size={14} />
          Rematch
        </button>
      ) : null}
    </div>
  );
}
