import { Chess, type Move, type PieceSymbol } from "chess.js";

const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0
};

function nextPosition(chess: Chess, move: Move): Chess {
  const next = new Chess(chess.fen());
  next.move({
    from: move.from,
    to: move.to,
    ...(move.promotion ? { promotion: move.promotion } : {})
  });
  return next;
}

function moveScore(chess: Chess, move: Move): number {
  const next = nextPosition(chess, move);
  const promotionValue = move.promotion ? PIECE_VALUES[move.promotion] : 0;
  const capturedValue = move.captured ? PIECE_VALUES[move.captured] : 0;

  return (
    (next.isCheckmate() ? 1_000_000 : 0) +
    (promotionValue ? 100_000 + promotionValue : 0) +
    (capturedValue ? 10_000 + capturedValue : 0) +
    (next.isCheck() ? 1_000 : 0)
  );
}

function moveKey(move: Move): string {
  return `${move.from}${move.to}${move.promotion ?? ""}`;
}

export function chooseGreedyAiMove(chess: Chess): Move | null {
  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) {
    return null;
  }

  return moves
    .map((move) => ({
      key: moveKey(move),
      move,
      score: moveScore(chess, move)
    }))
    .sort((left, right) => {
      if (left.score !== right.score) {
        return right.score - left.score;
      }

      return left.key < right.key ? -1 : left.key > right.key ? 1 : 0;
    })[0].move;
}
