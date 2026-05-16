import { NextResponse } from "next/server";
import { isRoomError } from "./rooms/errors";

export function ok<T>(data: T, status = 200): NextResponse<T> {
  return NextResponse.json(data, { status });
}

export function handleApiError(error: unknown): NextResponse {
  if (isRoomError(error)) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message
        }
      },
      { status: error.status }
    );
  }

  console.error(error);

  return NextResponse.json(
    {
      error: {
        code: "internal_error",
        message: "Unexpected server error."
      }
    },
    { status: 500 }
  );
}
