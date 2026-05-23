"use client";

import { X } from "lucide-react";
import { MobileSoundRow } from "./MobileSoundRow";
import { SheetRow } from "./SheetRow";
import { SwitchPill } from "./SwitchPill";
import styles from "./Mobile.module.css";

export type MobileSettings = {
  haptics: boolean;
  coordinates: boolean;
  autoPromote: boolean;
};

export function SettingsSheet({
  settings,
  soundOn,
  onToggleSound,
  onChange,
  onClose
}: {
  settings: MobileSettings;
  soundOn: boolean;
  onToggleSound: (next: boolean) => void;
  onChange: (next: MobileSettings) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className={styles.scrim} onClick={onClose} role="presentation" />
      <div className={styles.sheet} role="dialog" aria-label="Settings">
        <div className={styles.grabber} />
        <div className={styles.sheetHeader}>
          <h2 className={styles.sheetTitle}>Settings</h2>
          <button
            aria-label="Close"
            className={styles.sheetClose}
            onClick={onClose}
            type="button"
          >
            <X size={16} />
          </button>
        </div>

        <div className={styles.sheetGroup}>
          <p className={styles.sheetGroupLabel}>Audio</p>
          <MobileSoundRow onToggle={onToggleSound} playing={soundOn} />
        </div>

        <div className={styles.sheetGroup}>
          <p className={styles.sheetGroupLabel}>Feedback</p>
          <SheetRow
            icon={<HapticsIcon />}
            label="Haptics"
            meta={
              <SwitchPill
                label="Haptics"
                on={settings.haptics}
                onChange={(next) => onChange({ ...settings, haptics: next })}
              />
            }
            sub="Vibrate on move and check"
          />
        </div>

        <div className={styles.sheetGroup}>
          <p className={styles.sheetGroupLabel}>Board</p>
          <SheetRow
            icon={<CoordsIcon />}
            label="Coordinates"
            meta={
              <SwitchPill
                label="Coordinates"
                on={settings.coordinates}
                onChange={(next) =>
                  onChange({ ...settings, coordinates: next })
                }
              />
            }
            sub="Show file and rank labels"
          />
          <SheetRow
            icon={<QueenIcon />}
            label="Auto-queen promotion"
            meta={
              <SwitchPill
                label="Auto-queen promotion"
                on={settings.autoPromote}
                onChange={(next) =>
                  onChange({ ...settings, autoPromote: next })
                }
              />
            }
            sub="Skip the promotion picker"
          />
        </div>
      </div>
    </>
  );
}

function HapticsIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="7" y="3" width="10" height="18" rx="2" />
      <line x1="10" y1="7" x2="14" y2="7" />
    </svg>
  );
}

function CoordsIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="3" x2="9" y2="21" />
    </svg>
  );
}

function QueenIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M5 9l2 7h10l2-7-4 3-3-5-3 5-4-3z" />
      <line x1="6" y1="20" x2="18" y2="20" />
    </svg>
  );
}
