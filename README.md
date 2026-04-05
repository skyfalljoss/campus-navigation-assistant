# Campus Navigation Assistant

Campus Navigation Assistant is a responsive React app for helping students and visitors explore a university campus, search for buildings and rooms, and preview simple walking routes. The current experience is tailored around the USF campus and focuses on a polished map-first interface for discovery and navigation.

## Overview

This project includes:

- A dashboard with quick destination shortcuts and campus activity cards
- An interactive Leaflet map with searchable buildings and room listings
- Quick filters for study spaces, dining, and parking
- Bookmarking for saved locations using `localStorage`
- Profile and settings screens to round out the product experience

## Tech Stack

- React 19
- TypeScript
- Vite
- React Router
- Leaflet with React Leaflet
- Tailwind CSS v4
- Lucide React icons

## Project Structure

```text
src/
  components/
    Layout.tsx        Shared sidebar, top bar, and mobile navigation
  pages/
    Dashboard.tsx     Landing page and quick campus shortcuts
    Map.tsx           Interactive map, search, filtering, and saved locations
    Saved.tsx         Bookmarked destinations
    Profile.tsx       Example user profile screen
    Settings.tsx      Theme and preference UI
  App.tsx             Route definitions
  main.tsx            App entry point
  index.css           Theme tokens and global styles
```

## Getting Started

### Prerequisites

- Node.js 18+ recommended
- npm

### Install and Run

```bash
npm install
npm run dev
```

The development server runs at `http://localhost:3000`.

## Available Scripts

- `npm run dev` starts the Vite dev server on port `3000`
- `npm run build` creates a production build in `dist/`
- `npm run preview` previews the production build locally
- `npm run lint` runs TypeScript type-checking with `tsc --noEmit`
- `npm run clean` removes the `dist/` folder

## Current Behavior

- Campus data is currently mocked in [`src/pages/Map.tsx`](./src/pages/Map.tsx)
- Saved destinations are stored in the browser with `localStorage`
- Route drawing is a UI mock between a fixed user location and the selected building
- The app is front-end focused right now and does not include a live backend or real-time campus data feed

## Environment Variables

An [`.env.example`](./.env.example) file is included from the original scaffold, but the current front-end app does not require environment variables to run locally.

If you later add AI features or a backend service, you can use that file as a starting point for configuration.

## Notes

- The map uses OpenStreetMap tiles through Leaflet
- The UI supports light and dark theme toggling in the settings page
- Several screens currently act as product/demo views rather than fully connected account features

## Future Improvements

- Connect search and routing to real campus GIS or navigation data
- Replace mocked shuttle and activity cards with live feeds
- Add authentication and persistent user profiles
- Support turn-by-turn directions and accessibility-aware routes
- Move static campus data into a dedicated data layer or API
