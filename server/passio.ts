const PASSIO_BASE_URL = "https://passiogo.com";
const DEFAULT_SYSTEM_ID = process.env.PASSIO_SYSTEM_ID ?? "2343";

type JsonRecord = Record<string, unknown>;

interface PassioRoute {
  id?: string | null;
  myid?: string | null;
  name?: string | null;
  shortName?: string | null;
  color?: string | null;
  serviceTimeShort?: string | null;
}

interface PassioRoutePoint {
  lat?: string | number | null;
  lng?: string | number | null;
}

interface PassioStopsResponse {
  routes?: Record<string, unknown[]>;
  stops?: Record<string, { stopId?: string | number | null; name?: string | null; latitude?: string | number | null; longitude?: string | number | null }>;
  routePoints?: Record<string, PassioRoutePoint[][]>;
}

export interface ShuttleRouteStopRecord {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

interface PassioVehicle {
  busId?: string | null;
  busName?: string | null;
  routeId?: string | null;
  route?: string | null;
  speed?: string | number | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  outOfService?: string | number | boolean | null;
}

interface PassioAlert {
  id?: string | null;
  name?: string | null;
  gtfsAlertHeaderText?: string | null;
  gtfsAlertDescriptionText?: string | null;
  html?: string | null;
  from?: string | null;
  to?: string | null;
  updated?: string | null;
}

export interface ShuttleRouteRecord {
  id: string;
  name: string;
  shortName: string | null;
  color: string | null;
  serviceTimeShort: string | null;
  activeVehicleCount: number;
  path: Array<Array<[number, number]>>;
  stops: ShuttleRouteStopRecord[];
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

export interface ShuttleSnapshot {
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

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    return value === "1" || value.toLowerCase() === "true";
  }

  return false;
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function normalizePassioMessage(value: string) {
  const normalizedHtml = value
    .replace(/<\s*br\s*\/?>/gi, " \n ")
    .replace(/<\s*\/p\s*>/gi, " \n ")
    .replace(/<\s*p\s*>/gi, " ")
    .replace(/<\s*\/?(?:b|i)\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ");

  const tokens = normalizedHtml.split(/\s+/).filter(Boolean);
  const parts: string[] = [];

  for (const token of tokens) {
    const normalizedToken = token.toLowerCase();

    if (normalizedToken === "br" || normalizedToken === "/p") {
      parts.push("\n");
      continue;
    }

    if (["p", "b", "i", "/b", "/i"].includes(normalizedToken)) {
      continue;
    }

    parts.push(token);
  }

  return parts
    .join(" ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function normalizeRoutes(payload: unknown) {
  if (Array.isArray(payload)) {
    return payload as PassioRoute[];
  }

  if (payload && typeof payload === "object" && Array.isArray((payload as { all?: unknown[] }).all)) {
    return (payload as { all: PassioRoute[] }).all;
  }

  if (payload && typeof payload === "object" && Array.isArray((payload as { value?: unknown[] }).value)) {
    return (payload as { value: PassioRoute[] }).value;
  }

  return [] as PassioRoute[];
}

function normalizeColor(value: string) {
  const trimmed = value.replace(/^#/, "").trim();
  return /^[0-9a-fA-F]{6}$/.test(trimmed) ? `#${trimmed}` : null;
}

async function postPassio<T>(path: string, body: JsonRecord) {
  const response = await fetch(`${PASSIO_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Passio request failed with status ${response.status}.`);
  }

  return (await response.json()) as T;
}

export async function fetchShuttleSnapshot(systemId = DEFAULT_SYSTEM_ID): Promise<ShuttleSnapshot> {
  const [routesPayload, routeStopsPayload, vehiclesPayload, alertsPayload] = await Promise.all([
    postPassio<unknown>("/mapGetData.php?getRoutes=1", {
      systemSelected0: systemId,
      amount: 1,
    }),
    fetch(
      `${PASSIO_BASE_URL}/mapGetData.php?getStops=2&deviceId=0&withOutdated=1&wBounds=1&buildNo=0&showBusInOos=0`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        body: new URLSearchParams({
          json: JSON.stringify({
            s0: Number(systemId),
            sA: 1,
          }),
        }),
      }
    ).then(async (response) => {
      if (!response.ok) {
        throw new Error(`Passio request failed with status ${response.status}.`);
      }

      return (await response.json()) as PassioStopsResponse;
    }),
    postPassio<{ buses?: Record<string, unknown>; time?: Record<string, string> }>("/mapGetData.php?getBuses=2", {
      s0: systemId,
      sA: 1,
    }),
    postPassio<{ msgs?: PassioAlert[] }>("/goServices.php?getAlertMessages=1", {
      systemSelected0: systemId,
      amount: 1,
      routesAmount: 0,
    }),
  ]);

  const routes = normalizeRoutes(routesPayload).map((route) => ({
    id: readString(route.myid) || readString(route.id),
    name: readString(route.name),
    shortName: readString(route.shortName) || null,
    color: normalizeColor(readString(route.color)),
    serviceTimeShort: readString(route.serviceTimeShort) || null,
    activeVehicleCount: 0,
    path: (routeStopsPayload.routePoints?.[readString(route.myid) || readString(route.id)] ?? []).map((segment) =>
      segment.flatMap((point) => {
        const latitude = readNumber(point.lat);
        const longitude = readNumber(point.lng);

        return latitude === null || longitude === null ? [] : ([[latitude, longitude]] as Array<[number, number]>);
      })
    ).filter((segment) => segment.length > 1),
    stops: (routeStopsPayload.routes?.[readString(route.myid) || readString(route.id)] ?? []).flatMap((entry) => {
      if (!Array.isArray(entry) || entry.length < 2) {
        return [];
      }

      const stopId = readString(entry[1]);
      if (!stopId) {
        return [];
      }

      const stop = routeStopsPayload.stops?.[`ID${stopId}`];
      const latitude = readNumber(stop?.latitude);
      const longitude = readNumber(stop?.longitude);
      if (latitude === null || longitude === null) {
        return [];
      }

      return [
        {
          id: readString(stop?.stopId) || stopId,
          name: readString(stop?.name) || `Stop ${stopId}`,
          latitude,
          longitude,
        } satisfies ShuttleRouteStopRecord,
      ];
    }),
  }));

  const routeMap = new Map(routes.map((route) => [route.id, route]));

  const vehicles = Object.entries(vehiclesPayload.buses ?? {}).flatMap(([vehicleKey, value]) => {
    if (vehicleKey === "-1" || !Array.isArray(value) || value.length === 0) {
      return [];
    }

    const firstValue = value[0];
    if (!firstValue || typeof firstValue !== "object") {
      return [];
    }

    const vehicle = firstValue as PassioVehicle;
    if (readBoolean(vehicle.outOfService)) {
      return [];
    }

    const latitude = readNumber(vehicle.latitude);
    const longitude = readNumber(vehicle.longitude);
    if (latitude === null || longitude === null) {
      return [];
    }

    const routeId = readString(vehicle.routeId);
    const matchedRoute = routeMap.get(routeId);

    return [
      {
        id: readString(vehicle.busId) || vehicleKey,
        name: readString(vehicle.busName) || "Unnamed vehicle",
        routeId,
        routeName: readString(vehicle.route) || matchedRoute?.name || "Unknown route",
        color: matchedRoute?.color ?? null,
        speed: readNumber(vehicle.speed),
        latitude,
        longitude,
      } satisfies ShuttleVehicleRecord,
    ];
  });

  for (const vehicle of vehicles) {
    const route = routeMap.get(vehicle.routeId);
    if (route) {
      route.activeVehicleCount += 1;
    }
  }

  const alerts = (alertsPayload.msgs ?? []).map((alert) => ({
    id: readString(alert.id),
    title: readString(alert.gtfsAlertHeaderText) || readString(alert.name),
    message: normalizePassioMessage(readString(alert.gtfsAlertDescriptionText) || readString(alert.html)),
    from: readString(alert.from) || null,
    to: readString(alert.to) || null,
    updated: readString(alert.updated) || null,
  } satisfies ShuttleAlertRecord));

  return {
    systemId,
    fetchedAt: new Date().toISOString(),
    reportedTime: vehiclesPayload.time?.[systemId] ?? null,
    routeCount: routes.length,
    activeVehicleCount: vehicles.length,
    alertCount: alerts.length,
    routes,
    vehicles,
    alerts,
  };
}
