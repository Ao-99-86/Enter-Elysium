import type { NextRequest } from "next/server";
import { handleApiError, ok } from "@/lib/api";
import { getRoom } from "@/lib/rooms/service";
import { getRoomStore } from "@/lib/rooms/store";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    roomId: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { roomId } = await context.params;
    const playerToken = request.nextUrl.searchParams.get("playerToken") ?? undefined;
    const room = await getRoom(getRoomStore(), roomId, playerToken);
    return ok(room);
  } catch (error) {
    return handleApiError(error);
  }
}
