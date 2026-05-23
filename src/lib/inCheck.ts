import { Chess, type Square } from "chess.js";
import type { PlayerColor } from "@/lib/rooms/types";

export type CheckState = {
  inCheck: boolean;
  kingSquare: Square | null;
};

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;

/**
 * Pure derived state from a FEN: whether the side to move is in check, and if so,
 * which square the king sits on.
 */
export function getCheckState(fen: string): CheckState {
  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return { inCheck: false, kingSquare: null };
  }

  if (!chess.inCheck()) {
    return { inCheck: false, kingSquare: null };
  }

  const turn: PlayerColor = chess.turn() === "w" ? "white" : "black";
  return { inCheck: true, kingSquare: findKingSquare(chess, turn) };
}

export function findKingSquare(chess: Chess, color: PlayerColor): Square | null {
  const board = chess.board();
  const target = color === "white" ? "w" : "b";

  for (let rankIndex = 0; rankIndex < 8; rankIndex += 1) {
    const rank = board[rankIndex];
    for (let fileIndex = 0; fileIndex < 8; fileIndex += 1) {
      const piece = rank[fileIndex];
      if (piece && piece.type === "k" && piece.color === target) {
        return `${FILES[fileIndex]}${8 - rankIndex}` as Square;
      }
    }
  }

  return null;
}
