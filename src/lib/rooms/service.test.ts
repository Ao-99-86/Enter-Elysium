import { beforeEach, describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { createMemoryRoomStore, resetMemoryRoomStore } from "./memory-store";
import {
  createRoom,
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
