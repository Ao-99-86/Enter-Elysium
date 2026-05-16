import { handleApiError, ok } from "@/lib/api";
import { joinRoom } from "@/lib/rooms/service";
import { getRoomStore } from "@/lib/rooms/store";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    roomId: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { roomId } = await context.params;
    const result = await joinRoom(getRoomStore(), roomId);
    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
