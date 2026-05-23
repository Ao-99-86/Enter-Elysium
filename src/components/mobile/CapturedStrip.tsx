"use client";

import {
  glyphForCaptured,
  orderedCaptures,
  type CapturedCounts
} from "@/lib/captured";
import type { PlayerColor } from "@/lib/rooms/types";
import styles from "./Mobile.module.css";

export function CapturedStrip({
  captor,
  counts
}: {
  captor: PlayerColor;
  counts: CapturedCounts;
}) {
  const groups = orderedCaptures(counts);
  if (groups.length === 0) {
    return null;
  }

  return (
    <div aria-label={`${captor} captures`} className={styles.capturedStrip}>
      {groups.map(({ piece, count }) => (
        <span className={styles.capturedGroup} key={piece}>
          <span className={styles.capturedGlyph}>
            {glyphForCaptured(captor, piece)}
          </span>
          {count > 1 ? (
            <span className={styles.capturedCount}>{count}</span>
          ) : null}
        </span>
      ))}
    </div>
  );
}
