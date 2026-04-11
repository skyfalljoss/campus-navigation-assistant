export const SCHEDULE_DAYS = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
] as const;

export const LEGACY_SCHEDULE_SLOTS = [
  { key: "09:30", startTime: "09:30", endTime: "10:30" },
  { key: "10:30", startTime: "10:30", endTime: "11:30" },
  { key: "11:30", startTime: "11:30", endTime: "12:30" },
  { key: "13:30", startTime: "13:30", endTime: "14:30" },
  { key: "14:30", startTime: "14:30", endTime: "15:30" },
  { key: "15:30", startTime: "15:30", endTime: "16:30" },
  { key: "16:30", startTime: "16:30", endTime: "17:30" },
  { key: "17:30", startTime: "17:30", endTime: "18:30" },
] as const;

export const SCHEDULE_TIME_STEP_MINUTES = 15;
export const SCHEDULE_DISPLAY_ROW_MINUTES = 30;
export const DEFAULT_SCHEDULE_START_TIME = "09:30";
export const DEFAULT_SCHEDULE_END_TIME = "10:30";
export const DEFAULT_SCHEDULE_DAY = "mon";

export type ScheduleDay = (typeof SCHEDULE_DAYS)[number]["key"];

export interface ScheduleTimeRangeLike {
  id?: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
}

export function isScheduleDay(value: string): value is ScheduleDay {
  return SCHEDULE_DAYS.some((day) => day.key === value);
}

export function isScheduleTimeValue(value: string) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
}

export function scheduleTimeToMinutes(value: string) {
  if (!isScheduleTimeValue(value)) {
    return null;
  }

  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function scheduleMinutesToTime(totalMinutes: number) {
  const safeMinutes = Math.max(0, Math.min(24 * 60 - SCHEDULE_TIME_STEP_MINUTES, totalMinutes));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function snapScheduleMinutes(totalMinutes: number, step = SCHEDULE_TIME_STEP_MINUTES) {
  return Math.round(totalMinutes / step) * step;
}

export function floorScheduleMinutes(totalMinutes: number, step = SCHEDULE_TIME_STEP_MINUTES) {
  return Math.floor(totalMinutes / step) * step;
}

export function snapScheduleTime(value: string, step = SCHEDULE_TIME_STEP_MINUTES) {
  const totalMinutes = scheduleTimeToMinutes(value);
  if (totalMinutes === null) {
    return null;
  }

  return scheduleMinutesToTime(snapScheduleMinutes(totalMinutes, step));
}

export function compareScheduleTimes(left: string, right: string) {
  return (scheduleTimeToMinutes(left) ?? 0) - (scheduleTimeToMinutes(right) ?? 0);
}

export function formatScheduleTimeLabel(value: string) {
  const totalMinutes = scheduleTimeToMinutes(value);
  if (totalMinutes === null) {
    return value;
  }

  const hours24 = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const suffix = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;

  return `${hours12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

export function getScheduleDurationMinutes(startTime: string, endTime: string) {
  const startMinutes = scheduleTimeToMinutes(startTime);
  const endMinutes = scheduleTimeToMinutes(endTime);
  if (startMinutes === null || endMinutes === null) {
    return null;
  }

  return endMinutes - startMinutes;
}

export function getShiftedScheduleRange(startTime: string, endTime: string, nextStartTime: string) {
  const durationMinutes = getScheduleDurationMinutes(startTime, endTime);
  const nextStartMinutes = scheduleTimeToMinutes(nextStartTime);
  if (durationMinutes === null || nextStartMinutes === null) {
    return null;
  }

  return {
    startTime: nextStartTime,
    endTime: scheduleMinutesToTime(nextStartMinutes + durationMinutes),
  };
}

export function parseScheduleTimeInput(value: string) {
  const normalizedValue = value.trim().toLowerCase().replaceAll(".", "").replace(/\s+/g, " ");

  if (!normalizedValue) {
    return null;
  }

  if (isScheduleTimeValue(normalizedValue)) {
    return normalizedValue;
  }

  const compactMatch = normalizedValue.match(/^(\d{1,2})(?::?(\d{2}))?\s*(am|pm)?$/);
  if (!compactMatch) {
    return null;
  }

  let hours = Number(compactMatch[1]);
  const minutes = Number(compactMatch[2] ?? "0");
  const suffix = compactMatch[3] ?? null;

  if (minutes >= 60) {
    return null;
  }

  if (suffix) {
    if (hours < 1 || hours > 12) {
      return null;
    }

    if (suffix === "am") {
      hours = hours === 12 ? 0 : hours;
    } else {
      hours = hours === 12 ? 12 : hours + 12;
    }
  } else if (hours > 23) {
    return null;
  }

  return snapScheduleTime(`${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`);
}

export function getLegacyScheduleSlot(slotKey: string) {
  return LEGACY_SCHEDULE_SLOTS.find((slot) => slot.key === slotKey) ?? null;
}

export function parseLegacyScheduleSlotInput(value: string) {
  const normalizedValue = value.trim().toLowerCase().replace(/\s+/g, " ");
  const directSlot = LEGACY_SCHEDULE_SLOTS.find((slot) => slot.key === normalizedValue);
  if (directSlot) {
    return directSlot;
  }

  return (
    LEGACY_SCHEDULE_SLOTS.find((slot) => {
      const startLabel = formatScheduleTimeLabel(slot.startTime).toLowerCase();
      const endLabel = formatScheduleTimeLabel(slot.endTime).toLowerCase();

      return (
        startLabel === normalizedValue ||
        `${startLabel} - ${endLabel}` === normalizedValue ||
        `${startLabel}–${endLabel}` === normalizedValue
      );
    }) ?? null
  );
}

export function isScheduleRangeValid(startTime: string, endTime: string) {
  const durationMinutes = getScheduleDurationMinutes(startTime, endTime);
  return durationMinutes !== null && durationMinutes > 0;
}

export function scheduleRangesOverlap(startTime: string, endTime: string, otherStartTime: string, otherEndTime: string) {
  const startMinutes = scheduleTimeToMinutes(startTime);
  const endMinutes = scheduleTimeToMinutes(endTime);
  const otherStartMinutes = scheduleTimeToMinutes(otherStartTime);
  const otherEndMinutes = scheduleTimeToMinutes(otherEndTime);

  if (startMinutes === null || endMinutes === null || otherStartMinutes === null || otherEndMinutes === null) {
    return false;
  }

  return startMinutes < otherEndMinutes && otherStartMinutes < endMinutes;
}

export function getScheduleConflictIds<T extends ScheduleTimeRangeLike>(entries: T[]) {
  const conflictingIds = new Set<string>();

  for (let index = 0; index < entries.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < entries.length; otherIndex += 1) {
      const left = entries[index];
      const right = entries[otherIndex];
      if (left.dayOfWeek !== right.dayOfWeek) {
        continue;
      }

      if (!scheduleRangesOverlap(left.startTime, left.endTime, right.startTime, right.endTime)) {
        continue;
      }

      if (left.id) {
        conflictingIds.add(left.id);
      }

      if (right.id) {
        conflictingIds.add(right.id);
      }
    }
  }

  return conflictingIds;
}

export function buildScheduleTimelineTimes(entries: ScheduleTimeRangeLike[], bufferSteps = 1) {
  if (entries.length === 0) {
    return [DEFAULT_SCHEDULE_START_TIME, DEFAULT_SCHEDULE_END_TIME];
  }

  let earliest = Number.POSITIVE_INFINITY;
  let latest = Number.NEGATIVE_INFINITY;

  for (const entry of entries) {
    const startMinutes = scheduleTimeToMinutes(entry.startTime);
    const endMinutes = scheduleTimeToMinutes(entry.endTime);
    if (startMinutes === null || endMinutes === null) {
      continue;
    }

    earliest = Math.min(earliest, startMinutes);
    latest = Math.max(latest, endMinutes);
  }

  if (!Number.isFinite(earliest) || !Number.isFinite(latest)) {
    return [DEFAULT_SCHEDULE_START_TIME, DEFAULT_SCHEDULE_END_TIME];
  }

  const startBoundary = Math.max(0, earliest - bufferSteps * SCHEDULE_TIME_STEP_MINUTES);
  const endBoundary = Math.min(24 * 60, latest + bufferSteps * SCHEDULE_TIME_STEP_MINUTES);
  const times: string[] = [];

  for (let minute = startBoundary; minute <= endBoundary; minute += SCHEDULE_TIME_STEP_MINUTES) {
    times.push(scheduleMinutesToTime(minute));
  }

  return Array.from(new Set(times)).sort(compareScheduleTimes);
}

export function buildScheduleVisibleTimeRows(entries: ScheduleTimeRangeLike[], extraPaddingSteps = 1) {
  if (entries.length === 0) {
    return [DEFAULT_SCHEDULE_START_TIME];
  }

  const times = new Set<string>();

  for (const entry of entries) {
    const startMinutes = scheduleTimeToMinutes(entry.startTime);
    const endMinutes = scheduleTimeToMinutes(entry.endTime);
    if (startMinutes === null || endMinutes === null) {
      continue;
    }

    const displayStartMinutes = floorScheduleMinutes(startMinutes, SCHEDULE_DISPLAY_ROW_MINUTES);
    times.add(scheduleMinutesToTime(displayStartMinutes));

    for (let step = 1; step <= extraPaddingSteps; step += 1) {
      times.add(scheduleMinutesToTime(Math.max(0, displayStartMinutes - step * SCHEDULE_DISPLAY_ROW_MINUTES)));
      times.add(scheduleMinutesToTime(Math.max(0, Math.min(24 * 60 - SCHEDULE_DISPLAY_ROW_MINUTES, displayStartMinutes + step * SCHEDULE_DISPLAY_ROW_MINUTES))));
    }
  }

  return Array.from(times).sort(compareScheduleTimes);
}

export function getScheduleDisplayRowStart(value: string) {
  const totalMinutes = scheduleTimeToMinutes(value);
  if (totalMinutes === null) {
    return null;
  }

  return scheduleMinutesToTime(floorScheduleMinutes(totalMinutes, SCHEDULE_DISPLAY_ROW_MINUTES));
}

export function buildScheduleTimeOptions(entries: ScheduleTimeRangeLike[], extraPaddingSteps = 4) {
  const visibleTimeline = buildScheduleTimelineTimes(entries, extraPaddingSteps);
  const times = new Set<string>(visibleTimeline);
  times.add(DEFAULT_SCHEDULE_START_TIME);
  times.add(DEFAULT_SCHEDULE_END_TIME);

  if (entries.length > 0) {
    const earliest = scheduleTimeToMinutes(visibleTimeline[0]);
    const latest = scheduleTimeToMinutes(visibleTimeline[visibleTimeline.length - 1]);

    if (earliest !== null && latest !== null) {
      for (let minute = Math.max(0, earliest - extraPaddingSteps * SCHEDULE_TIME_STEP_MINUTES); minute <= Math.min(24 * 60, latest + extraPaddingSteps * SCHEDULE_TIME_STEP_MINUTES); minute += SCHEDULE_TIME_STEP_MINUTES) {
        times.add(scheduleMinutesToTime(minute));
      }
    }
  }

  return Array.from(times).sort(compareScheduleTimes);
}
