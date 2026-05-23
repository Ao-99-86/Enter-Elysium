"use client";

import { Volume2, VolumeX } from "lucide-react";
import { EQBars } from "./EQBars";
import { SwitchPill } from "./SwitchPill";
import styles from "./Mobile.module.css";

export function MobileSoundRow({
  playing,
  onToggle
}: {
  playing: boolean;
  onToggle: (next: boolean) => void;
}) {
  return (
    <div className={styles.soundRow}>
      <span aria-hidden="true" className={styles.soundIcon}>
        {playing ? <Volume2 size={18} /> : <VolumeX size={18} />}
      </span>
      <span className={styles.soundText}>
        <span className={styles.soundLabel}>Sound</span>
        <span className={styles.soundSub}>Ambient mix + move clicks</span>
      </span>
      {playing ? (
        <span className={styles.soundEq}>
          <EQBars />
        </span>
      ) : null}
      <SwitchPill label="Sound" on={playing} onChange={onToggle} />
    </div>
  );
}
