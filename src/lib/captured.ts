import type { PieceSymbol } from "chess.js";
import type { MoveRecord, PlayerColor } from "@/lib/rooms/types";

export type CapturedCounts = Partial<Record<PieceSymbol, number>>;

export type CapturedPieces = {
  white: CapturedCounts;
  black: CapturedCounts;
};

const EMPTY: CapturedPieces = { white: {}, black: {} };

/**
 * From a move list, derive how many of each piece type each color has captured.
 * A move played by white that captures something means white *took* that piece —
 * indexed under `white`.
 */
export function getCapturedPieces(moves: MoveRecord[]): CapturedPieces {
  if (moves.length === 0) {
    return EMPTY;
  }

  const result: CapturedPieces = { white: {}, black: {} };

  for (const move of moves) {
    if (!move.captured) {
      continue;
    }

    const bucket = result[move.color];
    bucket[move.captured] = (bucket[move.captured] ?? 0) + 1;
  }

  return result;
}

const PIECE_ORDER: PieceSymbol[] = ["q", "r", "b", "n", "p"];

/**
 * Pieces ordered queen → pawn for display in the captured strip.
 */
export function orderedCaptures(counts: CapturedCounts): Array<{ piece: PieceSymbol; count: number }> {
  return PIECE_ORDER
    .map((piece) => ({ piece, count: counts[piece] ?? 0 }))
    .filter((entry) => entry.count > 0);
}

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

/**
 * Captured-strip glyphs render the piece in the colour of the player who *lost* it.
 */
export function glyphForCaptured(captor: PlayerColor, piece: PieceSymbol): string {
  return captor === "white" ? BLACK_GLYPHS[piece] : WHITE_GLYPHS[piece];
}
