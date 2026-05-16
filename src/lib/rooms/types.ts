import type { Color, PieceSymbol, Square } from "chess.js";

export type PlayerColor = "white" | "black";
export type RoomStatus = "waiting" | "active" | "over";
export type GameResult =
  | "checkmate"
  | "stalemate"
  | "threefold-repetition"
  | "insufficient-material"
  | "fifty-move"
  | "draw";

export type MoveRecord = {
  color: PlayerColor;
  from: Square;
  to: Square;
  san: string;
  lan: string;
  piece: PieceSymbol;
  captured?: PieceSymbol;
  promotion?: PieceSymbol;
  fen: string;
  playedAt: number;
};

export type Room = {
  id: string;
  fen: string;
  pgn: string;
  whiteToken: string;
  blackToken?: string;
  status: RoomStatus;
  result?: GameResult;
  winner?: PlayerColor;
  moves: MoveRecord[];
  createdAt: number;
  updatedAt: number;
  version: number;
};

export type PublicRoom = {
  id: string;
  fen: string;
  pgn: string;
  turn: PlayerColor;
  status: RoomStatus;
  result?: GameResult;
  winner?: PlayerColor;
  players: {
    white: boolean;
    black: boolean;
  };
  moves: MoveRecord[];
  lastMove?: MoveRecord;
  playerColor?: PlayerColor;
  createdAt: number;
  updatedAt: number;
  version: number;
};

export type SubmitMoveInput = {
  from: Square;
  to: Square;
  promotion?: Extract<PieceSymbol, "q" | "r" | "b" | "n">;
  playerToken: string;
};

export type RoomStore = {
  getRoom(roomId: string): Promise<Room | null>;
  setRoom(room: Room): Promise<void>;
};

export const ROOM_TTL_SECONDS = 60 * 60 * 8;

export function chessColorToPlayerColor(color: Color): PlayerColor {
  return color === "w" ? "white" : "black";
}

export function playerColorToChessColor(color: PlayerColor): Color {
  return color === "white" ? "w" : "b";
}
