import { handleApiError, ok } from "@/lib/api";
import {
  createSinglePlayerRoom,
  type SoloColorChoice
} from "@/lib/rooms/service";
import { getRoomStore } from "@/lib/rooms/store";

export const runtime = "nodejs";

const COLOR_CHOICES: ReadonlySet<SoloColorChoice> = new Set([
  "white",
  "black",
  "random"
]);

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const color = parseColor(body);
    const result = await createSinglePlayerRoom(getRoomStore(), { color });
    return ok(result, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

async function readBody(request: Request): Promise<unknown> {
  try {
    const text = await request.text();
    if (!text) {
      return null;
    }
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function parseColor(body: unknown): SoloColorChoice | undefined {
  if (!body || typeof body !== "object") {
    return undefined;
  }

  const value = (body as { color?: unknown }).color;
  if (typeof value !== "string") {
    return undefined;
  }

  return COLOR_CHOICES.has(value as SoloColorChoice)
    ? (value as SoloColorChoice)
    : undefined;
}
