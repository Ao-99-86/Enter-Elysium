import { handleApiError, ok } from "@/lib/api";
import { submitMove } from "@/lib/rooms/service";
import { getRoomStore } from "@/lib/rooms/store";
import type { SubmitMoveInput } from "@/lib/rooms/types";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    roomId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { roomId } = await context.params;
    const body = (await request.json()) as SubmitMoveInput;
    const room = await submitMove(getRoomStore(), roomId, body);
    return ok(room);
  } catch (error) {
    return handleApiError(error);
  }
}
