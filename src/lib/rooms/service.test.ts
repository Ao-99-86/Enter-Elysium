import { beforeEach, describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { chooseGreedyAiMove } from "./ai";
import { createMemoryRoomStore, resetMemoryRoomStore } from "./memory-store";
import {
  createRoom,
  createSinglePlayerRoom,
  getRoom,
  joinRoom,
  submitMove
} from "./service";
import type { Room, RoomStore } from "./types";

let store: RoomStore;

beforeEach(() => {
  resetMemoryRoomStore();
  store = createMemoryRoomStore();
});

async function createActiveRoom() {
  const created = await createRoom(store);
  const joined = await joinRoom(store, created.roomId);

  return {
    roomId: created.roomId,
    whiteToken: created.playerToken,
    blackToken: joined.playerToken
  };
}

async function seedRoom(room: Partial<Room> & Pick<Room, "id" | "whiteToken">): Promise<Room> {
  const now = Date.now();
  const seeded: Room = {
    mode: "multiplayer",
    fen: new Chess().fen(),
    pgn: "",
    blackToken: "black-token",
    status: "active",
    moves: [],
    createdAt: now,
    updatedAt: now,
    version: 1,
    ...room
  };

  await store.setRoom(seeded);
  return seeded;
}

describe("rooms service", () => {
  it("creates and joins a room", async () => {
    const created = await createRoom(store);
    expect(created.color).toBe("white");
    expect(created.room.players).toEqual({ white: true, black: false });
    expect(created.room.status).toBe("waiting");

    const joined = await joinRoom(store, created.roomId);
    expect(joined.color).toBe("black");
    expect(joined.room.players).toEqual({ white: true, black: true });
    expect(joined.room.status).toBe("active");
  });

  it("creates an active solo room against black AI", async () => {
    const created = await createSinglePlayerRoom(store);

    expect(created.color).toBe("white");
    expect(created.room.mode).toBe("single-player");
    expect(created.room.aiColor).toBe("black");
    expect(created.room.players).toEqual({ white: true, black: true });
    expect(created.room.status).toBe("active");
    expect(created.room.turn).toBe("white");
  });

  it("rejects joining solo rooms", async () => {
    const created = await createSinglePlayerRoom(store);

    await expect(joinRoom(store, created.roomId)).rejects.toMatchObject({
      status: 409,
      code: "single_player_room"
    });
  });

  it("plays an AI response after a solo human move", async () => {
    const created = await createSinglePlayerRoom(store);
    const room = await submitMove(store, created.roomId, {
      from: "e2",
      to: "e4",
      playerToken: created.playerToken
    });

    expect(room.mode).toBe("single-player");
    expect(room.turn).toBe("white");
    expect(room.moves).toHaveLength(2);
    expect(room.moves[0].color).toBe("white");
    expect(room.moves[1].color).toBe("black");
  });

  it("chooses a valuable capture for the solo AI", async () => {
    await seedRoom({
      id: "AICAP1",
      mode: "single-player",
      aiColor: "black",
      whiteToken: "white-token",
      blackToken: undefined,
      fen: "k7/8/8/4b3/3Q4/8/4P3/7K w - - 0 1"
    });

    const room = await submitMove(store, "AICAP1", {
      from: "e2",
      to: "e3",
      playerToken: "white-token"
    });

    expect(room.moves).toHaveLength(2);
    expect(room.lastMove).toMatchObject({
      color: "black",
      from: "e5",
      to: "d4",
      captured: "q"
    });
  });

  it("chooses checkmate when the AI has one", () => {
    const chess = new Chess();
    chess.move("f3");
    chess.move("e5");
    chess.move("g4");

    const move = chooseGreedyAiMove(chess);

    expect(move?.san).toBe("Qh4#");
  });

  it("returns player color when reconnecting with a token", async () => {
    const active = await createActiveRoom();
    const room = await getRoom(store, active.roomId, active.blackToken);
    expect(room.playerColor).toBe("black");
  });

  it("accepts a legal move and records it", async () => {
    const active = await createActiveRoom();
    const room = await submitMove(store, active.roomId, {
      from: "e2",
      to: "e4",
      playerToken: active.whiteToken
    });

    expect(room.turn).toBe("black");
    expect(room.lastMove?.san).toBe("e4");
    expect(room.moves).toHaveLength(1);
  });

  it("rejects wrong-turn moves", async () => {
    const active = await createActiveRoom();
    await expect(
      submitMove(store, active.roomId, {
        from: "e7",
        to: "e5",
        playerToken: active.blackToken
      })
    ).rejects.toMatchObject({ status: 409, code: "wrong_turn" });
  });

  it("rejects illegal moves", async () => {
    const active = await createActiveRoom();
    await expect(
      submitMove(store, active.roomId, {
        from: "e2",
        to: "e5",
        playerToken: active.whiteToken
      })
    ).rejects.toMatchObject({ status: 400, code: "illegal_move" });
  });

  it("detects checkmate", async () => {
    const active = await createActiveRoom();

    await submitMove(store, active.roomId, {
      from: "f2",
      to: "f3",
      playerToken: active.whiteToken
    });
    await submitMove(store, active.roomId, {
      from: "e7",
      to: "e5",
      playerToken: active.blackToken
    });
    await submitMove(store, active.roomId, {
      from: "g2",
      to: "g4",
      playerToken: active.whiteToken
    });
    const mate = await submitMove(store, active.roomId, {
      from: "d8",
      to: "h4",
      playerToken: active.blackToken
    });

    expect(mate.status).toBe("over");
    expect(mate.result).toBe("checkmate");
    expect(mate.winner).toBe("black");
  });

  it("defaults promotion to queen", async () => {
    await seedRoom({
      id: "PROMO1",
      whiteToken: "white-token",
      fen: "8/P7/8/8/8/8/8/k6K w - - 0 1"
    });

    const room = await submitMove(store, "PROMO1", {
      from: "a7",
      to: "a8",
      playerToken: "white-token"
    });

    expect(room.lastMove?.promotion).toBe("q");
    expect(room.lastMove?.san).toContain("=Q");
  });

  it("reports missing rooms", async () => {
    await expect(getRoom(store, "MISSING")).rejects.toMatchObject({
      status: 404,
      code: "room_not_found"
    });
  });
});
