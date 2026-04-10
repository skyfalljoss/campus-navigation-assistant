import { getDistanceMeters, type Coordinates } from "./navigation";

function projectPointToSegment(point: Coordinates, start: Coordinates, end: Coordinates): Coordinates {
  const avgLatRadians = ((start[0] + end[0] + point[0]) / 3) * (Math.PI / 180);
  const metersPerLatDegree = 111_320;
  const metersPerLngDegree = 111_320 * Math.cos(avgLatRadians);

  const px = point[1] * metersPerLngDegree;
  const py = point[0] * metersPerLatDegree;
  const sx = start[1] * metersPerLngDegree;
  const sy = start[0] * metersPerLatDegree;
  const ex = end[1] * metersPerLngDegree;
  const ey = end[0] * metersPerLatDegree;
  const dx = ex - sx;
  const dy = ey - sy;
  const segmentLengthSquared = dx * dx + dy * dy;

  if (segmentLengthSquared === 0) {
    return start;
  }

  const projection = ((px - sx) * dx + (py - sy) * dy) / segmentLengthSquared;
  const clampedProjection = Math.max(0, Math.min(1, projection));

  return [
    (sy + dy * clampedProjection) / metersPerLatDegree,
    (sx + dx * clampedProjection) / metersPerLngDegree,
  ];
}

function getProjectedSegmentState(point: Coordinates, start: Coordinates, end: Coordinates) {
  const avgLatRadians = ((start[0] + end[0] + point[0]) / 3) * (Math.PI / 180);
  const metersPerLatDegree = 111_320;
  const metersPerLngDegree = 111_320 * Math.cos(avgLatRadians);

  const px = point[1] * metersPerLngDegree;
  const py = point[0] * metersPerLatDegree;
  const sx = start[1] * metersPerLngDegree;
  const sy = start[0] * metersPerLatDegree;
  const ex = end[1] * metersPerLngDegree;
  const ey = end[0] * metersPerLatDegree;
  const dx = ex - sx;
  const dy = ey - sy;
  const segmentLengthSquared = dx * dx + dy * dy;

  if (segmentLengthSquared === 0) {
    return {
      point: start,
      progress: 0,
    };
  }

  const projection = ((px - sx) * dx + (py - sy) * dy) / segmentLengthSquared;
  const progress = Math.max(0, Math.min(1, projection));

  return {
    point: projectPointToSegment(point, start, end),
    progress,
  };
}

export function getNearestRouteCoordinateIndex(point: Coordinates, coordinates: Coordinates[]) {
  if (coordinates.length === 0) {
    return 0;
  }

  if (coordinates.length === 1) {
    return 0;
  }

  let closestDistance = Number.POSITIVE_INFINITY;
  let closestCoordinateIndex = 0;

  for (let index = 1; index < coordinates.length; index += 1) {
    const start = coordinates[index - 1];
    const end = coordinates[index];
    const projection = getProjectedSegmentState(point, start, end);
    const projectedDistance = getDistanceMeters(point, projection.point);

    if (projectedDistance < closestDistance) {
      closestDistance = projectedDistance;
      closestCoordinateIndex = projection.progress >= 0.5 ? index : index - 1;
    }
  }

  return closestCoordinateIndex;
}

export function getDistanceToPolyline(point: Coordinates, coordinates: Coordinates[]) {
  if (coordinates.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  if (coordinates.length === 1) {
    return getDistanceMeters(point, coordinates[0]);
  }

  let minDistance = Number.POSITIVE_INFINITY;

  for (let index = 1; index < coordinates.length; index += 1) {
    const projectedPoint = projectPointToSegment(point, coordinates[index - 1], coordinates[index]);
    minDistance = Math.min(minDistance, getDistanceMeters(point, projectedPoint));
  }

  return minDistance;
}

export function hasMeaningfulMovement(previousLocation: Coordinates | null, nextLocation: Coordinates, thresholdMeters: number) {
  if (!previousLocation) {
    return true;
  }

  return getDistanceMeters(previousLocation, nextLocation) >= thresholdMeters;
}

export function isOffRoute(point: Coordinates, coordinates: Coordinates[], thresholdMeters: number) {
  return getDistanceToPolyline(point, coordinates) >= thresholdMeters;
}

export function getRemainingRouteDistance(point: Coordinates, coordinates: Coordinates[]) {
  if (coordinates.length < 2) {
    return 0;
  }

  let closestDistance = Number.POSITIVE_INFINITY;
  let remainingDistance = 0;

  for (let index = 1; index < coordinates.length; index += 1) {
    const start = coordinates[index - 1];
    const end = coordinates[index];
    const projection = getProjectedSegmentState(point, start, end);
    const projectedDistance = getDistanceMeters(point, projection.point);

    if (projectedDistance >= closestDistance) {
      continue;
    }

    closestDistance = projectedDistance;
    let nextRemainingDistance = getDistanceMeters(projection.point, end);

    for (let remainingIndex = index + 1; remainingIndex < coordinates.length; remainingIndex += 1) {
      nextRemainingDistance += getDistanceMeters(coordinates[remainingIndex - 1], coordinates[remainingIndex]);
    }

    remainingDistance = nextRemainingDistance;
  }

  return remainingDistance;
}
