# Campus Navigation Assistant: Project Documentation

## 1. Project Summary

Campus Navigation Assistant is a full-stack campus web application for the University of South Florida experience. It combines a React frontend with an Express API, Clerk authentication, Prisma-backed persistence, live shuttle data from Passio, and walking directions powered by OpenRouteService.

The app is designed to help users:

- search campus buildings and rooms
- view an interactive campus map
- generate walking directions to building entrances and room-adjacent arrivals
- track Bull Runner shuttle routes, vehicles, and service alerts
- save destinations and review recent activity
- manage a personal class schedule
- persist interface preferences such as theme and notifications

This is no longer just a frontend prototype. The checked-in codebase includes a real backend, authenticated user flows, a PostgreSQL schema, and Playwright end-to-end coverage.

## 2. Product Goals

The current codebase centers on six practical goals:

1. Provide a polished map-first campus discovery experience.
2. Let users search for buildings and rooms quickly from multiple entry points.
3. Offer authenticated persistence for saved places, recent searches, and schedules.
4. Show useful real-time campus transit information without forcing users into a separate system.
5. Generate credible walking routes using a server-side routing provider instead of simple frontend heuristics alone.
6. Keep the app responsive and usable on both desktop and mobile.

## 3. Technology Stack

### Frontend

- React 19
- TypeScript
- Vite
- React Router DOM
- Tailwind CSS v4
- Leaflet
- React Leaflet
- Lucide React
- DnD Kit for schedule drag-and-drop
- `clsx` + `tailwind-merge`

### Backend

- Express
- Clerk Express middleware
- Prisma
- PostgreSQL
- `dotenv`
- `tsx`

### External Services

- Clerk for authentication and account UI
- OpenRouteService for walking directions
- Passio for Bull Runner shuttle data
- Neon-compatible PostgreSQL via Prisma connection strings

### Testing And Tooling

- Playwright for E2E coverage
- TypeScript compile checks via `tsc --noEmit`
- `autocannon` load check for `/api/health`

## 4. High-Level Architecture

The application is split into two runtime layers.

### Frontend layer

The frontend renders the user experience, manages page state, talks to the API through `src/lib/api.ts`, and renders maps with Leaflet.

Key frontend entry points:

- `src/main.tsx` bootstraps React and Clerk
- `src/App.tsx` defines routes
- `src/components/Layout.tsx` provides shared desktop and mobile chrome
- `src/pages/*` implement feature screens

### Backend layer

The backend owns authenticated persistence, shuttle normalization, and route generation.

Key backend entry points:

- `server/index.ts` defines the Express server and API routes
- `server/prisma.ts` exports the Prisma singleton
- `server/navigation.ts` calls OpenRouteService and shapes route responses
- `server/passio.ts` fetches and normalizes live Bull Runner data

### Shared domain layer

A few modules are shared across client and server:

- `src/data/buildings.ts` contains building, room, and entrance metadata
- `src/lib/schedule.ts` contains schedule parsing and validation rules used by both layers
- `src/lib/api.ts` defines response shapes consumed by the UI

## 5. Project Structure

```text
src/
  components/
    Layout.tsx
  data/
    buildings.ts
  lib/
    api.ts
    navigation.ts
    preferences.ts
    recent-destinations.ts
    route-tracking.ts
    schedule.ts
    utils.ts
  pages/
    Dashboard.tsx
    Map.tsx
    Profile.tsx
    Saved.tsx
    Settings.tsx
    Shuttle.tsx
  App.tsx
  main.tsx

server/
  index.ts
  navigation.ts
  passio.ts
  prisma.ts

prisma/
  schema.prisma
  migrations/

scripts/
  load-health.ts
  test-passio-api.ts

tests/
  e2e/
  fixtures/
  mocks/
  pages/
```

## 6. Runtime Flow

### App boot

1. `index.html` provides the `#root` mount point.
2. `src/main.tsx` initializes theme syncing and renders `ClerkProvider`.
3. `src/App.tsx` mounts the routed application inside `Layout`.
4. `Layout` renders desktop sidebar, top bar, and mobile bottom navigation.

### API flow

1. Frontend code calls helpers in `src/lib/api.ts`.
2. The helper adds JSON headers and a bearer token when needed.
3. Requests go to same-origin `/api/*` by default, or `VITE_API_BASE_URL` if configured.
4. In development, Vite proxies `/api` to the Express server.
5. In production, the Express server serves both the SPA and API.

## 7. Environment And Configuration

The checked-in `.env.example` currently expects:

- `VITE_CLERK_PUBLISHABLE_KEY`
- `CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `DATABASE_URL`
- `DIRECT_URL`
- `PORT`
- `CORS_ORIGIN`
- `PASSIO_SYSTEM_ID`
- `OPENROUTESERVICE_API_KEY`
- `VITE_API_BASE_URL`

Important configuration details:

- `PORT` defaults to `4000`
- the frontend dev server runs on `3000`
- `PASSIO_SYSTEM_ID` defaults to Bull Runner system `2343`
- OpenRouteService is required for live walking route generation
- the TypeScript alias `@/*` points to the repo root, not `src/`
- `vite.config.ts` supports disabling HMR with `DISABLE_HMR=true`

## 8. Frontend Routes And Screens

### `/` Dashboard

`src/pages/Dashboard.tsx` is the largest dashboard and planner surface in the app. It combines several features:

- hero search that forwards users to `/map`
- recent destinations loaded from the authenticated API
- shuttle status summary loaded from `/api/shuttle/overview`
- ETA-aware destination cards using the last known or live location
- a full class schedule planner backed by the API

Important dashboard behaviors:

- geolocation attempts to upgrade the location source from campus center to saved location to live GPS
- schedule data is loaded only for signed-in users
- schedule conflicts are computed client-side with shared helpers
- recent destinations refresh when the map page dispatches a cross-page update event
- shuttle summary refreshes on an interval
- schedule planner collapse state is stored in `localStorage`

### `/map` Campus Map

`src/pages/Map.tsx` is the most feature-rich page.

Major responsibilities:

- search buildings and rooms
- filter by tags such as study, dining, and parking
- show building details and room-level details
- save and unsave locations for authenticated users
- record recent selections for authenticated users
- request walking directions from the server
- track live location during navigation
- reroute if the user moves meaningfully or goes off-route
- optionally provide voice guidance
- react to deep links via query parameters

Important URL parameters:

- `dest` for preselected building
- `room` for preselected room
- `q` for initial search text
- `navigate=1` to attempt automatic navigation after selection is ready

The map page uses several supporting modules:

- `src/lib/navigation.ts` for client-side distance formatting and last-known location persistence
- `src/lib/route-tracking.ts` for nearest point, remaining distance, and off-route detection
- `src/lib/preferences.ts` for location-service preference checks
- `src/lib/recent-destinations.ts` for cross-page recent destination refreshes

### `/shuttle` Bull Runner Live

`src/pages/Shuttle.tsx` renders live shuttle information using the normalized overview from the backend.

It includes:

- route filters
- active vehicle counts
- service alerts
- operating hours extraction from Passio alerts
- a Leaflet map showing route polylines, stops, and vehicles
- periodic refresh every 20 seconds

### `/saved` Saved Locations

`src/pages/Saved.tsx` loads saved building IDs for the signed-in user and maps them back to static building metadata.

It supports:

- guest empty/sign-in state
- authenticated loading state
- error state when the API fails
- linked cards that reopen the map with `dest` query parameters

### `/profile` Profile

`src/pages/Profile.tsx` combines Clerk account information with app-specific data.

It shows:

- Clerk avatar, display name, and primary email
- saved locations count
- recent searches count
- recent location list
- saved location list
- buttons for Clerk account management and sign-out

### `/settings` Settings

`src/pages/Settings.tsx` manages app preferences and some browser permission flows.

Current settings behavior includes:

- theme preference persisted in `localStorage`
- email updates toggle persisted in `localStorage`
- push notification toggle with browser permission handling
- location services toggle with browser permission handling
- hash-based deep linking from header buttons such as `/settings#notifications`

## 9. Shared Layout And Navigation Chrome

The shared shell lives in `src/components/Layout.tsx`.

It provides:

- collapsible desktop sidebar
- responsive top bar with search and account actions
- mobile bottom navigation
- route-aware active navigation styles
- map-page-specific hiding of top chrome when the map requests more viewport space

The layout also bridges page-to-shell communication through a `map-chrome-visibility` custom event so the map can temporarily hide header chrome during focused navigation.

## 10. Authentication Model

Clerk is used on both client and server.

### Frontend

- `ClerkProvider` is configured in `src/main.tsx`
- pages use hooks such as `useAuth`, `useUser`, and `useClerk`
- signed-out screens show `SignInButton` call-to-actions
- profile and account controls use Clerk-hosted UI components

### Backend

- `server/index.ts` installs `clerkMiddleware`
- authenticated routes call `requireUserId(req, res)`
- unauthorized access returns `401` with `{ error: string }`

## 11. API Surface

The Express server currently exposes these main endpoints.

### Health

- `GET /api/health`

### Walking navigation

- `POST /api/navigation/route`

Request body:

- `start: [number, number]`
- `destinationBuildingId: string`
- `roomId?: string | null`

### Shuttle

- `GET /api/shuttle/overview`
- `GET /api/shuttle/routes`
- `GET /api/shuttle/vehicles`
- `GET /api/shuttle/alerts`

### Saved locations

- `GET /api/saved-locations`
- `POST /api/saved-locations`
- `DELETE /api/saved-locations/:buildingId`

### Recent locations

- `GET /api/recent-locations`
- `POST /api/recent-locations`

### Schedule

- `GET /api/schedule`
- `POST /api/schedule`
- `POST /api/schedule/bulk`
- `PATCH /api/schedule/:entryId`
- `DELETE /api/schedule/:entryId`

## 12. Persistence Model

The Prisma schema currently defines three authenticated data models.

### `SavedLocation`

Fields:

- `id`
- `userId`
- `buildingId`
- `createdAt`
- `updatedAt`

Behavior:

- unique on `[userId, buildingId]`
- used by map, saved page, and profile page

### `RecentSearch`

Fields:

- `id`
- `userId`
- `query`
- `fingerprint`
- `buildingId`
- `roomId`
- `createdAt`
- `updatedAt`

Behavior:

- unique on `[userId, fingerprint]`
- upserted when users select buildings or rooms on the map
- trimmed server-side to the latest eight entries

### `ScheduleEntry`

Fields:

- `id`
- `userId`
- `course`
- `room`
- `buildingId`
- `dayOfWeek`
- `startTime`
- `endTime`
- `createdAt`
- `updatedAt`

Behavior:

- powers the dashboard planner
- supports create, update, delete, and bulk import
- validated using shared schedule utilities

## 13. Building Data Model

`src/data/buildings.ts` is the canonical static campus dataset.

The file provides:

- building IDs and names
- coordinates
- type and tag metadata
- descriptions
- room lists
- primary entrance data
- optional multi-entrance metadata used by the routing system

This dataset is shared across multiple features:

- search matching
- map markers
- saved/profile labels
- schedule routing targets
- server-side entrance-aware arrival selection

## 14. Walking Navigation System

Walking directions are now primarily server-driven.

### Client responsibilities

The client:

- requests a route from `/api/navigation/route`
- renders the returned polyline and turn list
- watches user location during navigation
- estimates progress against the polyline
- reroutes when movement is meaningful or the user is off-route
- stores the latest known location in `localStorage`

### Server responsibilities

`server/navigation.ts` handles:

- request validation
- OpenRouteService API calls
- conversion from ORS response format to app response format
- entrance candidate evaluation
- room-aware entrance preference scoring
- arrival instruction text generation
- route bounds generation
- short-lived in-memory caching

Important implementation details:

- routes target building entrances rather than just building centers
- the chosen entrance may vary by approach side and room hints
- arrival coordinates can be nudged inward from the entrance for a better endpoint
- route responses include `coordinates`, `distanceMeters`, `durationMinutes`, `steps`, and `bounds`

## 15. Shuttle Integration

Bull Runner data is normalized in `server/passio.ts`.

The server combines several upstream Passio calls to produce a single frontend-friendly snapshot containing:

- system metadata
- routes
- route polylines
- route stops
- active vehicles
- alerts
- service time strings

The frontend never talks to Passio directly. It only consumes normalized API responses from the local server.

Benefits of this approach:

- external payload weirdness stays on the server
- client types remain stable
- route colors, stops, and vehicle counts are normalized once
- E2E tests can mock a single clean API surface

## 16. Schedule System

The schedule planner is spread across the dashboard UI, shared schedule utilities, the Prisma model, and schedule API routes.

Capabilities currently implemented:

- add, edit, and delete class entries
- bulk import entries from parsed text
- export schedule-friendly data from the dashboard UI
- detect overlapping classes
- render desktop and mobile planner views
- drag schedule entries between time slots
- create route targets from building and room labels

`src/lib/schedule.ts` is the shared logic layer for:

- time parsing
- day validation
- overlap detection
- duration calculations
- timeline row generation
- legacy slot compatibility helpers
- option generation for schedule forms

## 17. User Preferences And Local Persistence

Not all persistence goes through the backend.

### Local storage keys used by the client

- theme preference
- push updates enabled flag
- email updates enabled flag
- location services enabled flag
- last known user location
- dashboard schedule collapsed state
- recent destination update timestamp bridge
- voice guidance toggle on the map

This split is intentional:

- account-specific content goes to the database
- device/browser-specific preferences stay local

## 18. Error Handling Strategy

The codebase follows a simple but consistent error model.

### Frontend

- `src/lib/api.ts` turns failed fetches into `Error` objects with useful messages
- network-unavailable errors are translated into local dev guidance
- pages store request errors in component state and render friendly messages
- geolocation failures are mapped to explicit user-facing strings

### Backend

- async handlers are wrapped through `asyncHandler`
- invalid input returns 4xx JSON errors
- domain-specific routing failures use `NavigationError`
- uncaught errors fall through to a final `500` handler

## 19. Testing Strategy

The repository uses Playwright for browser-level coverage.

Current coverage includes:

- dashboard search handoff and shuttle summary
- map search and room drill-down
- guide and empty-state behavior on the map
- signed-out saved/profile flows
- signed-in saved/profile flows
- schedule CRUD flows
- settings localStorage persistence
- mobile navigation behavior

Important test design choices:

- the Playwright suite starts `npm run dev:client:e2e`
- tests do not depend on the Express API by default
- Clerk is mocked in `e2e` mode
- shuttle and account APIs are mocked at the browser layer
- external map tiles are blocked in tests

There is currently no unit-test runner such as Vitest or Jest.

## 20. Build, Run, And Verification Commands

Common commands:

- `npm run dev`
- `npm run dev:client`
- `npm run dev:server`
- `npm run build`
- `npm run preview`
- `npm run start`
- `npm run lint`
- `npm run test:e2e`
- `npm run test:e2e -- tests/e2e/map.spec.ts`
- `npm run test:e2e -- --project=chromium tests/e2e/map.spec.ts`
- `npm run test:load:health`
- `npm run test:passio -- --system=2343 --raw`

Important build note:

- `npm run build` builds only the frontend bundle
- `npm run start` expects `dist/` to exist so the server can serve the SPA in production mode

## 21. Current Strengths

The present architecture works well for the current scope because it:

- keeps the UI polished and responsive
- centralizes API access through typed helpers
- uses a real backend where persistence and normalization matter
- keeps browser-only preferences local
- shares validation rules across client and server where appropriate
- isolates third-party API complexity in server modules
- provides realistic end-to-end test coverage for major flows

## 22. Current Limitations

The app is production-shaped, but several limitations still matter.

- building and room metadata are still static and manually curated
- schedule, saved, and recent data are user-specific but there is no broader admin CMS
- walking routes depend on an external routing provider and do not include indoor navigation
- accessibility-aware route scoring is not yet implemented
- there are no unit tests for individual utility modules
- the server is still concentrated in a single `server/index.ts` file rather than split into feature routers

## 23. Best Extension Points

The clearest future improvements are:

1. move static campus metadata into a managed source of truth
2. add richer room and accessibility metadata to the building dataset
3. expand routing to include accessibility preferences and closure-aware rerouting
4. split server routes into dedicated modules if the API grows much further
5. add unit tests around schedule parsing, route tracking, and server normalization
6. add caching or rate-limiting strategy around external upstream services
7. extend shuttle history and analytics if product needs become more operational

## 24. Conclusion

Campus Navigation Assistant is now a real full-stack campus application rather than a frontend-only demo. Its core value comes from combining a strong map UX with authenticated persistence, live shuttle visibility, and server-generated walking directions.

The most important architectural idea in the current codebase is the division of responsibility:

- static campus metadata stays local and fast
- account-specific data lives in PostgreSQL through Prisma
- auth stays delegated to Clerk
- live transit and routing integrations are normalized on the server
- the frontend focuses on presentation, interaction, and client-side map behavior

That structure keeps the app understandable today while leaving room for the project to grow into a more advanced campus operations or navigation platform.
