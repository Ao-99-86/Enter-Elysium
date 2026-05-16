import { createClient, type RedisClientType } from "redis";
import type { Room, RoomStore } from "./types";
import { ROOM_TTL_SECONDS } from "./types";

const globalRedis = globalThis as typeof globalThis & {
  __enterElysiumRedis?: RedisClientType;
};

async function getRedisClient(): Promise<RedisClientType> {
  if (!process.env.REDIS_URL) {
    throw new Error("REDIS_URL is required for the Redis room store.");
  }

  if (!globalRedis.__enterElysiumRedis) {
    globalRedis.__enterElysiumRedis = createClient({
      url: process.env.REDIS_URL
    }) as RedisClientType;

    globalRedis.__enterElysiumRedis.on("error", (error) => {
      console.error("Redis connection error", error);
    });
  }

  if (!globalRedis.__enterElysiumRedis.isOpen) {
    await globalRedis.__enterElysiumRedis.connect();
  }

  return globalRedis.__enterElysiumRedis;
}

function key(roomId: string): string {
  return `enter-elysium:room:${roomId.toUpperCase()}`;
}

export function createRedisRoomStore(): RoomStore {
  return {
    async getRoom(roomId) {
      const client = await getRedisClient();
      const encoded = await client.get(key(roomId));
      return encoded ? (JSON.parse(encoded) as Room) : null;
    },
    async setRoom(room) {
      const client = await getRedisClient();
      await client.setEx(key(room.id), ROOM_TTL_SECONDS, JSON.stringify(room));
    }
  };
}
