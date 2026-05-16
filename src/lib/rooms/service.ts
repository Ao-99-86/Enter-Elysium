import crypto from "node:crypto";
import { Chess, type Move, type PieceSymbol, type Square } from "chess.js";
import { chooseGreedyAiMove } from "./ai";
import { RoomError } from "./errors";
import type {
  GameResult,
  MoveRecord,
  PlayerColor,
  PublicRoom,
  Room,
  RoomStore,
  SubmitMoveInput
} from "./types";
import { chessColorToPlayerColor } from "./types";

const ROOM_ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_ID_LENGTH = 6;
const STARTING_FEN = new Chess().fen();

function generateRoomId(): string {
  return Array.from({ length: ROOM_ID_LENGTH }, () => {
    const index = crypto.randomInt(ROOM_ID_ALPHABET.length);
    return ROOM_ID_ALPHABET[index];
  }).join("");
}

function generateToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

function normalizeRoomId(roomId: string): string {
  return roomId.trim().toUpperCase();
}

function playerColorForToken(room: Room, token?: string): PlayerColor | undefined {
  if (!token) {
    return undefined;
  }

  if (token === room.whiteToken) {
    return "white";
  }

  if (token === room.blackToken) {
    return "black";
  }

  return undefined;
}

function classifyGame(chess: Chess): Pick<Room, "status" | "result" | "winner"> {
  if (!chess.isGameOver()) {
    return { status: "active" };
  }

  if (chess.isCheckmate()) {
    return {
      status: "over",
      result: "checkmate",
      winner: chess.turn() === "w" ? "black" : "white"
    };
  }

  if (chess.isStalemate()) {
    return { status: "over", result: "stalemate" };
  }

  if (chess.isThreefoldRepetition()) {
    return { status: "over", result: "threefold-repetition" };
  }

  if (chess.isInsufficientMaterial()) {
    return { status: "over", result: "insufficient-material" };
  }

  if (chess.isDrawByFiftyMoves()) {
    return { status: "over", result: "fifty-move" };
  }

  return { status: "over", result: "draw" satisfies GameResult };
}

function publicRoom(room: Room, playerToken?: string): PublicRoom {
  const chess = new Chess(room.fen);
  const mode = room.mode ?? "multiplayer";

  return {
    id: room.id,
    mode,
    aiColor: room.aiColor,
    fen: room.fen,
    pgn: room.pgn,
    turn: chessColorToPlayerColor(chess.turn()),
    status: room.status,
    result: room.result,
    winner: room.winner,
    players: {
      white: true,
      black: mode === "single-player" ? room.aiColor === "black" : Boolean(room.blackToken)
    },
    moves: room.moves,
    lastMove: room.moves.at(-1),
    playerColor: playerColorForToken(room, playerToken),
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    version: room.version
  };
}

async function requireRoom(store: RoomStore, roomId: string): Promise<Room> {
  const room = await store.getRoom(normalizeRoomId(roomId));
  if (!room) {
    throw new RoomError(404, "room_not_found", "Room not found.");
  }

  return room;
}

function isPromotionMove(chess: Chess, from: Square, to: Square): boolean {
  return chess
    .moves({ square: from, verbose: true })
    .some((move) => move.to === to && move.isPromotion());
}

function toMoveRecord(move: Move, playedAt: number): MoveRecord {
  return {
    color: chessColorToPlayerColor(move.color),
    from: move.from,
    to: move.to,
    san: move.san,
    lan: move.lan,
    piece: move.piece,
    captured: move.captured,
    promotion: move.promotion,
    fen: move.after,
    playedAt
  };
}

export async function createRoom(store: RoomStore): Promise<{
  roomId: string;
  playerToken: string;
  color: PlayerColor;
  room: PublicRoom;
}> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const roomId = generateRoomId();
    const existing = await store.getRoom(roomId);

    if (existing) {
      continue;
    }

    const now = Date.now();
    const playerToken = generateToken();
    const room: Room = {
      id: roomId,
      mode: "multiplayer",
      fen: STARTING_FEN,
      pgn: "",
      whiteToken: playerToken,
      status: "waiting",
      moves: [],
      createdAt: now,
      updatedAt: now,
      version: 1
    };

    await store.setRoom(room);

    return {
      roomId,
      playerToken,
      color: "white",
      room: publicRoom(room, playerToken)
    };
  }

  throw new RoomError(503, "room_id_exhausted", "Could not allocate a room code.");
}

export async function createSinglePlayerRoom(store: RoomStore): Promise<{
  roomId: string;
  playerToken: string;
  color: PlayerColor;
  room: PublicRoom;
}> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const roomId = generateRoomId();
    const existing = await store.getRoom(roomId);

    if (existing) {
      continue;
    }

    const now = Date.now();
    const playerToken = generateToken();
    const room: Room = {
      id: roomId,
      mode: "single-player",
      aiColor: "black",
      fen: STARTING_FEN,
      pgn: "",
      whiteToken: playerToken,
      status: "active",
      moves: [],
      createdAt: now,
      updatedAt: now,
      version: 1
    };

    await store.setRoom(room);

    return {
      roomId,
      playerToken,
      color: "white",
      room: publicRoom(room, playerToken)
    };
  }

  throw new RoomError(503, "room_id_exhausted", "Could not allocate a room code.");
}

export async function joinRoom(
  store: RoomStore,
  roomId: string
): Promise<{
  roomId: string;
  playerToken: string;
  color: PlayerColor;
  room: PublicRoom;
}> {
  const room = await requireRoom(store, roomId);
  const mode = room.mode ?? "multiplayer";

  if (mode === "single-player") {
    throw new RoomError(409, "single_player_room", "Solo rooms cannot be joined.");
  }

  if (room.blackToken) {
    throw new RoomError(409, "room_full", "Room already has two players.");
  }

  const now = Date.now();
  const playerToken = generateToken();
  const updated: Room = {
    ...room,
    mode,
    blackToken: playerToken,
    status: "active",
    updatedAt: now,
    version: room.version + 1
  };

  await store.setRoom(updated);

  return {
    roomId: updated.id,
    playerToken,
    color: "black",
    room: publicRoom(updated, playerToken)
  };
}

export async function getRoom(
  store: RoomStore,
  roomId: string,
  playerToken?: string
): Promise<PublicRoom> {
  const room = await requireRoom(store, roomId);
  return publicRoom(room, playerToken);
}

export async function submitMove(
  store: RoomStore,
  roomId: string,
  input: SubmitMoveInput
): Promise<PublicRoom> {
  const room = await requireRoom(store, roomId);

  if (room.status === "waiting") {
    throw new RoomError(409, "room_waiting", "The room is waiting for a second player.");
  }

  if (room.status === "over") {
    throw new RoomError(409, "game_over", "The game is already over.");
  }

  const playerColor = playerColorForToken(room, input.playerToken);
  if (!playerColor) {
    throw new RoomError(403, "invalid_player", "Player token does not belong to this room.");
  }

  const chess = new Chess(room.fen);
  const expectedColor = chessColorToPlayerColor(chess.turn());
  if (playerColor !== expectedColor) {
    throw new RoomError(409, "wrong_turn", `It is ${expectedColor}'s turn.`);
  }

  const promotion =
    input.promotion ?? (isPromotionMove(chess, input.from, input.to) ? "q" : undefined);

  let move: Move;
  try {
    move = chess.move({
      from: input.from,
      to: input.to,
      ...(promotion ? { promotion } : {})
    });
  } catch {
    throw new RoomError(400, "illegal_move", "Illegal chess move.");
  }

  const playedAt = Date.now();
  const gameState = classifyGame(chess);
  const moveRecords = [toMoveRecord(move, playedAt)];
  let updatedAt = playedAt;
  let finalGameState = gameState;
  const mode = room.mode ?? "multiplayer";

  if (
    mode === "single-player" &&
    room.aiColor &&
    finalGameState.status === "active" &&
    chessColorToPlayerColor(chess.turn()) === room.aiColor
  ) {
    const aiMove = chooseGreedyAiMove(chess);

    if (aiMove) {
      const appliedAiMove = chess.move({
        from: aiMove.from,
        to: aiMove.to,
        ...(aiMove.promotion ? { promotion: aiMove.promotion } : {})
      });
      updatedAt = Date.now();
      moveRecords.push(toMoveRecord(appliedAiMove, updatedAt));
      finalGameState = classifyGame(chess);
    }
  }

  const updated: Room = {
    ...room,
    mode,
    fen: chess.fen(),
    pgn: chess.pgn(),
    status: finalGameState.status,
    result: finalGameState.result,
    winner: finalGameState.winner,
    moves: [...room.moves, ...moveRecords],
    updatedAt,
    version: room.version + moveRecords.length
  };

  await store.setRoom(updated);

  return publicRoom(updated, input.playerToken);
}
