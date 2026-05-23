"use client";

import styles from "./Mobile.module.css";

export function EQBars({
  bars = 4,
  height = 12
}: {
  bars?: number;
  height?: number;
}) {
  return (
    <div
      aria-hidden="true"
      className={styles.eqBars}
      style={{ height }}
    >
      {Array.from({ length: bars }).map((_, index) => (
        <span
          className={styles.eqBar}
          key={index}
          style={{
            height: "40%",
            animationDuration: `${1.1 + index * 0.13}s`,
            animationDelay: `${index * 0.05}s`
          }}
        />
      ))}
    </div>
  );
}
