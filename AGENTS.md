# AGENTS.md

## Purpose
- This file is the canonical repository guidance for coding agents working in this project.
- It applies at the repo root: `C:\Users\skyfa\OneDrive - University of South Florida\Desktop\project\campus-navigation-assistant`.
- No Cursor rules were found in `.cursor/rules/` or `.cursorrules`.
- No Copilot instructions were found in `.github/copilot-instructions.md`.
- If editor-specific rule files are later added, update this file to mirror any repo-level guidance that agents must follow.

## Project Snapshot
- Single-package TypeScript app; not a monorepo.
- Frontend: React 19 + Vite + Tailwind CSS v4.
- Backend: Express + Prisma + PostgreSQL.
- Auth: Clerk on both client and server.
- Maps: Leaflet on the client; OpenRouteService for walking directions.
- Shuttle data: Passio.
- E2E tests: Playwright.

## Environment And Setup
- Use Node.js 20+ and npm.
- Install dependencies with `npm install`.
- Copy `.env.example` to `.env` before running the app.
- Required env includes Clerk keys plus `DATABASE_URL` and `DIRECT_URL`.
- Walking route generation also needs `OPENROUTESERVICE_API_KEY`.
- Generate Prisma client with `npm run prisma:generate`.
- Apply local migrations with `npm run prisma:migrate:dev`.

## Build, Run, Lint, And Test Commands
- `npm run dev`: starts both the Express API and the Vite frontend.
- `npm run dev:client`: starts only the Vite app on `http://localhost:3000`.
- `npm run dev:client:e2e`: starts the frontend in `e2e` mode for Playwright.
- `npm run dev:server`: starts only the API on `http://localhost:4000`.
- `npm run build`: builds the frontend into `dist/`.
- `npm run preview`: previews the built frontend.
- `npm run start`: runs `prisma migrate deploy` and then starts the production server.
- `npm run start:server`: starts the production server process directly.
- `npm run clean`: removes `dist/`.
- `npm run lint`: runs `tsc --noEmit`; there is no ESLint config in this repo.

## Testing Commands
- `npm run test:e2e`: runs the full Playwright suite.
- `npm run test:e2e:headed`: runs the full Playwright suite in headed mode.
- `npm run test:e2e:install`: installs Playwright browsers locally.
- `npm run test:load:health`: runs an `autocannon` load check against `/api/health`.
- `npm run test:passio`: runs the live Passio smoke test.
- There is no unit-test runner configured in `package.json`.
- There is no Vitest/Jest setup to support single unit-test execution.

## Running A Single Test
- Single Playwright file: `npm run test:e2e -- tests/e2e/map.spec.ts`
- Single Playwright file in a single browser: `npm run test:e2e -- --project=chromium tests/e2e/map.spec.ts`
- Single Playwright test by title: `npm run test:e2e -- -g "searches for a building and drills into a room"`
- Headed single-file Playwright run: `npm run test:e2e:headed -- tests/e2e/map.spec.ts`
- Direct Playwright equivalent: `npx playwright test tests/e2e/map.spec.ts --project=chromium`
- Mobile-only tests can be targeted with `npm run test:e2e -- --project=mobile-chrome`
- The E2E suite auto-starts `npm run dev:client:e2e`; it does not require the Express API.
- Load test target can be overridden with `LOAD_TEST_URL`.
- Load test tuning can be overridden with `LOAD_TEST_CONNECTIONS`, `LOAD_TEST_DURATION`, and `LOAD_TEST_PIPELINING`.
- Passio smoke test accepts `--system=<id>` and `--raw`, for example: `npm run test:passio -- --system=2343 --raw`

## CI Notes
- GitHub Actions runs `npm ci`, `npx playwright install --with-deps`, and `npm run test:e2e`.
- Playwright artifacts are written to `playwright-report/`, `playwright-results.xml`, and `test-results/`.

## Architecture
- Frontend entrypoint: `src/main.tsx`.
- Route wiring: `src/App.tsx`.
- Shared app layout: `src/components/Layout.tsx`.
- Primary pages live under `src/pages/`.
- Frontend API helpers are centralized in `src/lib/api.ts`.
- Server entrypoint: `server/index.ts`.
- Prisma client singleton: `server/prisma.ts`.
- Navigation logic and OpenRouteService integration: `server/navigation.ts`.
- Shuttle normalization and Passio access: `server/passio.ts`.
- Shared schedule rules live in `src/lib/schedule.ts`; keep server and client logic aligned there.
- Building and room metadata live in `src/data/buildings.ts`.
- In production the Express server serves `dist/index.html` for the SPA.
- In development Vite proxies `/api` to the backend by default.
- The Vite alias `@/*` points to the repo root, not `src/`.

## Testing Structure
- E2E specs live in `tests/e2e/`.
- Page objects live in `tests/pages/`.
- Reusable mocked auth and network helpers live in `tests/fixtures/` and `tests/mocks/`.
- Mobile-specific specs use the `@mobile` tag and run in the `mobile-chrome` project.
- The E2E suite mocks Clerk and API traffic so it stays independent from Prisma, Passio, and OpenRouteService.

## Code Style: General
- Write TypeScript using ESM imports/exports.
- Use semicolons.
- Prefer double quotes, as that is the dominant style in the repo.
- Preserve surrounding file style if a file already differs in minor formatting details.
- Prefer small, direct functions over abstraction-heavy helpers.
- Keep logic close to where it is used unless it is clearly shared.
- Use guard clauses and early returns to keep control flow flat.
- Keep comments rare and purposeful; most files are largely self-documenting.
- Do not add new tooling config unless the user asks for it.

## Code Style: Imports
- Group imports with external packages first, then local imports.
- Keep one blank line between external and local import groups when the file already does so.
- Use inline `type` specifiers when importing both runtime values and types from the same module.
- Use `import type` when a statement is type-only, especially in tests.
- Prefer relative imports within `src/`, `server/`, and `tests/`; the repo rarely uses the `@/` alias today.
- Do not reorder imports gratuitously in untouched sections of a large file.

## Code Style: Types And Data Modeling
- Do not use `any` unless absolutely unavoidable.
- Prefer `unknown` for untrusted inputs, then narrow explicitly.
- Use `interface` for shared object shapes and API records.
- Use union string literals for constrained states such as theme or schedule day values.
- Use tuple types for coordinates, for example `[number, number]`.
- Use `satisfies` for literal objects when you want validation without widening.
- Keep simple prop types inline; extract an interface when the shape is reused or large.
- Use explicit return types when they improve clarity at module boundaries.

## Code Style: Naming
- Components, classes, and exported type names use `PascalCase`.
- Functions, variables, and non-constant helpers use `camelCase`.
- Constants use `UPPER_SNAKE_CASE` when they are true constants or storage keys.
- Prefix booleans with `is`, `has`, `should`, or `can`.
- Page components typically use a `*Page` name even when the filename is shorter, for example `MapPage` in `src/pages/Map.tsx`.
- API response and persistence DTOs commonly use the `*Record` suffix.

## Code Style: React Frontend
- Use function components only.
- Keep hooks at the top level of the component.
- Prefer local state and derived values over premature extraction to custom hooks.
- Check `typeof window !== "undefined"` before using browser-only APIs during initialization.
- Use `useEffect` for browser sync work such as local storage, permissions, and DOM observers.
- Avoid introducing `useCallback` or `useMemo` unless they are clearly justified or already fit the local pattern.
- Follow existing route/page export style: page modules usually default-export the main component.
- Reuse `src/lib/api.ts` for frontend API calls instead of scattering `fetch` calls across pages.
- Use `cn()` from `src/lib/utils.ts` for conditional Tailwind class composition when needed.

## Code Style: Express And Server
- Add new API routes in `server/index.ts` unless there is a strong reason to split them.
- Wrap async route handlers with the local `asyncHandler` helper.
- Validate request inputs early and return with a clear 4xx error message.
- Return JSON error payloads as `{ error: string }`.
- Reuse shared validators from `src/lib/` when the same rules apply on client and server.
- Normalize external API responses before returning them to the client.
- Prefer `randomUUID()` or Prisma-generated IDs over hand-rolled identifiers.
- Keep response shapes aligned with the types exported from `src/lib/api.ts`.

## Code Style: Error Handling
- Throw `Error` objects with actionable messages.
- Catch errors when you can translate them into a better user-facing or HTTP-facing message.
- Do not swallow errors silently.
- For expected recoverable UI failures, degrade gracefully and log only when the failure is non-blocking.
- On the server, map domain-specific failures to the right HTTP status code, as done with `NavigationError`.
- In scripts, print a useful message and set `process.exitCode = 1` on failure.

## Code Style: Prisma And Data Access
- Use the shared Prisma client from `server/prisma.ts`.
- Keep database access inside the server layer.
- Preserve existing ordering patterns such as `orderBy: { updatedAt: "desc" }` when extending list endpoints.
- Schema changes belong in `prisma/schema.prisma` and should ship with a migration under `prisma/migrations/`.

## Code Style: Testing
- Prefer Playwright locators based on accessibility roles, labels, placeholder text, and visible text.
- Reuse the existing page-object pattern for multi-step E2E flows.
- Mock external map tiles, Clerk auth, and API responses instead of depending on live services in E2E.
- Keep tests deterministic and independent from the production database.
- When changing UI flows, update page objects first if that reduces duplication.

## Repo-Specific Gotchas
- `npm run build` builds only the frontend; it does not bundle the server.
- `npm run start` expects `dist/` to exist if you want the server to serve the SPA locally.
- `npm run lint` is only a TypeScript compile check.
- The frontend defaults to same-origin API calls; override `VITE_API_BASE_URL` only when needed.
- Vite proxy target can be overridden with `VITE_API_PROXY_TARGET`.
- `vite.config.ts` intentionally supports disabling HMR with `DISABLE_HMR=true`; do not remove that behavior casually.
- Walking directions route to `primaryEntrance` data from `src/data/buildings.ts`.

## Agent Workflow Expectations
- Make the smallest correct change.
- Do not invent new architectural layers without a clear need.
- Match existing naming, file placement, and response shapes.
- Verify changes with `npm run lint` and the narrowest relevant test command.
- For UI-only changes, prefer targeted Playwright coverage over broad unrelated runs.
- For backend-only changes, verify at minimum with `npm run lint` and any relevant script or manual request path.
