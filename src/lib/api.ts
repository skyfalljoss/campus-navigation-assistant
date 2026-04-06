export interface SavedLocationRecord {
  id: string;
  buildingId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecentLocationRecord {
  id: string;
  userId: string;
  query: string;
  fingerprint: string;
  buildingId: string | null;
  roomId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleEntryRecord {
  id: string;
  userId: string;
  course: string;
  room: string;
  buildingId: string;
  dayOfWeek: string;
  slotKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShuttleRouteRecord {
  id: string;
  name: string;
  shortName: string | null;
  color: string | null;
  serviceTimeShort: string | null;
  activeVehicleCount: number;
}

export interface ShuttleVehicleRecord {
  id: string;
  name: string;
  routeId: string;
  routeName: string;
  color: string | null;
  speed: number | null;
  latitude: number;
  longitude: number;
}

export interface ShuttleAlertRecord {
  id: string;
  title: string;
  message: string;
  from: string | null;
  to: string | null;
  updated: string | null;
}

export interface ShuttleOverviewRecord {
  systemId: string;
  fetchedAt: string;
  reportedTime: string | null;
  routeCount: number;
  activeVehicleCount: number;
  alertCount: number;
  routes: ShuttleRouteRecord[];
  vehicles: ShuttleVehicleRecord[];
  alerts: ShuttleAlertRecord[];
}

interface RecentLocationPayload {
  buildingId: string;
  roomId?: string | null;
  searchQuery?: string | null;
}

interface ScheduleEntryPayload {
  course: string;
  room: string;
  buildingId: string;
  dayOfWeek: string;
  slotKey: string;
}

interface BulkSchedulePayload {
  entries: ScheduleEntryPayload[];
}

function getApiUrl(path: string) {
  const baseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";

  return `${baseUrl}${path}`;
}

async function apiRequest<T>(path: string, init: RequestInit, token?: string | null) {
  const headers = new Headers(init.headers);

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;

  try {
    response = await fetch(getApiUrl(path), {
      ...init,
      headers,
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error("The API server is unavailable. Start the app with `npm run dev` or run `npm run dev:server` in another terminal.");
    }

    throw error;
  }

  if (!response.ok) {
    let errorMessage = "Request failed.";

    try {
      const errorBody = (await response.json()) as { error?: string };
      if (errorBody.error) {
        errorMessage = errorBody.error;
      }
    } catch {
      // Keep the default error message when the response body is empty.
    }

    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function fetchSavedLocations(token: string) {
  const response = await apiRequest<{ locations: SavedLocationRecord[] }>(
    "/api/saved-locations",
    { method: "GET" },
    token
  );

  return response.locations;
}

export async function saveLocation(token: string, buildingId: string) {
  const response = await apiRequest<{ location: SavedLocationRecord }>(
    "/api/saved-locations",
    {
      method: "POST",
      body: JSON.stringify({ buildingId }),
    },
    token
  );

  return response.location;
}

export async function removeSavedLocation(token: string, buildingId: string) {
  await apiRequest<void>(
    `/api/saved-locations/${encodeURIComponent(buildingId)}`,
    { method: "DELETE" },
    token
  );
}

export async function fetchRecentLocations(token: string) {
  const response = await apiRequest<{ locations: RecentLocationRecord[] }>(
    "/api/recent-locations",
    { method: "GET" },
    token
  );

  return response.locations;
}

export async function recordRecentLocation(token: string, payload: RecentLocationPayload) {
  const response = await apiRequest<{ location: RecentLocationRecord }>(
    "/api/recent-locations",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    token
  );

  return response.location;
}

export async function fetchScheduleEntries(token: string) {
  const response = await apiRequest<{ entries: ScheduleEntryRecord[] }>(
    "/api/schedule",
    { method: "GET" },
    token
  );

  return response.entries;
}

export async function createScheduleEntry(token: string, payload: ScheduleEntryPayload) {
  const response = await apiRequest<{ entry: ScheduleEntryRecord }>(
    "/api/schedule",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    token
  );

  return response.entry;
}

export async function updateScheduleEntry(token: string, entryId: string, payload: ScheduleEntryPayload) {
  const response = await apiRequest<{ entry: ScheduleEntryRecord }>(
    `/api/schedule/${encodeURIComponent(entryId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    token
  );

  return response.entry;
}

export async function deleteScheduleEntry(token: string, entryId: string) {
  await apiRequest<void>(
    `/api/schedule/${encodeURIComponent(entryId)}`,
    { method: "DELETE" },
    token
  );
}

export async function bulkUpsertScheduleEntries(token: string, payload: BulkSchedulePayload) {
  const response = await apiRequest<{ entries: ScheduleEntryRecord[] }>(
    "/api/schedule/bulk",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    token
  );

  return response.entries;
}

export async function fetchShuttleOverview() {
  return apiRequest<ShuttleOverviewRecord>("/api/shuttle/overview", { method: "GET" });
}

export async function fetchShuttleRoutes() {
  const response = await apiRequest<{ routes: ShuttleRouteRecord[] }>("/api/shuttle/routes", { method: "GET" });
  return response.routes;
}

export async function fetchShuttleVehicles() {
  const response = await apiRequest<{ vehicles: ShuttleVehicleRecord[] }>("/api/shuttle/vehicles", { method: "GET" });
  return response.vehicles;
}

export async function fetchShuttleAlerts() {
  const response = await apiRequest<{ alerts: ShuttleAlertRecord[] }>("/api/shuttle/alerts", { method: "GET" });
  return response.alerts;
}
