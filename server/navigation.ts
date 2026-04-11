import { BUILDINGS, type Building, type BuildingEntrance, type EntranceApproachSide } from "../src/data/buildings";

export type Coordinates = [number, number];

export interface NavigationStepRecord {
  instruction: string;
  distanceMeters: number;
  pathName: string | null;
  waypoints: [number, number] | null;
}

export interface NavigationRouteRecord {
  coordinates: Coordinates[];
  distanceMeters: number;
  durationMinutes: number;
  steps: NavigationStepRecord[];
  bounds: [Coordinates, Coordinates] | null;
}

export interface NavigationResponse {
  destination: {
    buildingId: string;
    roomId: string | null;
    arrival: Coordinates;
    arrivalLabel: string;
    arrivalHint: string;
    arrivalInstruction: string;
  };
  route: NavigationRouteRecord;
 }

interface OpenRouteServiceStep {
  instruction?: string;
  distance?: number;
  name?: string;
  way_points?: [number, number];
}

interface OpenRouteServiceSegment {
  steps?: OpenRouteServiceStep[];
}

interface OpenRouteServiceFeature {
  geometry?: {
    coordinates?: Array<[number, number]>;
  };
  properties?: {
    summary?: {
      distance?: number;
      duration?: number;
    };
    segments?: OpenRouteServiceSegment[];
  };
}

interface OpenRouteServiceResponse {
  features?: OpenRouteServiceFeature[];
}

interface BuildingEntranceCandidate {
  coordinates: Coordinates;
  routeTarget: Coordinates;
  label: string;
  hint: string;
  isPrimary: boolean;
  priority: number;
  approachSide: EntranceApproachSide | null;
  landmarkHint: string | null;
  bestForRooms: string[];
}

interface EntranceRouteCandidate {
  entrance: BuildingEntranceCandidate;
  route: Omit<NavigationRouteRecord, "bounds">;
  score: number;
}

const OPEN_ROUTE_SERVICE_URL = "https://api.openrouteservice.org/v2/directions/foot-walking/geojson";
const CACHE_TTL_MS = 30_000;
const routeCache = new Map<string, { expiresAt: number; value: NavigationResponse }>();

export class NavigationError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "NavigationError";
    this.statusCode = statusCode;
  }
}

function isCoordinateTuple(value: unknown): value is Coordinates {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === "number" &&
    Number.isFinite(value[0]) &&
    typeof value[1] === "number" &&
    Number.isFinite(value[1])
  );
}

function roundCoordinate(value: number) {
  return value.toFixed(5);
}

function createCacheKey(start: Coordinates, destinationBuildingId: string, roomId: string | null) {
  return [roundCoordinate(start[0]), roundCoordinate(start[1]), destinationBuildingId, roomId ?? ""].join(":");
}

function getRouteBounds(coordinates: Coordinates[]): [Coordinates, Coordinates] | null {
  if (coordinates.length === 0) {
    return null;
  }

  let minLat = coordinates[0][0];
  let maxLat = coordinates[0][0];
  let minLng = coordinates[0][1];
  let maxLng = coordinates[0][1];

  for (const [lat, lng] of coordinates) {
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
  }

  return [[minLat, minLng], [maxLat, maxLng]];
}

function readInstruction(step: OpenRouteServiceStep) {
  if (typeof step.instruction === "string" && step.instruction.trim()) {
    return step.instruction.trim();
  }

  return "Continue on the walking route.";
}

function readPathName(step: OpenRouteServiceStep) {
  if (typeof step.name === "string") {
    const trimmedName = step.name.trim();
    return trimmedName && trimmedName !== "-" ? trimmedName : null;
  }

  return null;
}

function readWaypoints(step: OpenRouteServiceStep) {
  if (
    Array.isArray(step.way_points) &&
    step.way_points.length === 2 &&
    typeof step.way_points[0] === "number" &&
    typeof step.way_points[1] === "number"
  ) {
    return [step.way_points[0], step.way_points[1]] as [number, number];
  }

  return null;
}

function readStepDistance(step: OpenRouteServiceStep) {
  return typeof step.distance === "number" && Number.isFinite(step.distance) ? Math.round(step.distance) : 0;
}

function formatDistance(distanceMeters: number) {
  if (distanceMeters < 1000) {
    return `${distanceMeters} m`;
  }

  return `${(distanceMeters / 1000).toFixed(1)} km`;
}

function getDetailedInstruction(step: OpenRouteServiceStep) {
  const instruction = readInstruction(step);
  const pathName = readPathName(step);
  const distanceMeters = readStepDistance(step);
  const details: string[] = [];

  if (pathName) {
    details.push(`via ${pathName}`);
  }

  if (distanceMeters > 0 && !/\b\d+\s?(?:m|km)\b/i.test(instruction)) {
    details.push(`for ${formatDistance(distanceMeters)}`);
  }

  return details.length > 0 ? `${instruction} ${details.join(" ")}.` : instruction;
}

function getCachedRoute(cacheKey: string) {
  const cachedEntry = routeCache.get(cacheKey);
  if (!cachedEntry) {
    return null;
  }

  if (cachedEntry.expiresAt < Date.now()) {
    routeCache.delete(cacheKey);
    return null;
  }

  return cachedEntry.value;
}

function normalizeEntrance(entrance: BuildingEntrance): BuildingEntranceCandidate {
  return {
    coordinates: entrance.coordinates,
    routeTarget: entrance.routeTarget ?? entrance.coordinates,
    label: entrance.label,
    hint: entrance.hint,
    isPrimary: Boolean(entrance.isPrimary),
    priority: entrance.priority ?? 0,
    approachSide: entrance.approachSide ?? null,
    landmarkHint: entrance.landmarkHint ?? null,
    bestForRooms: entrance.bestForRooms ?? [],
  };
}

function getBuildingEntrances(building: Building): BuildingEntranceCandidate[] {
  if (building.entrances?.length) {
    return building.entrances.map(normalizeEntrance);
  }

  return [
    {
      coordinates: building.primaryEntrance,
      routeTarget: building.primaryEntranceRouteTarget ?? building.primaryEntrance,
      label: building.primaryEntranceLabel,
      hint: building.primaryEntranceHint,
      isPrimary: true,
      priority: 0,
      approachSide: null,
      landmarkHint: null,
      bestForRooms: [],
    },
  ];
}

async function requestWalkingRoute(start: Coordinates, destination: Coordinates, apiKey: string) {
  const response = await fetch(OPEN_ROUTE_SERVICE_URL, {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
      Accept: "application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8",
    },
    body: JSON.stringify({
      coordinates: [
        [start[1], start[0]],
        [destination[1], destination[0]],
      ],
      instructions: true,
      preference: "recommended",
      units: "m",
    }),
  });

  if (!response.ok) {
    throw new NavigationError(`Routing provider request failed with status ${response.status}.`, 502);
  }

  return (await response.json()) as OpenRouteServiceResponse;
}

function normalizeRouteResponse(payload: OpenRouteServiceResponse) {
  const feature = payload.features?.[0];
  const routeCoordinates = feature?.geometry?.coordinates?.map(([lng, lat]) => [lat, lng] as Coordinates) ?? [];
  const summary = feature?.properties?.summary;
  const segments = feature?.properties?.segments ?? [];

  if (routeCoordinates.length < 2 || !summary) {
    return null;
  }

  return {
    coordinates: routeCoordinates,
    distanceMeters: typeof summary.distance === "number" ? Math.round(summary.distance) : 0,
    durationMinutes: typeof summary.duration === "number" ? Math.max(1, Math.round(summary.duration / 60)) : 1,
    steps: segments.flatMap((segment) =>
      (segment.steps ?? []).map((step) => ({
        instruction: getDetailedInstruction(step),
        distanceMeters: readStepDistance(step),
        pathName: readPathName(step),
        waypoints: readWaypoints(step),
      }))
    ),
  };
}

function appendArrivalCoordinate(routeCoordinates: Coordinates[], arrival: Coordinates) {
  if (routeCoordinates.length === 0) {
    return routeCoordinates;
  }

  const [lastLat, lastLng] = routeCoordinates[routeCoordinates.length - 1];
  const arrivalDistanceMeters = Math.round(
    Math.sqrt(
      ((arrival[0] - lastLat) * 111_320) ** 2 +
      ((arrival[1] - lastLng) * 111_320 * Math.cos((arrival[0] * Math.PI) / 180)) ** 2
    )
  );

  if (arrivalDistanceMeters <= 1 || arrivalDistanceMeters > 35) {
    return routeCoordinates;
  }

  return [...routeCoordinates, arrival];
}

function getDistanceMeters(start: Coordinates, end: Coordinates) {
  const avgLatRadians = (((start[0] + end[0]) / 2) * Math.PI) / 180;
  const metersPerLatDegree = 111_320;
  const metersPerLngDegree = 111_320 * Math.cos(avgLatRadians);
  const latDeltaMeters = (end[0] - start[0]) * metersPerLatDegree;
  const lngDeltaMeters = (end[1] - start[1]) * metersPerLngDegree;

  return Math.sqrt(latDeltaMeters * latDeltaMeters + lngDeltaMeters * lngDeltaMeters);
}

function moveTowardPoint(start: Coordinates, end: Coordinates, distanceMeters: number): Coordinates {
  const totalDistance = getDistanceMeters(start, end);
  if (totalDistance === 0 || distanceMeters <= 0) {
    return start;
  }

  const ratio = Math.min(1, distanceMeters / totalDistance);
  return [
    start[0] + (end[0] - start[0]) * ratio,
    start[1] + (end[1] - start[1]) * ratio,
  ];
}

function refineArrivalCoordinate(building: Building, entrance: BuildingEntranceCandidate): Coordinates {
  const buildingCenter: Coordinates = [building.lat, building.lng];
  const entranceToCenterDistance = getDistanceMeters(entrance.coordinates, buildingCenter);

  if (entranceToCenterDistance <= 8) {
    return entrance.coordinates;
  }

  const inwardOffsetMeters = Math.min(12, Math.max(5, entranceToCenterDistance * 0.3));
  return moveTowardPoint(entrance.coordinates, buildingCenter, inwardOffsetMeters);
}

function getRelativeApproachSide(point: Coordinates, building: Building): EntranceApproachSide {
  const latDelta = point[0] - building.lat;
  const lngDelta = point[1] - building.lng;

  if (Math.abs(latDelta) >= Math.abs(lngDelta)) {
    return latDelta >= 0 ? "north" : "south";
  }

  return lngDelta >= 0 ? "east" : "west";
}

function isOppositeSide(candidateSide: EntranceApproachSide | null, userSide: EntranceApproachSide) {
  if (!candidateSide || candidateSide === "central") {
    return false;
  }

  return (
    (candidateSide === "north" && userSide === "south") ||
    (candidateSide === "south" && userSide === "north") ||
    (candidateSide === "east" && userSide === "west") ||
    (candidateSide === "west" && userSide === "east")
  );
}

function matchesRoomHint(roomId: string | null, building: Building, entrance: BuildingEntranceCandidate) {
  if (!roomId || entrance.bestForRooms.length === 0) {
    return false;
  }

  const room = building.rooms.find((entry) => entry.id === roomId) ?? null;
  const searchableValues = [roomId, room?.name ?? "", room?.floor ?? "", room?.desc ?? ""].map((value) => value.toLowerCase());

  return entrance.bestForRooms.some((hint) => {
    const normalizedHint = hint.toLowerCase();
    return searchableValues.some((value) => value.includes(normalizedHint));
  });
}

function scoreEntranceCandidate(
  start: Coordinates,
  building: Building,
  roomId: string | null,
  candidate: { entrance: BuildingEntranceCandidate; route: Omit<NavigationRouteRecord, "bounds"> }
) {
  const userApproachSide = getRelativeApproachSide(start, building);
  const roomMatched = matchesRoomHint(roomId, building, candidate.entrance);
  const sideMatched = candidate.entrance.approachSide !== null && candidate.entrance.approachSide === userApproachSide;
  const oppositeSide = isOppositeSide(candidate.entrance.approachSide, userApproachSide);

  let score = candidate.route.distanceMeters;

  if (candidate.entrance.isPrimary) {
    score -= 35;
  }

  score -= candidate.entrance.priority * 12;

  if (roomMatched) {
    score -= 45;
  }

  if (sideMatched) {
    score -= 24;
  }

  if (oppositeSide) {
    score += 18;
  }

  return score;
}

function createArrivalInstruction(building: Building, entrance: BuildingEntranceCandidate, roomId: string | null) {
  const room = roomId ? building.rooms.find((entry) => entry.id === roomId) ?? null : null;
  const instructionParts = [`Head to the ${entrance.label} of ${building.name}.`];

  if (entrance.landmarkHint) {
    instructionParts.push(entrance.landmarkHint);
  } else if (entrance.hint) {
    instructionParts.push(entrance.hint);
  }

  if (room) {
    instructionParts.push(`${room.name} is on the ${room.floor.toLowerCase()}.`);
  }

  return instructionParts.join(" ");
}

function setCachedRoute(cacheKey: string, value: NavigationResponse) {
  routeCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

export function readRouteRequest(body: unknown) {
  const start = typeof body === "object" && body !== null ? Reflect.get(body, "start") : null;
  const destinationBuildingId = typeof body === "object" && body !== null ? Reflect.get(body, "destinationBuildingId") : null;
  const roomId = typeof body === "object" && body !== null ? Reflect.get(body, "roomId") : null;

  if (!isCoordinateTuple(start)) {
    throw new NavigationError("A valid start coordinate pair is required.");
  }

  if (typeof destinationBuildingId !== "string" || !destinationBuildingId.trim()) {
    throw new NavigationError("destinationBuildingId is required.");
  }

  return {
    start,
    destinationBuildingId: destinationBuildingId.trim(),
    roomId: typeof roomId === "string" && roomId.trim() ? roomId.trim() : null,
  };
}

export async function getWalkingRoute(start: Coordinates, destinationBuildingId: string, roomId: string | null): Promise<NavigationResponse> {
  const building = BUILDINGS.find((entry) => entry.id === destinationBuildingId);
  if (!building) {
    throw new NavigationError("Destination building not found.", 404);
  }

  const cacheKey = createCacheKey(start, destinationBuildingId, roomId);
  const cachedRoute = getCachedRoute(cacheKey);
  if (cachedRoute) {
    return cachedRoute;
  }

  const apiKey = process.env.OPENROUTESERVICE_API_KEY;
  if (!apiKey) {
    throw new NavigationError("OPENROUTESERVICE_API_KEY is not configured on the server.", 503);
  }

  const candidateEntrances = getBuildingEntrances(building);
  const candidateResults = await Promise.all(
    candidateEntrances.map(async (entrance) => {
      try {
        const payload = await requestWalkingRoute(start, entrance.routeTarget, apiKey);
        const route = normalizeRouteResponse(payload);
        return route ? { entrance, route } : null;
      } catch {
        return null;
      }
    })
  );

  const bestCandidate = candidateResults
    .filter((candidate): candidate is { entrance: BuildingEntranceCandidate; route: Omit<NavigationRouteRecord, "bounds"> } => candidate !== null)
    .map((candidate) => ({
      ...candidate,
      score: scoreEntranceCandidate(start, building, roomId, candidate),
    }))
    .sort((left, right) => left.score - right.score || left.route.distanceMeters - right.route.distanceMeters)[0] as EntranceRouteCandidate | undefined;

  if (!bestCandidate) {
    throw new NavigationError("No walking route was returned for that destination.", 404);
  }

  const refinedArrival = refineArrivalCoordinate(building, bestCandidate.entrance);
  const routeCoordinates = appendArrivalCoordinate(bestCandidate.route.coordinates, refinedArrival);

  const route: NavigationRouteRecord = {
    ...bestCandidate.route,
    coordinates: routeCoordinates,
    bounds: getRouteBounds(routeCoordinates),
  };

  const normalizedResponse: NavigationResponse = {
    destination: {
      buildingId: building.id,
      roomId,
      arrival: refinedArrival,
      arrivalLabel: bestCandidate.entrance.label,
      arrivalHint: bestCandidate.entrance.hint,
      arrivalInstruction: createArrivalInstruction(building, bestCandidate.entrance, roomId),
    },
    route,
  };

  setCachedRoute(cacheKey, normalizedResponse);
  return normalizedResponse;
}
