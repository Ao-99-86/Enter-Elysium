"use client";

import styles from "./Mobile.module.css";

export function SwitchPill({
  on,
  onChange,
  label
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      aria-label={label}
      aria-pressed={on}
      className={styles.switchPill}
      data-on={on ? "true" : "false"}
      onClick={() => onChange(!on)}
      type="button"
    >
      <span className={styles.switchKnob} />
    </button>
  );
}
