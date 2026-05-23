"use client";

import { type ReactNode } from "react";
import styles from "./Mobile.module.css";

export function SheetRow({
  icon,
  label,
  sub,
  meta,
  onClick,
  danger = false,
  disabled = false
}: {
  icon: ReactNode;
  label: string;
  sub?: string;
  meta?: ReactNode;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  const Component = onClick ? "button" : "div";
  return (
    <Component
      className={`${styles.sheetRow}${danger ? ` ${styles.danger}` : ""}`}
      disabled={onClick && disabled ? true : undefined}
      onClick={onClick}
      type={onClick ? "button" : undefined}
    >
      <span className={styles.sheetRowIcon}>{icon}</span>
      <span className={styles.sheetRowText}>
        <span className={styles.sheetRowLabel}>{label}</span>
        {sub ? <span className={styles.sheetRowSub}>{sub}</span> : null}
      </span>
      {meta ? <span className={styles.sheetRowMeta}>{meta}</span> : null}
    </Component>
  );
}
