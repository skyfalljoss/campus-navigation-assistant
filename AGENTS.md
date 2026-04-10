# AGENTS.md

## Commands
- `npm run dev` starts both processes: Vite on `http://localhost:3000` and the Express API on `http://localhost:4000`.
- `npm run dev:client` starts only the Vite app; `npm run dev:server` starts only the API.
- `npm run lint` is only `tsc --noEmit`. There is no repo ESLint config.
- `npm run build` builds only the frontend into `dist/`.
- `npm run start` does `prisma migrate deploy` and then runs `tsx server/index.ts`; if you test production locally, build first so the server can serve `dist/index.html`.
- `npm run test:passio` is the only repo test script. It is a live network smoke test against Passio, not a unit test suite.

## Setup And Data
- Required env is defined in `.env.example`: Clerk keys plus `DATABASE_URL` and `DIRECT_URL` for PostgreSQL/Prisma. Map routing also needs `OPENROUTESERVICE_API_KEY`.
- Local setup order in the README is `npm install`, copy `.env`, `npm run prisma:generate`, then `npm run prisma:migrate:dev`.
- Prisma schema is in `prisma/schema.prisma`; schema changes should come with a migration under `prisma/migrations/`.

## Architecture
- This is a single-package app, not a monorepo.
- Frontend entrypoint is `src/main.tsx`; route wiring is in `src/App.tsx`.
- API entrypoint is `server/index.ts`; in production it also serves the built SPA from `dist/` and keeps `/api/*` on the Express side.
- Walking directions are server-side: `POST /api/navigation/route` calls OpenRouteService and routes to `primaryEntrance` points defined in `src/data/buildings.ts`.
- Shared schedule rules live in `src/lib/schedule.ts` and are imported by the server. If schedule days/slots change, update that shared file instead of duplicating constants.
- Frontend API calls are centralized in `src/lib/api.ts`; reuse it for new endpoints so auth/error handling stays consistent.

## Repo-Specific Gotchas
- The default frontend API base URL is same-origin. In dev, Vite proxies `/api` to `http://localhost:4000`; override with `VITE_API_BASE_URL` only when frontend and API are on different origins.
- Vite also supports `VITE_API_PROXY_TARGET` for changing the dev proxy target.
- The TypeScript/Vite alias `@` points to the repo root (`./`), not `src/`.
- `vite.config.ts` intentionally disables HMR when `DISABLE_HMR=true`; do not remove that guard when debugging agent-edit behavior.
