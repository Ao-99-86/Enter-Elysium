# Claude Code Guide

## Project Snapshot

Entering Elysium is a Next.js 16 online chess app with a client-side React Three Fiber chess scene and a compact side-panel control surface. Multiplayer and solo games use room APIs under `src/app/api/rooms`, while chess legality, game results, and solo AI replies are enforced server-side through `chess.js` in `src/lib/rooms/service.ts`.

Production uses Redis through `REDIS_URL`. Local development intentionally works without Redis by falling back to the in-memory room store. Do not add `NEXT_PUBLIC_*` environment variables unless client code truly needs them.

## Commands

- `npm install`: install dependencies.
- `npm run dev`: start the Next development server.
- `npm run build`: create a production build.
- `npm run typecheck`: run TypeScript checking.
- `npm test`: run the Vitest suite once.
- `npm run test:watch`: run Vitest in watch mode.

## Key Files

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

## Implementation Rules

- Keep chess legality and game-result logic in `src/lib/rooms/service.ts`; the client must not be the source of truth for legal moves.
- Use `chess.js` APIs for legal moves, FEN, PGN, check, checkmate, draw, and promotion behavior.
- Preserve the `Room` and `PublicRoom` split. Never expose player tokens through `PublicRoom`.
- Keep API route handlers on `export const runtime = "nodejs"` because Redis may be used.
- Follow the current route-handler shape where dynamic `params` are awaited promises.
- Normalize room IDs to uppercase and keep store keys uppercase.
- Keep solo AI deterministic unless intentionally changing tests and UX.
- Keep browser-only Three.js and Web Audio behavior out of server components. The scene is dynamically imported with `ssr: false`.
- Avoid unrelated refactors. This repo is small; prefer direct, local changes that match the existing style.

## Frontend And Scene Guidance

- Match the existing dense game-tool UI: full-screen scene region, right-side panel, dark glass styling, compact controls, and 7px radii.
- Do not replace chess or Three.js behavior with decorative-only UI. The board must stay playable on pointer and touch devices.
- Use lucide icons when adding controls, consistent with the current UI.
- Keep text compact inside controls and panels. Do not add marketing sections to the first screen.
- When changing scene rendering, verify the canvas still renders on desktop and mobile sizes and that board clicks map to the correct squares for both player perspectives.

## Testing Guidance

- Run `npm run typecheck` after TypeScript, React, scene, or route-handler changes.
- Run `npm test` after room, service, AI, API, or chess behavior changes.
- For visual or interaction changes, run `npm run dev` and verify the page in a browser with the local memory store.
- Use Redis locally only when explicitly testing Redis behavior.

## Deployment Notes

- Production URL: `https://enter-elysium.vercel.app`.
- GitHub repo: `Ao-99-86/Enter-Elysium`.
- Production branch: `main`.
- Vercel must have `REDIS_URL` set for Production, Preview, and Development environments.
- If `REDIS_URL` changes after a failed deployment, redeploy so the new environment value is included.

## Collaboration Notes

- There may be existing uncommitted work in the tree. Do not revert changes you did not make.
- Screenshot and browser verification artifacts are ignored by `.gitignore`.
- `gh` authentication works outside the sandbox. If a sandboxed `gh` command reports an invalid token or cannot reach GitHub, rerun it with the appropriate permission/escalation.
