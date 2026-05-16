# Entering Elysium Online Chess

A Vercel-hosted online chess game with procedural Three.js visuals, room-code multiplayer, legal move validation, and ambient audio.

## Production

- URL: https://enter-elysium.vercel.app
- Vercel project: `enter-elysium`
- GitHub repo: `Ao-99-86/Enter-Elysium`
- Production branch: `main`
- Redis resource: Vercel Marketplace Redis, `enter-elysium-redis`

The production deployment was last verified on May 16, 2026. The smoke test created a room, joined it from a second browser session, activated the game, and submitted the legal move `e2` to `e4`.

## Local Development

```sh
npm install
npm run dev
```

The app runs without Redis locally by using an in-memory room store. Set `REDIS_URL` locally only when you want to test the Redis-backed room store.

## Environment

| Variable | Required | Description |
| --- | --- | --- |
| `REDIS_URL` | Production, Preview, Development on Vercel | Node Redis-compatible connection URL used by `createClient({ url: process.env.REDIS_URL })`. |

No `NEXT_PUBLIC_*` variables are required.

## Vercel Deployment

The deployed project uses these settings:

- Framework: Next.js
- Install command: `npm install`
- Build command: `npm run build`
- Output settings: Vercel's default Next.js settings
- Production branch: `main`

Deployment checklist:

1. Confirm the Vercel project is linked to `Ao-99-86/Enter-Elysium`.
2. Confirm `REDIS_URL` is populated for Production, Preview, and Development.
3. Deploy production from `main`.
4. Verify the deployment builds successfully.
5. Smoke test the production URL by creating a room, joining from another browser session, and submitting a legal move.

If `REDIS_URL` changes after a failed deployment, redeploy production so the new environment value is included.

## Scripts

- `npm run dev`: local development server.
- `npm run build`: production build.
- `npm run typecheck`: TypeScript check.
- `npm test`: unit and API integration tests.
