import { createRoom } from "@/lib/rooms/service";
import { getRoomStore } from "@/lib/rooms/store";
import { handleApiError, ok } from "@/lib/api";

export const runtime = "nodejs";

export async function POST() {
  try {
    const result = await createRoom(getRoomStore());
    return ok(result, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
