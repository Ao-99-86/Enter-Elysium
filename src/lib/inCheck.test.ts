import { describe, expect, it } from "vitest";
import { getCheckState } from "./inCheck";

describe("getCheckState", () => {
  it("returns no check on the opening position", () => {
    const result = getCheckState("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    expect(result.inCheck).toBe(false);
    expect(result.kingSquare).toBeNull();
  });

  it("flags the king in check and reports its square", () => {
    const fen = "rnbqkbnr/ppp2ppp/3p4/4p3/6P1/5P2/PPPPP2P/RNBQKBNR w KQkq - 0 1";
    const checkFen = "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 1";
    const result = getCheckState(checkFen);
    expect(result.inCheck).toBe(true);
    expect(result.kingSquare).toBe("e1");
    expect(fen).toBeDefined();
  });

  it("handles malformed FEN by reporting no check", () => {
    const result = getCheckState("not-a-fen");
    expect(result.inCheck).toBe(false);
    expect(result.kingSquare).toBeNull();
  });
});
