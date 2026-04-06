const PASSIO_BASE_URL = "https://passiogo.com";
const DEFAULT_SYSTEM_ID = "2343";

type JsonRecord = Record<string, unknown>;

interface PassioRoute {
  id?: string | null;
  myid?: string | null;
  name?: string | null;
  shortName?: string | null;
  color?: string | null;
  serviceTimeShort?: string | null;
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

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function getArgument(name: string) {
  const directMatch = process.argv.find((argument) => argument.startsWith(`${name}=`));
  if (directMatch) {
    return directMatch.slice(name.length + 1);
  }

  const argumentIndex = process.argv.indexOf(name);
  if (argumentIndex >= 0) {
    return process.argv[argumentIndex + 1];
  }

  return undefined;
}

function hasFlag(flag: string) {
  return process.argv.includes(flag);
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

async function main() {
  const systemId = getArgument("--system") ?? process.env.PASSIO_SYSTEM_ID ?? DEFAULT_SYSTEM_ID;
  const showRaw = hasFlag("--raw");

  console.log(`Testing Passio system ${systemId}`);
  console.log("");

  const [routesPayload, vehiclesPayload, alertsPayload] = await Promise.all([
    postPassio<unknown>("/mapGetData.php?getRoutes=1", {
      systemSelected0: systemId,
      amount: 1,
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
    color: readString(route.color) || null,
    serviceTimeShort: readString(route.serviceTimeShort) || null,
  }));

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

    return [
      {
        id: readString(vehicle.busId) || vehicleKey,
        name: readString(vehicle.busName) || "Unnamed vehicle",
        routeId: readString(vehicle.routeId),
        routeName: readString(vehicle.route),
        speed: vehicle.speed ?? null,
        latitude: vehicle.latitude ?? null,
        longitude: vehicle.longitude ?? null,
      },
    ];
  });

  const alerts = (alertsPayload.msgs ?? []).map((alert) => ({
    id: readString(alert.id),
    title: readString(alert.gtfsAlertHeaderText) || readString(alert.name),
    message: stripHtml(readString(alert.gtfsAlertDescriptionText) || readString(alert.html)),
    from: readString(alert.from) || null,
    to: readString(alert.to) || null,
    updated: readString(alert.updated) || null,
  }));

  console.log(`Routes found: ${routes.length}`);
  console.log(`Active vehicles: ${vehicles.length}`);
  console.log(`Alerts found: ${alerts.length}`);

  const reportedTime = vehiclesPayload.time?.[systemId];
  if (reportedTime) {
    console.log(`Passio reported time: ${reportedTime}`);
  }

  console.log("");
  console.log("Route summary:");
  for (const route of routes) {
    const activeCount = vehicles.filter((vehicle) => vehicle.routeId === route.id).length;
    console.log(
      `- ${route.name}${route.shortName ? ` (${route.shortName})` : ""}: ${activeCount} active vehicle${activeCount === 1 ? "" : "s"}${route.serviceTimeShort ? ` | ${route.serviceTimeShort}` : ""}`
    );
  }

  console.log("");
  console.log("Vehicle summary:");
  if (vehicles.length === 0) {
    console.log("- No active vehicles reported right now.");
  } else {
    for (const vehicle of vehicles) {
      console.log(
        `- ${vehicle.name} on ${vehicle.routeName || vehicle.routeId || "unknown route"} @ ${vehicle.latitude ?? "?"}, ${vehicle.longitude ?? "?"} speed=${vehicle.speed ?? "?"}`
      );
    }
  }

  console.log("");
  console.log("Alert summary:");
  if (alerts.length === 0) {
    console.log("- No alerts reported right now.");
  } else {
    for (const alert of alerts.slice(0, 5)) {
      console.log(`- ${alert.title}`);
      console.log(`  ${alert.message}`);
      if (alert.from || alert.to) {
        console.log(`  active: ${alert.from ?? "?"} -> ${alert.to ?? "?"}`);
      }
    }
  }

  if (showRaw) {
    console.log("");
    console.log("Raw payload snapshot:");
    console.log(
      JSON.stringify(
        {
          routes: routesPayload,
          vehicles: vehiclesPayload,
          alerts: alertsPayload,
        },
        null,
        2
      )
    );
  }
}

main().catch((error) => {
  console.error("");
  console.error("Passio API test failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
