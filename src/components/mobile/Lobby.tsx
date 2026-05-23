"use client";

import { Bot, LogIn, Plus, X } from "lucide-react";
import { type FormEvent, useState } from "react";
import { normalizeRoomCode } from "@/lib/useGameShellState";
import styles from "./Mobile.module.css";

const STARTING_BOARD: string[] = [
  "rnbqkbnr",
  "pppppppp",
  "........",
  "........",
  "........",
  "........",
  "PPPPPPPP",
  "RNBQKBNR"
];

const WHITE_GLYPHS: Record<string, string> = {
  K: "♔",
  Q: "♕",
  R: "♖",
  B: "♗",
  N: "♘",
  P: "♙"
};

const BLACK_GLYPHS: Record<string, string> = {
  k: "♚",
  q: "♛",
  r: "♜",
  b: "♝",
  n: "♞",
  p: "♟"
};

function pieceGlyph(char: string): string {
  if (char === ".") {
    return "";
  }
  return char === char.toUpperCase()
    ? WHITE_GLYPHS[char] ?? ""
    : BLACK_GLYPHS[char] ?? "";
}

export type LobbyProps = {
  busy: boolean;
  error: string | null;
  joinCode: string;
  setJoinCode: (value: string) => void;
  onSolo: () => void;
  onCreate: () => void;
  onJoin: (event?: FormEvent) => void;
};

export function Lobby({
  busy,
  error,
  joinCode,
  setJoinCode,
  onSolo,
  onCreate,
  onJoin
}: LobbyProps) {
  const [joinOpen, setJoinOpen] = useState(false);

  return (
    <div className={styles.lobby}>
      <div className={styles.lobbyHeader}>
        <span className={styles.lobbyKicker}>Online Chess</span>
        <h1 className={styles.lobbyTitle}>
          Entering
          <br />
          Elysium
        </h1>
      </div>

      <div className={styles.lobbyBoardWrap}>
        <div className={styles.lobbyBoard} aria-hidden="true">
          {STARTING_BOARD.flatMap((rank, rankIndex) =>
            rank.split("").map((piece, fileIndex) => {
              const isLight = (rankIndex + fileIndex) % 2 === 0;
              return (
                <div
                  className={
                    isLight ? styles.lobbySquareLight : styles.lobbySquareDark
                  }
                  key={`${rankIndex}-${fileIndex}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily:
                      "'Segoe UI Symbol', 'DejaVu Sans', 'Apple Symbols', sans-serif",
                    fontSize: "26px",
                    color: piece === piece.toUpperCase()
                      ? "#f6efdc"
                      : "#181a1d",
                    textShadow: piece === piece.toUpperCase()
                      ? "0 2px 6px rgba(0,0,0,0.55)"
                      : "0 2px 6px rgba(0,0,0,0.35)"
                  }}
                >
                  {pieceGlyph(piece)}
                </div>
              );
            })
          )}
        </div>
        <div className={styles.lobbyBoardReflection} />
      </div>

      {joinOpen ? (
        <form
          className={styles.lobbyActions}
          onSubmit={(event) => {
            event.preventDefault();
            onJoin(event);
          }}
        >
          <input
            aria-label="Room code"
            autoFocus
            className={styles.lobbyJoinInput}
            inputMode="text"
            maxLength={8}
            onChange={(event) =>
              setJoinCode(normalizeRoomCode(event.target.value))
            }
            placeholder="CODE"
            value={joinCode}
          />
          <div className={styles.lobbySecondaryRow}>
            <button
              className={styles.lobbySecondary}
              onClick={() => setJoinOpen(false)}
              type="button"
            >
              <X size={16} />
              Cancel
            </button>
            <button
              className={styles.lobbyPrimary}
              disabled={busy || joinCode.length === 0}
              type="submit"
            >
              <LogIn size={16} />
              Join
            </button>
          </div>
          {error ? <p className={styles.lobbyError}>{error}</p> : null}
        </form>
      ) : (
        <div className={styles.lobbyActions}>
          <button
            className={styles.lobbyPrimary}
            disabled={busy}
            onClick={onSolo}
            type="button"
          >
            <Bot size={18} />
            Play vs AI Elysium
          </button>
          <div className={styles.lobbySecondaryRow}>
            <button
              className={styles.lobbySecondary}
              disabled={busy}
              onClick={onCreate}
              type="button"
            >
              <Plus size={16} />
              New room
            </button>
            <button
              className={styles.lobbySecondary}
              disabled={busy}
              onClick={() => setJoinOpen(true)}
              type="button"
            >
              <LogIn size={16} />
              Join
            </button>
          </div>
          {error ? <p className={styles.lobbyError}>{error}</p> : null}
        </div>
      )}
    </div>
  );
}
