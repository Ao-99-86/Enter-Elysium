import { handleApiError, ok } from "@/lib/api";
import { createSinglePlayerRoom } from "@/lib/rooms/service";
import { getRoomStore } from "@/lib/rooms/store";

export const runtime = "nodejs";

export async function POST() {
  try {
    const result = await createSinglePlayerRoom(getRoomStore());
    return ok(result, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
