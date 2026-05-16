import type { Room, RoomStore } from "./types";

const globalRooms = globalThis as typeof globalThis & {
  __enterElysiumRooms?: Map<string, Room>;
};

function rooms(): Map<string, Room> {
  if (!globalRooms.__enterElysiumRooms) {
    globalRooms.__enterElysiumRooms = new Map();
  }

  return globalRooms.__enterElysiumRooms;
}

function cloneRoom(room: Room): Room {
  return structuredClone(room);
}

export function createMemoryRoomStore(): RoomStore {
  return {
    async getRoom(roomId) {
      const room = rooms().get(roomId.toUpperCase());
      return room ? cloneRoom(room) : null;
    },
    async setRoom(room) {
      rooms().set(room.id.toUpperCase(), cloneRoom(room));
    }
  };
}

export function resetMemoryRoomStore(): void {
  rooms().clear();
}
