"use client";

import styles from "./Mobile.module.css";

export type StatusPillTone = "amber" | "blue" | "red";

export function StatusPill({
  label,
  tone = "amber",
  isOver = false
}: {
  label: string;
  tone?: StatusPillTone;
  isOver?: boolean;
}) {
  const toneClass = styles[tone];
  return (
    <div
      className={`${styles.statusPill}${isOver ? ` ${styles.over}` : ""}`}
      role="status"
    >
      <span className={`${styles.statusDot} ${toneClass}`} />
      <span>{label}</span>
    </div>
  );
}
