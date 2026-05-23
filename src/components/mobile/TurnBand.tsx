"use client";

import styles from "./Mobile.module.css";

export function TurnBand({ hint }: { hint: string }) {
  return <div className={styles.turnBand}>{hint}</div>;
}
