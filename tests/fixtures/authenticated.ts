import type { Page, Route } from "@playwright/test";

interface MockUser {
  fullName?: string | null;
  username?: string | null;
  imageUrl?: string;
  primaryEmailAddress?: {
    emailAddress: string;
  } | null;
}

interface MockRecentLocation {
  id?: string;
  query: string;
  buildingId: string | null;
  roomId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface MockScheduleEntry {
  id?: string;
  course: string;
  room: string;
  buildingId: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  createdAt?: string;
  updatedAt?: string;
}

interface MockCampusApiOptions {
  savedBuildingIds?: string[];
  recentLocations?: MockRecentLocation[];
  scheduleEntries?: MockScheduleEntry[];
}

const DEFAULT_USER_ID = "user_e2e";
const DEFAULT_TOKEN = "e2e-token";
const DEFAULT_TIMESTAMP = "2026-04-13T14:30:00.000Z";
const DEFAULT_USER: MockUser = {
  fullName: "Bulls Tester",
  username: "bulls-tester",
  imageUrl:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'%3E%3Crect width='96' height='96' rx='48' fill='%23006747'/%3E%3Ctext x='48' y='56' font-size='34' text-anchor='middle' fill='white' font-family='Arial'%3EBT%3C/text%3E%3C/svg%3E",
  primaryEmailAddress: {
    emailAddress: "bulls@example.com",
  },
};

function nowIso() {
  return new Date().toISOString();
}

function parseJsonBody(route: Route) {
  const rawBody = route.request().postData();
  return rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
}

export async function enableSignedInSession(page: Page, user: MockUser = DEFAULT_USER) {
  await page.addInitScript(
    ({ token, sessionUser }) => {
      window.__E2E_CLERK__ = {
        isSignedIn: true,
        token,
        user: sessionUser,
      };
    },
    { token: DEFAULT_TOKEN, sessionUser: user }
  );
}

export async function mockAuthenticatedCampusApi(page: Page, options: MockCampusApiOptions = {}) {
  let savedLocations = (options.savedBuildingIds ?? []).map((buildingId, index) => ({
    id: `saved-${index + 1}`,
    buildingId,
    userId: DEFAULT_USER_ID,
    createdAt: DEFAULT_TIMESTAMP,
    updatedAt: DEFAULT_TIMESTAMP,
  }));

  let recentLocations = (options.recentLocations ?? []).map((location, index) => ({
    id: location.id ?? `recent-${index + 1}`,
    userId: DEFAULT_USER_ID,
    query: location.query,
    fingerprint: location.roomId ? `${location.buildingId}:${location.roomId}` : String(location.buildingId ?? location.query),
    buildingId: location.buildingId,
    roomId: location.roomId ?? null,
    createdAt: location.createdAt ?? DEFAULT_TIMESTAMP,
    updatedAt: location.updatedAt ?? DEFAULT_TIMESTAMP,
  }));

  let scheduleEntries = (options.scheduleEntries ?? []).map((entry, index) => ({
    id: entry.id ?? `schedule-${index + 1}`,
    userId: DEFAULT_USER_ID,
    course: entry.course,
    room: entry.room,
    buildingId: entry.buildingId,
    dayOfWeek: entry.dayOfWeek,
    startTime: entry.startTime,
    endTime: entry.endTime,
    createdAt: entry.createdAt ?? DEFAULT_TIMESTAMP,
    updatedAt: entry.updatedAt ?? DEFAULT_TIMESTAMP,
  }));

  await page.route(/\/api\/saved-locations(?:\/[^/?]+)?$/, async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());

    if (method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ locations: savedLocations }),
      });
      return;
    }

    if (method === "POST") {
      const body = parseJsonBody(route);
      const buildingId = String(body.buildingId ?? "");
      const existing = savedLocations.find((entry) => entry.buildingId === buildingId);
      const timestamp = nowIso();
      const location = existing ?? {
        id: `saved-${savedLocations.length + 1}`,
        buildingId,
        userId: DEFAULT_USER_ID,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      location.updatedAt = timestamp;
      if (!existing) {
        savedLocations = [location, ...savedLocations];
      }

      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ location }),
      });
      return;
    }

    if (method === "DELETE") {
      const buildingId = decodeURIComponent(url.pathname.split("/").pop() ?? "");
      savedLocations = savedLocations.filter((entry) => entry.buildingId !== buildingId);
      await route.fulfill({ status: 204, body: "" });
      return;
    }

    await route.fallback();
  });

  await page.route("**/api/recent-locations", async (route) => {
    const request = route.request();

    if (request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ locations: recentLocations }),
      });
      return;
    }

    if (request.method() === "POST") {
      const body = parseJsonBody(route);
      const timestamp = nowIso();
      const location = {
        id: `recent-${recentLocations.length + 1}`,
        userId: DEFAULT_USER_ID,
        query: String(body.searchQuery ?? body.buildingId ?? ""),
        fingerprint: body.roomId ? `${String(body.buildingId)}:${String(body.roomId)}` : String(body.buildingId ?? ""),
        buildingId: String(body.buildingId ?? ""),
        roomId: body.roomId ? String(body.roomId) : null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      recentLocations = [location, ...recentLocations.filter((entry) => entry.fingerprint !== location.fingerprint)].slice(0, 8);

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ location }),
      });
      return;
    }

    await route.fallback();
  });

  await page.route(/\/api\/schedule(?:\/bulk|\/[^/?]+)?$/, async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());

    if (method === "GET" && url.pathname.endsWith("/api/schedule")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ entries: scheduleEntries }),
      });
      return;
    }

    if (method === "POST" && url.pathname.endsWith("/api/schedule")) {
      const body = parseJsonBody(route);
      const timestamp = nowIso();
      const entry = {
        id: `schedule-${scheduleEntries.length + 1}`,
        userId: DEFAULT_USER_ID,
        course: String(body.course ?? ""),
        room: String(body.room ?? ""),
        buildingId: String(body.buildingId ?? ""),
        dayOfWeek: String(body.dayOfWeek ?? ""),
        startTime: String(body.startTime ?? ""),
        endTime: String(body.endTime ?? ""),
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      scheduleEntries = [...scheduleEntries, entry];

      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ entry }),
      });
      return;
    }

    if (method === "POST" && url.pathname.endsWith("/api/schedule/bulk")) {
      const body = parseJsonBody(route);
      const entries = Array.isArray(body.entries) ? body.entries : [];
      const timestamp = nowIso();
      const createdEntries = entries.map((entry, index) => ({
        id: `schedule-${scheduleEntries.length + index + 1}`,
        userId: DEFAULT_USER_ID,
        course: String((entry as Record<string, unknown>).course ?? ""),
        room: String((entry as Record<string, unknown>).room ?? ""),
        buildingId: String((entry as Record<string, unknown>).buildingId ?? ""),
        dayOfWeek: String((entry as Record<string, unknown>).dayOfWeek ?? ""),
        startTime: String((entry as Record<string, unknown>).startTime ?? ""),
        endTime: String((entry as Record<string, unknown>).endTime ?? ""),
        createdAt: timestamp,
        updatedAt: timestamp,
      }));

      scheduleEntries = createdEntries;

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ entries: createdEntries }),
      });
      return;
    }

    if (method === "PATCH") {
      const entryId = decodeURIComponent(url.pathname.split("/").pop() ?? "");
      const body = parseJsonBody(route);
      const timestamp = nowIso();
      const currentEntry = scheduleEntries.find((entry) => entry.id === entryId);
      const nextEntry = {
        ...currentEntry,
        id: entryId,
        userId: DEFAULT_USER_ID,
        course: String(body.course ?? currentEntry?.course ?? ""),
        room: String(body.room ?? currentEntry?.room ?? ""),
        buildingId: String(body.buildingId ?? currentEntry?.buildingId ?? ""),
        dayOfWeek: String(body.dayOfWeek ?? currentEntry?.dayOfWeek ?? ""),
        startTime: String(body.startTime ?? currentEntry?.startTime ?? ""),
        endTime: String(body.endTime ?? currentEntry?.endTime ?? ""),
        createdAt: currentEntry?.createdAt ?? timestamp,
        updatedAt: timestamp,
      };

      scheduleEntries = scheduleEntries.map((entry) => (entry.id === entryId ? nextEntry : entry));

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ entry: nextEntry }),
      });
      return;
    }

    if (method === "DELETE") {
      const entryId = decodeURIComponent(url.pathname.split("/").pop() ?? "");
      scheduleEntries = scheduleEntries.filter((entry) => entry.id !== entryId);
      await route.fulfill({ status: 204, body: "" });
      return;
    }

    await route.fallback();
  });
}
