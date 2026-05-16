import { createMemoryRoomStore } from "./memory-store";
import { createRedisRoomStore } from "./redis-store";
import type { RoomStore } from "./types";

let store: RoomStore | null = null;

export function getRoomStore(): RoomStore {
  if (store) {
    return store;
  }

  if (process.env.REDIS_URL) {
    store = createRedisRoomStore();
    return store;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("REDIS_URL is required in production.");
  }

  store = createMemoryRoomStore();
  return store;
}
