export type Coordinates = [number, number];

export const CAMPUS_CENTER: Coordinates = [28.06, -82.413];

const LAST_KNOWN_LOCATION_KEY = "usf_last_known_location";
const BASE_WALKING_SPEED_METERS_PER_MINUTE = 78;
const PATH_EFFICIENCY_BUFFER = 1.08;
const INTERSECTION_DELAY_MINUTES = 0.35;
const START_BUFFER_MINUTES = 0.4;
const MAX_WALKABLE_MINUTES = 24 * 60;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function getDistanceMeters(start: Coordinates, end: Coordinates) {
  const earthRadius = 6371000;
  const dLat = toRadians(end[0] - start[0]);
  const dLng = toRadians(end[1] - start[1]);
  const startLat = toRadians(start[0]);
  const endLat = toRadians(end[0]);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getBearing(start: Coordinates, end: Coordinates) {
  const startLat = toRadians(start[0]);
  const startLng = toRadians(start[1]);
  const endLat = toRadians(end[0]);
  const endLng = toRadians(end[1]);

  const y = Math.sin(endLng - startLng) * Math.cos(endLat);
  const x =
    Math.cos(startLat) * Math.sin(endLat) -
    Math.sin(startLat) * Math.cos(endLat) * Math.cos(endLng - startLng);

  return (Math.atan2(y, x) * 180) / Math.PI + 360;
}

function getCardinalDirection(bearing: number) {
  const directions = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];
  return directions[Math.round((bearing % 360) / 45) % directions.length];
}

export function formatDistance(distanceMeters: number) {
  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)} m`;
  }

  return `${(distanceMeters / 1000).toFixed(1)} km`;
}

export function formatEta(minutes: number) {
  if (!isWalkableEta(minutes)) {
    return "Unwalkable";
  }

  if (minutes < 60) {
    return `${minutes} min${minutes === 1 ? "" : "s"}`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours} hr${hours === 1 ? "" : "s"}`;
  }

  return `${hours} hr ${remainingMinutes} min`;
}

export function isWalkableEta(minutes: number) {
  return minutes <= MAX_WALKABLE_MINUTES;
}

export function getWalkabilityLabel(minutes: number) {
  return isWalkableEta(minutes) ? "Walkable" : "Unwalkable";
}

export function estimateWalkingMinutes(distanceMeters: number) {
  const adjustedDistance = distanceMeters * PATH_EFFICIENCY_BUFFER;
  const movingMinutes = adjustedDistance / BASE_WALKING_SPEED_METERS_PER_MINUTE;
  const crossingDelay = Math.min(2, Math.floor(distanceMeters / 260) * INTERSECTION_DELAY_MINUTES);
  const startupDelay = distanceMeters > 120 ? START_BUFFER_MINUTES : 0.2;

  return Math.max(1, Math.round(movingMinutes + crossingDelay + startupDelay));
}

export function buildRoute(start: Coordinates, end: Coordinates) {
  const latDelta = Math.abs(end[0] - start[0]);
  const lngDelta = Math.abs(end[1] - start[1]);
  const goVerticalFirst = latDelta >= lngDelta;
  const waypoint: Coordinates = goVerticalFirst ? [end[0], start[1]] : [start[0], end[1]];
  const route: Coordinates[] = [start];

  if (getDistanceMeters(start, waypoint) > 5) {
    route.push(waypoint);
  }

  route.push(end);

  const directDistance = getDistanceMeters(start, end);
  const routeDistance = route.slice(1).reduce((total, point, index) => {
    return total + getDistanceMeters(route[index], point);
  }, 0);
  const effectiveDistance = Math.max(routeDistance, directDistance * PATH_EFFICIENCY_BUFFER);
  const firstLegDistance = route[1] ? getDistanceMeters(route[0], route[1]) : 0;
  const secondLegDistance = route[2] ? getDistanceMeters(route[1], route[2]) : 0;

  const etaMinutes = estimateWalkingMinutes(effectiveDistance);

  return {
    route,
    totalDistance: routeDistance,
    etaMinutes,
    isWalkable: isWalkableEta(etaMinutes),
    steps: [
      firstLegDistance > 10
        ? `Head ${getCardinalDirection(getBearing(route[0], route[1]))} for ${formatDistance(firstLegDistance)}.`
        : null,
      secondLegDistance > 10 && route[2]
        ? `Then continue ${getCardinalDirection(getBearing(route[1], route[2]))} for ${formatDistance(secondLegDistance)}.`
        : null,
    ].filter(Boolean) as string[],
  };
}

export function readStoredUserLocation() {
  if (typeof window === "undefined") {
    return null;
  }

  const rawLocation = localStorage.getItem(LAST_KNOWN_LOCATION_KEY);
  if (!rawLocation) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawLocation);
    if (
      Array.isArray(parsed) &&
      parsed.length === 2 &&
      typeof parsed[0] === "number" &&
      typeof parsed[1] === "number"
    ) {
      return parsed as Coordinates;
    }
  } catch {
    return null;
  }

  return null;
}

export function writeStoredUserLocation(location: Coordinates) {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(LAST_KNOWN_LOCATION_KEY, JSON.stringify(location));
}
