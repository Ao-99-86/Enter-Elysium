# Repository Guidelines

## Project Overview

Entering Elysium is a Next.js 16 online chess app. The main UI is a client-side Three.js chess scene with a side-panel control surface. Multiplayer and solo games are backed by room APIs under `src/app/api/rooms`, with chess rules enforced by `chess.js` in `src/lib/rooms/service.ts`.

Production uses Redis through `REDIS_URL`; local development falls back to an in-memory room store when `REDIS_URL` is unset. Do not add `NEXT_PUBLIC_*` environment requirements unless the client truly needs them.

## Common Commands

- `npm install`: install dependencies.
- `npm run dev`: start the local Next development server.
- `npm run build`: create a production build.
- `npm run typecheck`: run TypeScript checking.
- `npm test`: run the Vitest suite once.
- `npm run test:watch`: run Vitest in watch mode.

## Code Organization

- `src/app/page.tsx`: renders `GameShell`.
- `src/components/GameShell.tsx`: client state, room/session lifecycle, polling, audio controls, move submission, and side-panel UI.
- `src/components/ElysiumScene.tsx`: React Three Fiber board, pieces, shaders, animation, camera, and square interaction.
- `src/app/api/rooms/**/route.ts`: Node runtime API route handlers.
- `src/lib/rooms/service.ts`: room creation, joining, public room shaping, move validation, game state classification, and solo AI replies.
- `src/lib/rooms/ai.ts`: deterministic greedy solo AI move choice.
- `src/lib/rooms/types.ts`: shared room and move types.
- `src/lib/rooms/store.ts`: chooses Redis or memory store.
- `src/lib/rooms/memory-store.ts`: local/test in-memory store.
- `src/lib/rooms/redis-store.ts`: Redis store with room TTL.
- `src/lib/rooms/service.test.ts`: service and AI coverage.

## Implementation Notes

- Keep chess legality and game result logic in `src/lib/rooms/service.ts`; the client should not be the source of truth for valid moves.
- Use `chess.js` APIs for move generation, FEN, PGN, checkmate, draw, and promotion behavior instead of hand-rolling chess rules.
- Preserve the public/private split between `Room` and `PublicRoom`; never expose player tokens through `PublicRoom`.
- Route handlers use `export const runtime = "nodejs"` because the room store can use Redis.
- Dynamic route `params` are awaited promises in the current Next route files. Follow the existing route-handler shape.
- Room IDs are normalized to uppercase. Keep store keys uppercase and avoid introducing case-sensitive room lookup behavior.
- The memory store uses `globalThis` so local hot reload and tests can share room state; tests call `resetMemoryRoomStore()`.
- Solo AI currently plays black automatically after the human move if the game is still active. Keep AI behavior deterministic unless intentionally changing tests and UX.
- `GameShell` stores the session in `localStorage` under `enter-elysium-session` and mirrors the room code in the URL query.
- The scene component is dynamically imported with `ssr: false`; keep browser-only Three.js/Web Audio behavior out of server components.

## Frontend Style

- Match the existing dense game-tool UI: full-screen scene region plus right-side panel, 7px radius controls, lucide icons, and dark glass styling.
- Avoid replacing chess or Three.js behavior with decorative-only UI. Interaction should remain playable on pointer and touch devices.
- When changing scene rendering, verify the canvas still renders on desktop and mobile sizes and that board clicks map to the correct squares for both perspectives.
- Keep text compact inside controls and panels. Do not add marketing-style sections to the first screen.

## Testing Guidance

- For service, room, AI, or API behavior changes, add or update Vitest coverage in `src/lib/rooms/service.test.ts` or nearby tests.
- Run `npm test` after chess/service changes.
- Run `npm run typecheck` after TypeScript or route-handler changes.
- For visual or interaction changes, run the dev server and verify the page in a browser. Use local memory store unless explicitly testing Redis.

## Deployment Notes

- Production branch is `main`; deployed app is `https://enter-elysium.vercel.app`.
- Vercel must have `REDIS_URL` set for Production, Preview, and Development environments.
- If `REDIS_URL` changes after a failed deployment, redeploy so the new environment value is included.
