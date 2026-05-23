"use client";

import type { PieceSymbol } from "chess.js";
import type { PlayerColor } from "@/lib/rooms/types";
import type { PromotionChoice } from "@/lib/useGameShellState";
import styles from "./Mobile.module.css";

const PIECES: Array<{ piece: PromotionChoice; label: string }> = [
  { piece: "q", label: "Queen" },
  { piece: "r", label: "Rook" },
  { piece: "b", label: "Bishop" },
  { piece: "n", label: "Knight" }
];

const WHITE_GLYPHS: Record<PieceSymbol, string> = {
  k: "♔",
  q: "♕",
  r: "♖",
  b: "♗",
  n: "♘",
  p: "♙"
};

const BLACK_GLYPHS: Record<PieceSymbol, string> = {
  k: "♚",
  q: "♛",
  r: "♜",
  b: "♝",
  n: "♞",
  p: "♟"
};

export function PromotionSheet({
  color,
  onPick,
  onCancel
}: {
  color: PlayerColor;
  onPick: (piece: PromotionChoice) => void;
  onCancel: () => void;
}) {
  const glyphs = color === "white" ? WHITE_GLYPHS : BLACK_GLYPHS;

  return (
    <>
      <div className={styles.scrim} onClick={onCancel} role="presentation" />
      <div className={styles.promotionCard} role="dialog" aria-label="Promote pawn">
        <p className={styles.promotionKicker}>Promote pawn</p>
        <p className={styles.promotionTitle}>Choose your replacement</p>
        <div className={styles.promotionGrid}>
          {PIECES.map(({ piece, label }) => (
            <button
              className={styles.promotionTile}
              key={piece}
              onClick={() => onPick(piece)}
              type="button"
            >
              <span className={styles.promotionGlyph}>{glyphs[piece]}</span>
              <span className={styles.promotionLabel}>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
