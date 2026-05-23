"use client";

import type { PlayerColor } from "@/lib/rooms/types";
import styles from "./Mobile.module.css";

export function PlayerChip({
  color,
  name,
  sub,
  active = false
}: {
  color: PlayerColor;
  name: string;
  sub: string;
  active?: boolean;
}) {
  const glyph = color === "white" ? "♙" : "♟";
  return (
    <div
      className={`${styles.playerChip}${active ? ` ${styles.active}` : ""}`}
    >
      <span className={`${styles.playerAvatar} ${styles[color]}`}>
        {glyph}
      </span>
      <span className={styles.playerInfo}>
        <span className={styles.playerName}>{name}</span>
        <span className={styles.playerSub}>{sub}</span>
      </span>
      {active ? (
        <span aria-hidden="true" className={styles.thinkingDots}>
          {[0, 200, 400].map((delay) => (
            <span
              className={styles.thinkingDot}
              key={delay}
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </span>
      ) : null}
    </div>
  );
}
