# Entering Elysium Online Chess

A Vercel-hosted online chess game with procedural Three.js visuals, room-code multiplayer, legal move validation, and ambient audio.

## Local Development

```sh
npm install
npm run dev
```

The app runs without Redis locally by using an in-memory room store. Production deployments require `REDIS_URL`.

## Vercel Deployment

1. Create a Vercel project from this repo.
2. Add a Redis database from the Vercel Marketplace.
3. Ensure `REDIS_URL` is available to the project.
4. Deploy with the default Next.js settings.

## Scripts

- `npm run dev`: local development server.
- `npm run build`: production build.
- `npm run typecheck`: TypeScript check.
- `npm test`: unit and API integration tests.
