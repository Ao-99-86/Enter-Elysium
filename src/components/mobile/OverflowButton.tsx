"use client";

import { MoreVertical } from "lucide-react";
import styles from "./Mobile.module.css";

export function OverflowButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      aria-label="Open menu"
      className={styles.overflowButton}
      onClick={onClick}
      type="button"
    >
      <MoreVertical size={18} />
    </button>
  );
}
