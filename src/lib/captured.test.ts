import { describe, expect, it } from "vitest";
import type { MoveRecord } from "@/lib/rooms/types";
import { getCapturedPieces, glyphForCaptured, orderedCaptures } from "./captured";

function move(partial: Partial<MoveRecord>): MoveRecord {
  return {
    color: "white",
    from: "e2",
    to: "e4",
    san: "e4",
    lan: "e2e4",
    piece: "p",
    fen: "",
    playedAt: 0,
    ...partial
  };
}

describe("getCapturedPieces", () => {
  it("returns empty buckets when there are no moves", () => {
    expect(getCapturedPieces([])).toEqual({ white: {}, black: {} });
  });

  it("ignores non-capturing moves", () => {
    expect(getCapturedPieces([move({})])).toEqual({ white: {}, black: {} });
  });

  it("attributes captures to the capturing colour", () => {
    const moves: MoveRecord[] = [
      move({ color: "white", captured: "p" }),
      move({ color: "white", captured: "n" }),
      move({ color: "black", captured: "p" }),
      move({ color: "white", captured: "p" })
    ];

    expect(getCapturedPieces(moves)).toEqual({
      white: { p: 2, n: 1 },
      black: { p: 1 }
    });
  });
});

describe("orderedCaptures", () => {
  it("orders queen → pawn and drops zero counts", () => {
    expect(orderedCaptures({ p: 3, q: 1, n: 0, r: 2 })).toEqual([
      { piece: "q", count: 1 },
      { piece: "r", count: 2 },
      { piece: "p", count: 3 }
    ]);
  });
});

describe("glyphForCaptured", () => {
  it("renders the captured piece in the colour that lost it", () => {
    expect(glyphForCaptured("white", "q")).toBe("♛");
    expect(glyphForCaptured("black", "q")).toBe("♕");
  });
});
