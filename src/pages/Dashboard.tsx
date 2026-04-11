import { SignInButton, useAuth } from "@clerk/clerk-react";
import { DndContext, PointerSensor, TouchSensor, closestCenter, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Search, Library, Building2, Wrench, Dumbbell, Bus, ArrowRight, Navigation, Map as MapIcon, Coffee, Car, CalendarDays, Plus, X, PencilLine, Trash2, Upload, Download, ChevronDown, ChevronUp, AlertTriangle, RefreshCw, GripVertical, type LucideIcon } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { BUILDINGS } from "../data/buildings";
import { bulkUpsertScheduleEntries, createScheduleEntry, deleteScheduleEntry, fetchRecentLocations, fetchScheduleEntries, fetchShuttleOverview, type RecentLocationRecord, type ScheduleEntryRecord, type ShuttleOverviewRecord, updateScheduleEntry } from "../lib/api";
import { buildRoute, CAMPUS_CENTER, formatEta, getWalkabilityLabel, readStoredUserLocation, writeStoredUserLocation, type Coordinates } from "../lib/navigation";
import { subscribeToRecentDestinationsUpdates } from "../lib/recent-destinations";
import {
  DEFAULT_SCHEDULE_DAY,
  DEFAULT_SCHEDULE_END_TIME,
  DEFAULT_SCHEDULE_START_TIME,
  SCHEDULE_DAYS,
  buildScheduleTimeOptions,
  buildScheduleVisibleTimeRows,
  compareScheduleTimes,
  formatScheduleTimeLabel,
  getScheduleDisplayRowStart,
  getScheduleConflictIds,
  scheduleMinutesToTime,
  scheduleTimeToMinutes,
  getShiftedScheduleRange,
  isScheduleDay,
  isScheduleRangeValid,
  parseLegacyScheduleSlotInput,
  parseScheduleTimeInput,
  type ScheduleDay,
} from "../lib/schedule";

interface DestinationCard {
  key: string;
  destinationId: string;
  title: string;
  subtitle: string;
  to: string;
  icon: LucideIcon;
  accentClassName: string;
}

interface ScheduleFormState {
  course: string;
  room: string;
  buildingId: string;
  dayOfWeek: ScheduleDay;
  startTime: string;
  endTime: string;
}

interface ScheduleCardProps {
  entry: ScheduleEntryRecord;
  appearance: ReturnType<typeof getScheduleEntryAppearance>;
  routeTarget: ReturnType<typeof getScheduleRouteTarget>;
  isConflict: boolean;
  isDragging?: boolean;
  onEdit: (entry: ScheduleEntryRecord) => void;
  compact?: boolean;
}

interface ScheduleDropCellProps {
  cellId: string;
  dayLabel: string;
  timeLabel: string;
  isMobile?: boolean;
  children: ReactNode;
}

const SCHEDULE_COLLAPSED_STORAGE_KEY = "usf_dashboard_schedule_collapsed";

function formatDashboardTimestamp(value: string | null) {
  if (!value) {
    return "Live now";
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(parsedDate);
}

function getBuildingById(destinationId: string) {
  const building = BUILDINGS.find((item) => item.id === destinationId);

  if (!building) {
    throw new Error(`Missing building data for ${destinationId}`);
  }

  return building;
}

function getEtaForDestination(currentLocation: Coordinates, destinationId: string) {
  const destination = getBuildingById(destinationId);
  return buildRoute(currentLocation, [destination.lat, destination.lng]);
}

function getDestinationIcon(building: (typeof BUILDINGS)[number]) {
  if (building.id === "lib") {
    return { icon: Library, accentClassName: "text-primary" };
  }

  if (building.id === "rec") {
    return { icon: Dumbbell, accentClassName: "text-secondary" };
  }

  if (building.tags.includes("dining")) {
    return { icon: Coffee, accentClassName: "text-orange-400" };
  }

  if (building.tags.includes("parking") || building.type === "parking") {
    return { icon: Car, accentClassName: "text-blue-400" };
  }

  if (building.name.toLowerCase().includes("engineering")) {
    return { icon: Wrench, accentClassName: "text-primary" };
  }

  return { icon: Building2, accentClassName: building.type === "service" ? "text-secondary" : "text-primary" };
}

function buildRecentDestinationCard(recentLocation: RecentLocationRecord) {
  if (!recentLocation.buildingId) {
    return null;
  }

  const building = BUILDINGS.find((entry) => entry.id === recentLocation.buildingId);
  if (!building) {
    return null;
  }

  const room = recentLocation.roomId ? building.rooms.find((entry) => entry.id === recentLocation.roomId) ?? null : null;
  const { icon, accentClassName } = getDestinationIcon(building);

  return {
    key: recentLocation.id,
    destinationId: building.id,
    title: room ? room.name : building.name,
    subtitle: room ? `${building.name} • ${room.floor}` : building.desc,
    to: room ? `/map?dest=${building.id}&room=${room.id}&navigate=1` : `/map?dest=${building.id}&navigate=1`,
    icon,
    accentClassName,
  } satisfies DestinationCard;
}

function createDefaultScheduleForm(dayOfWeek: ScheduleDay = DEFAULT_SCHEDULE_DAY, startTime: string = DEFAULT_SCHEDULE_START_TIME) {
  const defaultRange = getShiftedScheduleRange(DEFAULT_SCHEDULE_START_TIME, DEFAULT_SCHEDULE_END_TIME, startTime);

  return {
    course: "",
    room: "",
    buildingId: BUILDINGS[0]?.id ?? "",
    dayOfWeek,
    startTime,
    endTime: defaultRange?.endTime ?? DEFAULT_SCHEDULE_END_TIME,
  } satisfies ScheduleFormState;
}

function getScheduleCellKey(dayOfWeek: string, startTime: string) {
  return `${dayOfWeek}:${startTime}`;
}

function getScheduleDragId(entryId: string) {
  return `schedule-entry:${entryId}`;
}

function getScheduleDropCellId(dayOfWeek: string, startTime: string) {
  return `schedule-cell:${dayOfWeek}:${startTime}`;
}

function parseScheduleDropCellId(value: string) {
  const prefix = "schedule-cell:";
  if (!value.startsWith(prefix)) {
    return null;
  }

  const rawValue = value.slice(prefix.length);
  const separatorIndex = rawValue.indexOf(":");
  if (separatorIndex === -1) {
    return null;
  }

  const dayOfWeek = rawValue.slice(0, separatorIndex);
  const startTime = rawValue.slice(separatorIndex + 1);
  if (!dayOfWeek || !startTime) {
    return null;
  }

  return { dayOfWeek, startTime };
}

function getBuildingScheduleLabel(buildingId: string) {
  const building = BUILDINGS.find((entry) => entry.id === buildingId);
  if (!building) {
    return buildingId;
  }

  const buildingCodeMatch = /\(([^)]+)\)/.exec(building.name);
  return buildingCodeMatch?.[1] ?? building.name;
}

function normalizeScheduleRoom(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function formatScheduleLocationLabel(buildingId: string, room: string) {
  const buildingLabel = getBuildingScheduleLabel(buildingId).replace(/\s+/g, "");
  const compactRoom = room.replace(/\s+/g, "");

  if (!compactRoom) {
    return buildingLabel;
  }

  const normalizedBuildingLabel = buildingLabel.toLowerCase();
  const normalizedRoom = compactRoom.toLowerCase();

  return normalizedRoom.startsWith(normalizedBuildingLabel) ? compactRoom.toUpperCase() : `${buildingLabel}${compactRoom}`.toUpperCase();
}

function getScheduleRouteTarget(buildingId: string, room: string) {
  const building = BUILDINGS.find((entry) => entry.id === buildingId);

  if (!building) {
    return {
      to: "/map",
      matchedRoom: null,
      label: "Open map",
    };
  }

  const normalizedRoom = normalizeScheduleRoom(room);
  const matchedRoom = normalizedRoom
    ? building.rooms.find((entry) => {
        const roomId = normalizeScheduleRoom(entry.id);
        const roomName = normalizeScheduleRoom(entry.name);

        return (
          normalizedRoom === roomId ||
          normalizedRoom === roomName ||
          normalizedRoom.includes(roomId) ||
          normalizedRoom.includes(roomName) ||
          roomId.includes(normalizedRoom) ||
          roomName.includes(normalizedRoom)
        );
      }) ?? null
    : null;

  return {
    to: matchedRoom
      ? `/map?dest=${building.id}&room=${matchedRoom.id}&navigate=1`
      : `/map?dest=${building.id}&navigate=1`,
    matchedRoom,
    label: matchedRoom ? `Route to ${matchedRoom.name}` : `Route to ${building.name}`,
  };
}

function escapeCsvValue(value: string) {
  const normalizedValue = value.replaceAll('"', '""');
  return `"${normalizedValue}"`;
}

function parseScheduleDayInput(value: string) {
  const normalizedValue = value.trim().toLowerCase();

  if (normalizedValue.startsWith("mon")) return "mon" satisfies ScheduleDay;
  if (normalizedValue.startsWith("tue")) return "tue" satisfies ScheduleDay;
  if (normalizedValue.startsWith("wed")) return "wed" satisfies ScheduleDay;
  if (normalizedValue.startsWith("thu")) return "thu" satisfies ScheduleDay;
  if (normalizedValue.startsWith("fri")) return "fri" satisfies ScheduleDay;

  return null;
}

function resolveScheduleBuildingId(value: string) {
  const normalizedValue = value.trim().toLowerCase();

  const building = BUILDINGS.find((entry) => {
    const buildingCode = /\(([^)]+)\)/.exec(entry.name)?.[1]?.toLowerCase() ?? "";
    return (
      entry.id.toLowerCase() === normalizedValue ||
      buildingCode === normalizedValue ||
      entry.name.toLowerCase() === normalizedValue ||
      entry.name.toLowerCase().includes(normalizedValue)
    );
  });

  return building?.id ?? null;
}

function parseBulkScheduleText(input: string) {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const entries = lines.map((line, index) => {
    const separator = line.includes("|") ? "|" : ",";
    const parts = line.split(separator).map((part) => part.trim());

    if (parts.length < 5) {
      throw new Error(`Line ${index + 1} must have 5 or 6 values: day | start time | end time | course | room | building.`);
    }

    const isLegacyLine = parts.length === 5;
    const [dayInput, firstTimeInput, secondTimeInput, courseInput, roomInput, buildingInput] = isLegacyLine
      ? [parts[0], parts[1], "", parts[2], parts[3], parts[4]]
      : [parts[0], parts[1], parts[2], parts[3], parts[4], parts[5]];
    const dayOfWeek = parseScheduleDayInput(dayInput);
    const legacySlot = isLegacyLine ? parseLegacyScheduleSlotInput(firstTimeInput) : null;
    const startTime = legacySlot?.startTime ?? parseScheduleTimeInput(firstTimeInput);
    const endTime = legacySlot?.endTime ?? parseScheduleTimeInput(secondTimeInput);
    const buildingId = resolveScheduleBuildingId(buildingInput);
    const course = courseInput;
    const room = roomInput;

    if (!dayOfWeek) {
      throw new Error(`Line ${index + 1} has an invalid day: ${dayInput}.`);
    }

    if (!startTime || !endTime || !isScheduleRangeValid(startTime, endTime)) {
      throw new Error(`Line ${index + 1} has an invalid time range.`);
    }

    if (!buildingId) {
      throw new Error(`Line ${index + 1} has an unknown building: ${buildingInput}.`);
    }

    if (!course || !room) {
      throw new Error(`Line ${index + 1} must include both course and room.`);
    }

    return {
      course,
      room,
      buildingId,
      dayOfWeek,
      startTime,
      endTime,
    };
  });

  return entries;
}

function getScheduleEntryAppearance(buildingId: string) {
  const building = BUILDINGS.find((entry) => entry.id === buildingId);

  if (building?.type === "parking") {
    return {
      label: "Parking",
      cornerClassName: "border-t-tertiary",
      cardClassName: "border-tertiary/25 bg-tertiary/10",
      badgeClassName: "bg-tertiary/15 text-tertiary border-tertiary/20",
      actionClassName: "bg-tertiary text-on-tertiary hover:brightness-110",
      helperTextClassName: "text-tertiary",
    };
  }

  if (building?.type === "service") {
    return {
      label: "Service",
      cornerClassName: "border-t-secondary",
      cardClassName: "border-secondary/20 bg-secondary/10",
      badgeClassName: "bg-secondary/15 text-secondary border-secondary/20",
      actionClassName: "bg-secondary text-on-secondary hover:brightness-110",
      helperTextClassName: "text-secondary",
    };
  }

  return {
    label: "Academic",
    cornerClassName: "border-t-primary",
    cardClassName: "border-primary/15 bg-primary/8",
    badgeClassName: "bg-primary/12 text-primary border-primary/15",
    actionClassName: "bg-primary text-on-primary hover:brightness-110",
    helperTextClassName: "text-primary",
  };
}

function ScheduleDropCell({ cellId, dayLabel, timeLabel, isMobile = false, children }: ScheduleDropCellProps) {
  const { isOver, setNodeRef } = useDroppable({ id: cellId });

  return (
    <div
      ref={setNodeRef}
      className={`group rounded-[18px] border p-1.5 transition-all ${isOver ? "border-primary/60 bg-primary/10 shadow-[0_0_0_1px_rgba(0,103,71,0.18),inset_0_0_0_1px_rgba(0,103,71,0.14)]" : "border-outline-variant/12 bg-surface-container-lowest/45"} ${isMobile ? "min-h-[88px]" : "min-h-[96px]"}`}
      aria-label={`Drop a class on ${dayLabel} at ${timeLabel}`}
    >
      {isOver ? (
        <div className="mb-1.5 flex items-center justify-between rounded-[12px] border border-primary/20 bg-primary/12 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
          <span>Move Here</span>
          <span>{dayLabel} {timeLabel}</span>
        </div>
      ) : null}
      {children}
    </div>
  );
}

function ScheduleCard({ entry, appearance, routeTarget, isConflict, isDragging = false, onEdit, compact = false }: ScheduleCardProps) {
  const { attributes, listeners, setActivatorNodeRef, setNodeRef, transform } = useDraggable({
    id: getScheduleDragId(entry.id),
  });
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative rounded-[16px] border shadow-[0_8px_18px_rgb(0,0,0,0.03)] transition-all ${compact ? "p-2.5" : "p-3.5"} ${appearance.cardClassName} ${isConflict ? "border-amber-400/70 bg-amber-500/12" : "border-outline-variant/14 dark:border-white/8 dark:bg-white/[0.045]"} ${isDragging ? "z-20 shadow-[0_18px_34px_rgba(0,0,0,0.16)] ring-2 ring-primary/20" : ""}`}
    >
      <span className={`absolute right-0 top-0 h-0 w-0 border-l-[12px] border-l-transparent border-t-[12px] ${isConflict ? "border-t-amber-400" : appearance.cornerClassName} opacity-80`} />
      <div className={`flex items-start justify-between ${compact ? "gap-2" : "gap-3"}`}>
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...listeners}
          {...attributes}
          className="min-w-0 flex-1 grow cursor-grab text-left active:cursor-grabbing"
          title="Drag to move this class"
        >
          <div className={`flex items-start ${compact ? "gap-2" : "gap-2.5"}`}>
            <span className={`mt-0.5 inline-flex shrink-0 items-center justify-center rounded-full border border-outline-variant/25 bg-surface-container-high text-on-surface-variant/80 ${compact ? "h-5 w-5" : "h-6 w-6"}`}>
              <GripVertical className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
            </span>
            <div className={`min-w-0 flex-1 grow ${compact ? "space-y-1.5" : "space-y-2"}`}>
              <div>
                <p className={`font-headline font-bold tracking-[-0.01em] text-on-surface leading-tight ${compact ? "text-[13px]" : "text-[15px]"}`}>{entry.course}</p>
              </div>
              <div className="space-y-1.5">
                <p className={`font-semibold uppercase tracking-[0.08em] leading-snug text-on-surface-variant ${compact ? "text-[10px]" : "text-[11px]"}`}>
                  {formatScheduleLocationLabel(entry.buildingId, entry.room)}
                </p>
                <p className={`whitespace-nowrap font-bold leading-none text-primary dark:text-primary ${compact ? "text-[11px]" : "text-[12px]"}`}>
                  {formatScheduleTimeLabel(entry.startTime)} - {formatScheduleTimeLabel(entry.endTime)}
                </p>
              </div>
            </div>
          </div>
        </button>
        <div className={`flex items-center shrink-0 ${compact ? "gap-1" : "gap-1"}`}>
          <Link
            to={routeTarget.to}
            title={routeTarget.label}
            className={`inline-flex items-center justify-center rounded-full transition-colors ${compact ? "h-7 w-7" : "h-7.5 w-7.5"} ${appearance.actionClassName}`}
          >
            <Navigation className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
          </Link>
          <button
            type="button"
            onClick={() => onEdit(entry)}
            className={`inline-flex items-center justify-center rounded-full bg-surface-container-high text-primary transition-colors hover:bg-surface-container-highest ${compact ? "h-7 w-7" : "h-7.5 w-7.5"}`}
            title="Edit class"
          >
            <PencilLine className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
          </button>
        </div>
      </div>
      <div className={`flex flex-wrap items-center justify-between gap-2 border-t border-outline-variant/10 dark:border-white/6 ${compact ? "mt-2.5 pt-2" : "mt-3 pt-2.5"}`}>
        <span className={`inline-flex items-center rounded-full border font-bold uppercase tracking-[0.16em] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ${compact ? "px-2.5 py-1 text-[8px]" : "px-2.5 py-1 text-[9px]"} ${isConflict ? "border-amber-400/40 bg-amber-500/15 text-amber-700 dark:text-amber-300" : appearance.badgeClassName}`}>
          {isConflict ? "Conflict" : appearance.label}
        </span>
        {isConflict ? (
          <span className={`inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-300 ${compact ? "text-[9px]" : "text-[10px]"}`}>
            <AlertTriangle className="h-3 w-3" /> Overlaps another class
          </span>
        ) : null}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { getToken, isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [recentDestinations, setRecentDestinations] = useState<DestinationCard[]>([]);
  const [recentDestinationsError, setRecentDestinationsError] = useState<string | null>(null);
  const [isLoadingRecentDestinations, setIsLoadingRecentDestinations] = useState(false);
  const [recentDestinationsVersion, setRecentDestinationsVersion] = useState(0);
  const [shuttleOverview, setShuttleOverview] = useState<ShuttleOverviewRecord | null>(null);
  const [shuttleError, setShuttleError] = useState<string | null>(null);
  const [isLoadingShuttle, setIsLoadingShuttle] = useState(true);
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntryRecord[]>([]);
  const [scheduleLoadError, setScheduleLoadError] = useState<string | null>(null);
  const [scheduleMutationError, setScheduleMutationError] = useState<string | null>(null);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [isDeletingSchedule, setIsDeletingSchedule] = useState(false);
  const [isBulkImportingSchedule, setIsBulkImportingSchedule] = useState(false);
  const [editingScheduleEntryId, setEditingScheduleEntryId] = useState<string | null>(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isBulkScheduleModalOpen, setIsBulkScheduleModalOpen] = useState(false);
  const [scheduleWarningMessage, setScheduleWarningMessage] = useState<string | null>(null);
  const [activeDragEntryId, setActiveDragEntryId] = useState<string | null>(null);
  const [bulkScheduleText, setBulkScheduleText] = useState("");
  const [bulkScheduleError, setBulkScheduleError] = useState<string | null>(null);
  const [selectedMobileScheduleDay, setSelectedMobileScheduleDay] = useState<ScheduleDay>("mon");
  const [isScheduleCollapsed, setIsScheduleCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }

    return window.localStorage.getItem(SCHEDULE_COLLAPSED_STORAGE_KEY) !== "false";
  });
  const [scheduleForm, setScheduleForm] = useState<ScheduleFormState>(() => createDefaultScheduleForm());
  const [locationState, setLocationState] = useState(() => {
    const storedLocation = readStoredUserLocation();

    return {
      currentLocation: storedLocation ?? CAMPUS_CENTER,
      source: storedLocation ? "saved" : "campus",
    } as { currentLocation: Coordinates; source: "live" | "saved" | "campus" };
  });

  useEffect(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const liveLocation: Coordinates = [position.coords.latitude, position.coords.longitude];
        setLocationState({ currentLocation: liveLocation, source: "live" });
        writeStoredUserLocation(liveLocation);
      },
      () => {
        // Keep the best available fallback if live geolocation is unavailable.
      },
      {
        enableHighAccuracy: true,
        maximumAge: 60000,
        timeout: 10000,
      }
    );
  }, []);

  useEffect(() => {
    return subscribeToRecentDestinationsUpdates(() => {
      setRecentDestinationsVersion((current) => current + 1);
    });
  }, []);

  useEffect(() => {
    if (!isAuthLoaded) {
      return;
    }

    if (!isSignedIn) {
      setRecentDestinations([]);
      setRecentDestinationsError(null);
      setIsLoadingRecentDestinations(false);
      return;
    }

    let isCancelled = false;

    async function loadRecentDestinations() {
      setIsLoadingRecentDestinations(true);

      try {
        const token = await getToken();
        if (!token) {
          throw new Error("Unable to load your recent destinations.");
        }

        const recentLocations = await fetchRecentLocations(token);
        const cards = recentLocations
          .map(buildRecentDestinationCard)
          .filter((card): card is DestinationCard => Boolean(card))
          .slice(0, 4);

        if (!isCancelled) {
          setRecentDestinations(cards);
          setRecentDestinationsError(null);
        }
      } catch (error) {
        if (!isCancelled) {
          setRecentDestinations([]);
          setRecentDestinationsError(error instanceof Error ? error.message : "Unable to load your recent destinations.");
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingRecentDestinations(false);
        }
      }
    }

    void loadRecentDestinations();

    return () => {
      isCancelled = true;
    };
  }, [getToken, isAuthLoaded, isSignedIn, recentDestinationsVersion]);

  useEffect(() => {
    let isCancelled = false;

    async function loadShuttleOverview(isBackgroundRefresh = false) {
      if (!isBackgroundRefresh) {
        setIsLoadingShuttle(true);
      }

      try {
        const overview = await fetchShuttleOverview();
        if (!isCancelled) {
          setShuttleOverview(overview);
          setShuttleError(null);
        }
      } catch (error) {
        if (!isCancelled) {
          setShuttleError(error instanceof Error ? error.message : "Unable to load Bull Runner live status right now.");
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingShuttle(false);
        }
      }
    }

    void loadShuttleOverview();
    const intervalId = window.setInterval(() => {
      void loadShuttleOverview(true);
    }, 60000);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!isAuthLoaded) {
      return;
    }

    if (!isSignedIn) {
      setScheduleEntries([]);
      setScheduleLoadError(null);
      setScheduleMutationError(null);
      setScheduleWarningMessage(null);
      setIsLoadingSchedule(false);
      setIsScheduleModalOpen(false);
      return;
    }

    let isCancelled = false;

    async function loadScheduleEntries() {
      setIsLoadingSchedule(true);

      try {
        const token = await getToken();
        if (!token) {
          throw new Error("Unable to load your schedule right now.");
        }

        const entries = await fetchScheduleEntries(token);
        if (!isCancelled) {
          setScheduleEntries(entries);
          setScheduleWarningMessage(getScheduleConflictIds(entries).size > 0 ? "Some classes overlap. Conflicts are highlighted in the planner." : null);
          setScheduleLoadError(null);
        }
      } catch (error) {
        if (!isCancelled) {
          setScheduleEntries([]);
          setScheduleLoadError(error instanceof Error ? error.message : "Unable to load your schedule right now.");
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingSchedule(false);
        }
      }
    }

    void loadScheduleEntries();

    return () => {
      isCancelled = true;
    };
  }, [getToken, isAuthLoaded, isSignedIn]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(SCHEDULE_COLLAPSED_STORAGE_KEY, String(isScheduleCollapsed));
  }, [isScheduleCollapsed]);

  const scheduleEntriesByCell = useMemo(() => {
    const entryMap = new Map<string, ScheduleEntryRecord[]>();

    for (const entry of scheduleEntries) {
      const displayStartTime = getScheduleDisplayRowStart(entry.startTime) ?? entry.startTime;
      const cellKey = getScheduleCellKey(entry.dayOfWeek, displayStartTime);
      const existingEntries = entryMap.get(cellKey) ?? [];
      existingEntries.push(entry);
      entryMap.set(cellKey, existingEntries.sort((left, right) => compareScheduleTimes(left.endTime, right.endTime)));
    }

    return entryMap;
  }, [scheduleEntries]);

  const scheduleConflictIds = useMemo(() => getScheduleConflictIds(scheduleEntries), [scheduleEntries]);

  const visibleScheduleRows = useMemo(() => buildScheduleVisibleTimeRows(scheduleEntries), [scheduleEntries]);

  const scheduleTimeOptions = useMemo(() => buildScheduleTimeOptions(scheduleEntries), [scheduleEntries]);

  const activeDraggedEntry = useMemo(
    () => scheduleEntries.find((entry) => entry.id === activeDragEntryId) ?? null,
    [activeDragEntryId, scheduleEntries]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 2 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } })
  );

  const topShuttleRoutes = useMemo(() => {
    return [...(shuttleOverview?.routes ?? [])]
      .sort((left, right) => right.activeVehicleCount - left.activeVehicleCount || left.name.localeCompare(right.name))
      .slice(0, 4);
  }, [shuttleOverview]);

  const primaryShuttleAlert = shuttleOverview?.alerts[0] ?? null;

  const activeScheduleRoute = useMemo(() => {
    return getScheduleRouteTarget(scheduleForm.buildingId, scheduleForm.room);
  }, [scheduleForm.buildingId, scheduleForm.room]);

  const activeScheduleAppearance = useMemo(() => {
    return getScheduleEntryAppearance(scheduleForm.buildingId);
  }, [scheduleForm.buildingId]);

  const scheduleFormTimeError = useMemo(() => {
    const normalizedStartTime = parseScheduleTimeInput(scheduleForm.startTime);
    const normalizedEndTime = parseScheduleTimeInput(scheduleForm.endTime);

    if (!normalizedStartTime || !normalizedEndTime) {
      return "Use a valid start and end time.";
    }

    if (!isScheduleRangeValid(normalizedStartTime, normalizedEndTime)) {
      return "End time must be after start time.";
    }

    return null;
  }, [scheduleForm.endTime, scheduleForm.startTime]);

  const scheduleFormHasConflict = useMemo(() => {
    const normalizedStartTime = parseScheduleTimeInput(scheduleForm.startTime);
    const normalizedEndTime = parseScheduleTimeInput(scheduleForm.endTime);
    if (!normalizedStartTime || !normalizedEndTime || !isScheduleRangeValid(normalizedStartTime, normalizedEndTime)) {
      return false;
    }

    return getScheduleConflictIds([
      ...scheduleEntries.filter((entry) => entry.id !== editingScheduleEntryId),
      {
        id: editingScheduleEntryId ?? "draft-entry",
        userId: "draft",
        course: scheduleForm.course,
        room: scheduleForm.room,
        buildingId: scheduleForm.buildingId,
        dayOfWeek: scheduleForm.dayOfWeek,
        startTime: normalizedStartTime,
        endTime: normalizedEndTime,
        createdAt: "",
        updatedAt: "",
      },
    ]).has(editingScheduleEntryId ?? "draft-entry");
  }, [editingScheduleEntryId, scheduleEntries, scheduleForm.buildingId, scheduleForm.course, scheduleForm.dayOfWeek, scheduleForm.endTime, scheduleForm.room, scheduleForm.startTime]);

  const sortedScheduleEntries = useMemo(() => {
    const dayOrder = new Map(SCHEDULE_DAYS.map((day, index) => [day.key, index]));

    return [...scheduleEntries].sort((left, right) => {
      const leftDayOrder = isScheduleDay(left.dayOfWeek) ? (dayOrder.get(left.dayOfWeek) ?? 99) : 99;
      const rightDayOrder = isScheduleDay(right.dayOfWeek) ? (dayOrder.get(right.dayOfWeek) ?? 99) : 99;
      const dayDelta = leftDayOrder - rightDayOrder;
      if (dayDelta !== 0) {
        return dayDelta;
      }

      return compareScheduleTimes(left.startTime, right.startTime) || compareScheduleTimes(left.endTime, right.endTime);
    });
  }, [scheduleEntries]);

  const scheduleSummaryText = useMemo(() => {
    if (scheduleEntries.length === 0) {
      return isSignedIn ? "No classes added yet" : "Sign in to manage schedule";
    }

    const uniqueDays = new Set(scheduleEntries.map((entry) => entry.dayOfWeek)).size;
    return `${scheduleEntries.length} class${scheduleEntries.length === 1 ? "" : "es"} across ${uniqueDays} day${uniqueDays === 1 ? "" : "s"}`;
  }, [isSignedIn, scheduleEntries]);

  const estimateNote =
    locationState.source === "live"
      ? "ETAs are based on your current location."
      : locationState.source === "saved"
        ? "ETAs use your last known location until live GPS refreshes."
        : "ETAs are estimated from the center of campus until location is available.";

  const handleSearch = (e?: FormEvent) => {
    e?.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/map?q=${encodeURIComponent(searchQuery)}`);
    } else {
      navigate('/map');
    }
  };

  const handleMobileSearchClick = () => {
    if (window.innerWidth < 768) {
      navigate('/map');
    }
  };

  const closeScheduleModal = () => {
    setIsScheduleModalOpen(false);
    setEditingScheduleEntryId(null);
    setScheduleMutationError(null);
  };

  const closeBulkScheduleModal = () => {
    if (isBulkImportingSchedule) {
      return;
    }

    setIsBulkScheduleModalOpen(false);
    setBulkScheduleError(null);
  };

  const openCreateScheduleModal = (dayOfWeek: ScheduleDay, startTime: string = DEFAULT_SCHEDULE_START_TIME) => {
    setEditingScheduleEntryId(null);
    setScheduleForm(createDefaultScheduleForm(dayOfWeek, startTime));
    setScheduleMutationError(null);
    setIsScheduleModalOpen(true);
  };

  const openEditScheduleModal = (entry: ScheduleEntryRecord) => {
    setEditingScheduleEntryId(entry.id);
    setScheduleForm({
      course: entry.course,
      room: entry.room,
      buildingId: entry.buildingId,
      dayOfWeek: entry.dayOfWeek as ScheduleDay,
      startTime: entry.startTime,
      endTime: entry.endTime,
    });
    setScheduleMutationError(null);
    setIsScheduleModalOpen(true);
  };

  const handleScheduleFieldChange = <K extends keyof ScheduleFormState>(field: K, value: ScheduleFormState[K]) => {
    setScheduleForm((current) => ({
      ...current,
      ...(field === "startTime"
        ? (() => {
            const nextStartTime = parseScheduleTimeInput(String(value)) ?? String(value);
            const shiftedRange = getShiftedScheduleRange(current.startTime, current.endTime, nextStartTime);

            return {
              startTime: String(value),
              endTime: shiftedRange?.endTime ?? current.endTime,
            };
          })()
        : { [field]: value }),
    }));
  };

  const handleScheduleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isSignedIn) {
      setScheduleMutationError("Sign in to manage your schedule.");
      return;
    }

    const normalizedStartTime = parseScheduleTimeInput(scheduleForm.startTime);
    const normalizedEndTime = parseScheduleTimeInput(scheduleForm.endTime);
    if (!normalizedStartTime || !normalizedEndTime || !isScheduleRangeValid(normalizedStartTime, normalizedEndTime)) {
      setScheduleMutationError("Enter a valid start and end time.");
      return;
    }

    setIsSavingSchedule(true);
    setScheduleMutationError(null);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Unable to save your schedule right now.");
      }

      const payload = {
        course: scheduleForm.course.trim(),
        room: scheduleForm.room.trim(),
        buildingId: scheduleForm.buildingId,
        dayOfWeek: scheduleForm.dayOfWeek,
        startTime: normalizedStartTime,
        endTime: normalizedEndTime,
      };

      const entry = editingScheduleEntryId
        ? await updateScheduleEntry(token, editingScheduleEntryId, payload)
        : await createScheduleEntry(token, payload);

      setScheduleEntries((current) => {
        const nextEntries = current.filter((item) => item.id !== entry.id);
        return [...nextEntries, entry];
      });
      const nextEntries = [...scheduleEntries.filter((item) => item.id !== entry.id), entry];
      setScheduleWarningMessage(getScheduleConflictIds(nextEntries).has(entry.id) ? "This class overlaps another one in your schedule." : null);
      setScheduleLoadError(null);
      closeScheduleModal();
    } catch (error) {
      setScheduleMutationError(error instanceof Error ? error.message : "Unable to save your schedule right now.");
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const handleScheduleDelete = async () => {
    if (!editingScheduleEntryId || !isSignedIn) {
      return;
    }

    setIsDeletingSchedule(true);
    setScheduleMutationError(null);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Unable to update your schedule right now.");
      }

      await deleteScheduleEntry(token, editingScheduleEntryId);
      setScheduleEntries((current) => current.filter((entry) => entry.id !== editingScheduleEntryId));
      setScheduleLoadError(null);
      closeScheduleModal();
    } catch (error) {
      setScheduleMutationError(error instanceof Error ? error.message : "Unable to update your schedule right now.");
    } finally {
      setIsDeletingSchedule(false);
    }
  };

  const handleBulkScheduleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isSignedIn) {
      setBulkScheduleError("Sign in to import your schedule.");
      return;
    }

    setIsBulkImportingSchedule(true);
    setBulkScheduleError(null);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Unable to import your schedule right now.");
      }

      const parsedEntries = parseBulkScheduleText(bulkScheduleText);
      const importedEntries = await bulkUpsertScheduleEntries(token, { entries: parsedEntries });

      setScheduleEntries((current) => {
        return [...current, ...importedEntries];
      });
      setScheduleWarningMessage(importedEntries.length > 0 ? "Imported classes were added. Any overlaps are highlighted in the planner." : null);
      setScheduleLoadError(null);
      setBulkScheduleText("");
      setIsBulkScheduleModalOpen(false);
    } catch (error) {
      setBulkScheduleError(error instanceof Error ? error.message : "Unable to import your schedule right now.");
    } finally {
      setIsBulkImportingSchedule(false);
    }
  };

  const handleScheduleExport = () => {
    if (sortedScheduleEntries.length === 0) {
      return;
    }

    const rows = [
      ["Day", "Start Time", "End Time", "Course", "Room", "Building Code", "Building Name"],
      ...sortedScheduleEntries.map((entry) => {
        const dayLabel = SCHEDULE_DAYS.find((day) => day.key === entry.dayOfWeek)?.label ?? entry.dayOfWeek;
        const building = BUILDINGS.find((item) => item.id === entry.buildingId);

        return [
          dayLabel,
          formatScheduleTimeLabel(entry.startTime),
          formatScheduleTimeLabel(entry.endTime),
          entry.course,
          entry.room,
          getBuildingScheduleLabel(entry.buildingId),
          building?.name ?? entry.buildingId,
        ];
      }),
    ];

    const csv = rows
      .map((row) => row.map((value) => escapeCsvValue(value)).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "campus-navigation-schedule.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleScheduleDragStart = (event: DragStartEvent) => {
    const activeId = String(event.active.id);
    if (!activeId.startsWith("schedule-entry:")) {
      return;
    }

    setActiveDragEntryId(activeId.replace("schedule-entry:", ""));
  };

  const handleScheduleDrop = async (event: DragEndEvent) => {
    setActiveDragEntryId(null);

    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : "";
    if (!activeId.startsWith("schedule-entry:") || !overId) {
      return;
    }

    const entryId = activeId.replace("schedule-entry:", "");
    const draggedEntry = scheduleEntries.find((entry) => entry.id === entryId);
    const dropCell = parseScheduleDropCellId(overId);
    if (!draggedEntry || !dropCell || !isScheduleDay(dropCell.dayOfWeek)) {
      return;
    }

    const shiftedRange = getShiftedScheduleRange(draggedEntry.startTime, draggedEntry.endTime, dropCell.startTime);
    if (!shiftedRange) {
      return;
    }

    const nextEntry = {
      ...draggedEntry,
      dayOfWeek: dropCell.dayOfWeek,
      startTime: shiftedRange.startTime,
      endTime: shiftedRange.endTime,
    };

    const optimisticEntries = scheduleEntries.map((entry) => (entry.id === entryId ? nextEntry : entry));
    setScheduleEntries(optimisticEntries);
    setScheduleWarningMessage(getScheduleConflictIds(optimisticEntries).has(entryId) ? "Class moved, but it now overlaps another class." : null);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Unable to update your schedule right now.");
      }

      const savedEntry = await updateScheduleEntry(token, entryId, {
        course: nextEntry.course,
        room: nextEntry.room,
        buildingId: nextEntry.buildingId,
        dayOfWeek: nextEntry.dayOfWeek,
        startTime: nextEntry.startTime,
        endTime: nextEntry.endTime,
      });

      setScheduleEntries((current) => current.map((entry) => (entry.id === entryId ? savedEntry : entry)));
      setScheduleLoadError(null);
    } catch (error) {
      setScheduleEntries((current) => current.map((entry) => (entry.id === entryId ? draggedEntry : entry)));
      setScheduleMutationError(error instanceof Error ? error.message : "Unable to update your schedule right now.");
    }
  };

  return (
    <div className="max-w-7xl mx-auto w-full">
      {/* Hero Section & Integrated Search */}
      <section className="relative z-10 flex flex-col items-start px-4 pt-6 mb-12 md:px-12 md:pt-8 md:mb-16">
        <h1 className="font-headline text-4xl md:text-7xl font-bold text-primary leading-[1.05] mb-8 md:mb-12 tracking-tighter">
          Where are you <br/>headed today?
        </h1>
        
        {/* Search Bar */}
        <form 
          onSubmit={handleSearch}
          className="w-full max-w-3xl cursor-text rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-1.5 shadow-[0_8px_30px_rgb(0,0,0,0.06)] mb-12 md:p-2 md:mb-16"
          onClick={handleMobileSearchClick}
        >
          <div className="relative flex items-center px-3 py-2 md:px-4">
            <Search className="mr-3 h-5 w-5 text-on-surface-variant md:mr-4 md:h-6 md:w-6" />
            <input 
              className="w-full bg-transparent border-none font-body text-base text-on-surface placeholder:text-on-surface-variant/50 focus:ring-0 focus:outline-none pointer-events-none md:pointer-events-auto md:text-xl" 
              placeholder="Enter building name, room number, or event..." 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button type="submit" className="hidden md:flex ml-4 bg-primary text-on-primary font-bold px-8 py-4 rounded-xl hover:bg-primary/90 transition-colors whitespace-nowrap">
              Find Route
            </button>
          </div>
        </form>
      </section>

      {/* Quick Navigation Tiles */}
      <section className="relative z-10 px-4 mb-12 md:px-12 md:mb-16">
        <div className="mb-6 flex items-end justify-between md:mb-8">
          <div>
            <span className="text-on-surface-variant font-body text-[10px] tracking-[0.2em] uppercase font-bold mb-2 block">Quick Access</span>
            <h2 className="font-headline text-2xl md:text-3xl font-bold text-primary tracking-tight">Frequent Destinations</h2>
            <p className="text-sm text-on-surface-variant mt-2">{estimateNote}</p>
          </div>
          <Link to="/map" className="flex items-center gap-1.5 text-sm font-bold text-on-surface transition-colors hover:text-primary md:gap-2 md:text-base">
            View all <ArrowRight className="h-4 w-4 md:h-5 md:w-5" />
          </Link>
        </div>
        
        {isLoadingRecentDestinations ? (
          <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/30 text-sm text-on-surface-variant">
            Loading your recent destinations...
          </div>
        ) : recentDestinationsError ? (
          <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/30 text-sm text-on-surface-variant">
            {recentDestinationsError}
          </div>
        ) : recentDestinations.length === 0 ? (
          <div className="bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/30 text-center text-on-surface-variant">
            {isSignedIn
              ? "Search for buildings on the map and your latest destinations will appear here."
              : "Sign in and search the map to turn this section into your recent destinations."}
          </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {recentDestinations.map((destination) => {
            const route = getEtaForDestination(locationState.currentLocation, destination.destinationId);

            return (
              <Link
                key={destination.key}
                to={destination.to}
                className="bg-surface-container-lowest p-6 rounded-2xl flex flex-col relative overflow-hidden group hover:shadow-lg transition-all border border-outline-variant/30 h-48"
              >
                <destination.icon className={`w-8 h-8 ${destination.accentClassName} mb-auto relative z-10`} />
                <div className="relative z-10 mt-auto">
                  <p className="font-headline font-bold text-on-surface text-xl">{destination.title}</p>
                  <p className="text-sm text-on-surface-variant mt-1">{destination.subtitle}</p>
                  <p className="text-[10px] text-on-surface-variant uppercase font-bold mt-4 tracking-wider">
                    {route.isWalkable ? `${formatEta(route.etaMinutes)} away` : "Unwalkable"}
                  </p>
                </div>
                <destination.icon className="absolute -right-4 top-4 w-32 h-32 text-surface-variant/30 group-hover:scale-110 transition-transform duration-500" />
              </Link>
            );
          })}
        </div>
        )}

        <div className="mt-6 overflow-hidden rounded-[24px] glass-panel-heavy md:mt-8">
          <div className="flex flex-col gap-4 border-b border-outline-variant/20 bg-surface-container-low px-4 py-4 md:flex-row md:items-center md:justify-between md:px-5">
            <div>
              <span className="text-on-surface-variant font-body text-[10px] tracking-[0.2em] uppercase font-bold mb-2 block">Weekly Planner</span>
              <h3 className="font-headline text-xl md:text-2xl font-bold text-primary tracking-tight">Class Schedule</h3>
              <p className="text-sm text-on-surface-variant mt-1.5">A compact view of your week.</p>
              <div className="flex items-center gap-2 mt-2 text-xs text-on-surface-variant">
                <CalendarDays className="w-4 h-4 text-primary" />
                <span>{scheduleSummaryText}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-3 text-[10px] font-bold uppercase tracking-[0.16em]">
                <span className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/12 px-2.5 py-1 text-primary">
                  <span className="h-2 w-2 rounded-full bg-primary" /> Academic
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-secondary/20 bg-secondary/15 px-2.5 py-1 text-secondary">
                  <span className="h-2 w-2 rounded-full bg-secondary" /> Service
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-tertiary/20 bg-tertiary/15 px-2.5 py-1 text-tertiary">
                  <span className="h-2 w-2 rounded-full bg-tertiary" /> Parking
                </span>
              </div>
            </div>

            {isSignedIn ? (
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setIsScheduleCollapsed((current) => !current)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-outline-variant/30 bg-surface-container px-3 py-2.5 text-xs font-bold text-on-surface transition-colors hover:bg-surface-container-high md:gap-2 md:rounded-xl md:px-4 md:py-3 md:text-sm"
                >
                  {isScheduleCollapsed ? <ChevronDown className="h-3.5 w-3.5 md:h-4 md:w-4" /> : <ChevronUp className="h-3.5 w-3.5 md:h-4 md:w-4" />}
                  {isScheduleCollapsed ? "Expand" : "Collapse"}
                </button>
                <button
                  onClick={handleScheduleExport}
                  disabled={scheduleEntries.length === 0}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-outline-variant/30 bg-surface-container px-3.5 py-2.5 text-xs font-bold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-45 disabled:hover:bg-surface-container md:gap-2 md:rounded-xl md:px-5 md:py-3 md:text-sm"
                >
                  <Download className="h-3.5 w-3.5 md:h-4 md:w-4" /> Export CSV
                </button>
                <button
                  onClick={() => {
                    setBulkScheduleError(null);
                    setIsBulkScheduleModalOpen(true);
                  }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-outline-variant/30 bg-surface-container px-3.5 py-2.5 text-xs font-bold text-on-surface transition-colors hover:bg-surface-container-high md:gap-2 md:rounded-xl md:px-5 md:py-3 md:text-sm"
                >
                  <Upload className="h-3.5 w-3.5 md:h-4 md:w-4" /> Bulk Import
                </button>
                <button
                  onClick={() => openCreateScheduleModal("mon", "09:30")}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 py-2.5 text-xs font-bold text-on-primary transition-colors hover:brightness-110 md:gap-2 md:rounded-xl md:px-5 md:py-3 md:text-sm"
                >
                  <Plus className="h-3.5 w-3.5 md:h-4 md:w-4" /> Add Class
                </button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setIsScheduleCollapsed((current) => !current)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-outline-variant/30 bg-surface-container px-3 py-2.5 text-xs font-bold text-on-surface transition-colors hover:bg-surface-container-high md:gap-2 md:rounded-xl md:px-4 md:py-3 md:text-sm"
                >
                  {isScheduleCollapsed ? <ChevronDown className="h-3.5 w-3.5 md:h-4 md:w-4" /> : <ChevronUp className="h-3.5 w-3.5 md:h-4 md:w-4" />}
                  {isScheduleCollapsed ? "Preview" : "Hide"}
                </button>
                <SignInButton mode="modal">
                  <button className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-on-primary shadow-[0_10px_24px_rgba(0,103,71,0.18)] transition-colors hover:brightness-110 dark:shadow-[0_12px_28px_rgba(132,215,175,0.18)] md:gap-2 md:px-5 md:py-3 md:text-sm">
                    <CalendarDays className="h-3.5 w-3.5 md:h-4 md:w-4" /> Sign In To Edit
                  </button>
                </SignInButton>
              </div>
            )}
          </div>

          {isScheduleCollapsed ? (
            <div className="px-5 py-4 bg-surface-container-lowest/60">
              <div className="flex flex-wrap items-center gap-3 text-sm text-on-surface-variant">
                <span className="inline-flex items-center gap-2 rounded-full bg-surface-container px-3 py-1.5">
                  <span className="h-2 w-2 rounded-full bg-primary" /> Compact weekly planner
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-surface-container px-3 py-1.5">
                  <span className="h-2 w-2 rounded-full bg-secondary" /> Quick route shortcuts
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-surface-container px-3 py-1.5">
                  <span className="h-2 w-2 rounded-full bg-tertiary" /> CSV export and bulk import
                </span>
              </div>
            </div>
          ) : !isSignedIn ? (
            <div className="px-4 py-7 text-center text-on-surface-variant md:px-6 md:py-8">
              Sign in to build a personal weekly schedule that stays synced with your account.
            </div>
          ) : isLoadingSchedule ? (
            <div className="px-4 py-7 text-center text-on-surface-variant md:px-6 md:py-8">Loading your weekly schedule...</div>
          ) : scheduleLoadError ? (
            <div className="px-4 py-7 text-center text-on-surface-variant md:px-6 md:py-8">{scheduleLoadError}</div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleScheduleDragStart} onDragEnd={(event) => { void handleScheduleDrop(event); }}>
              <>
                {scheduleWarningMessage ? (
                  <div className="mx-4 mt-4 rounded-2xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200 md:mx-5">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{scheduleWarningMessage}</span>
                    </div>
                  </div>
                ) : null}

                <div className="px-3 py-4 md:hidden">
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {SCHEDULE_DAYS.map((day) => (
                      <button
                        key={day.key}
                        onClick={() => setSelectedMobileScheduleDay(day.key)}
                        className={`shrink-0 rounded-full px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] transition-colors ${selectedMobileScheduleDay === day.key ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"}`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>

                  <div className="mt-4 space-y-2.5">
                    {visibleScheduleRows.map((time) => {
                      const entries = scheduleEntriesByCell.get(getScheduleCellKey(selectedMobileScheduleDay, time)) ?? [];
                      return (
                        <div key={`${selectedMobileScheduleDay}-${time}`} className="rounded-[18px] border border-outline-variant/16 bg-surface-container-lowest/70 p-2">
                          <div className="flex items-start gap-3">
                            <button
                              type="button"
                              onClick={() => openCreateScheduleModal(selectedMobileScheduleDay, time)}
                              className="w-[92px] shrink-0 rounded-2xl border border-dashed border-outline/24 bg-surface-container-low/55 px-3 py-2.5 text-left transition-colors hover:bg-surface-container"
                            >
                              <p className="font-headline text-[12px] font-bold leading-tight text-on-surface">{formatScheduleTimeLabel(time)}</p>
                              <p className="mt-1 text-[10px] font-semibold text-primary/85">to {formatScheduleTimeLabel(scheduleMinutesToTime((scheduleTimeToMinutes(time) ?? 0) + 60))}</p>
                            </button>

                            <ScheduleDropCell
                              cellId={getScheduleDropCellId(selectedMobileScheduleDay, time)}
                              dayLabel={SCHEDULE_DAYS.find((day) => day.key === selectedMobileScheduleDay)?.label ?? selectedMobileScheduleDay}
                              timeLabel={formatScheduleTimeLabel(time)}
                              isMobile
                            >
                              {entries.length > 0 ? (
                                <div className="space-y-2">
                                  {entries.map((entry) => (
                                    <ScheduleCard
                                      key={entry.id}
                                      entry={entry}
                                      appearance={getScheduleEntryAppearance(entry.buildingId)}
                                      routeTarget={getScheduleRouteTarget(entry.buildingId, entry.room)}
                                      isConflict={scheduleConflictIds.has(entry.id)}
                                      isDragging={activeDragEntryId === entry.id}
                                      onEdit={openEditScheduleModal}
                                      compact
                                    />
                                  ))}
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => openCreateScheduleModal(selectedMobileScheduleDay, time)}
                                  className="flex min-h-[56px] w-full items-center justify-center rounded-[14px] border border-dashed border-outline/18 bg-transparent px-3 text-on-surface-variant/45 transition-all hover:border-outline/28 hover:bg-surface-container-low/40 hover:text-primary/75"
                                >
                                  <div className="flex items-center gap-2 opacity-70 transition-opacity group-hover:opacity-100">
                                    <Plus className="h-4 w-4" />
                                    <span className="text-[10px] font-semibold uppercase tracking-[0.16em]">Add</span>
                                  </div>
                                </button>
                              )}
                            </ScheduleDropCell>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="hidden overflow-x-auto px-3 pb-4 md:block">
                  <table className="min-w-[920px] w-full table-fixed border-separate border-spacing-0">
                    <colgroup>
                      <col className="w-[132px]" />
                      {SCHEDULE_DAYS.map((day) => (
                        <col key={day.key} className="w-[170px]" />
                      ))}
                    </colgroup>
                    <thead>
                      <tr className="bg-primary text-on-primary">
                        <th className="rounded-tl-[20px] border-r border-white/10 px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.22em]">Time</th>
                        {SCHEDULE_DAYS.map((day) => (
                          <th key={day.key} className={`border-r border-white/10 px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.22em] last:border-r-0 ${day.key === "fri" ? "rounded-tr-[20px]" : ""}`}>
                            {day.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleScheduleRows.map((time) => (
                        <tr key={time}>
                          <td className="border-r border-b border-outline-variant/18 bg-surface-container-low px-4 py-3.5 align-top">
                            <button
                              type="button"
                              onClick={() => openCreateScheduleModal(DEFAULT_SCHEDULE_DAY, time)}
                              className="w-full text-left"
                            >
                              <p className="font-headline text-[13px] font-bold leading-snug text-on-surface">
                                {formatScheduleTimeLabel(time)} - {formatScheduleTimeLabel(scheduleMinutesToTime((scheduleTimeToMinutes(time) ?? 0) + 60))}
                              </p>
                              <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-primary/75">1 hour window</p>
                            </button>
                          </td>
                          {SCHEDULE_DAYS.map((day) => {
                            const entries = scheduleEntriesByCell.get(getScheduleCellKey(day.key, time)) ?? [];
                            return (
                              <td key={`${day.key}-${time}`} className="border-r border-b border-outline-variant/18 bg-surface-container-lowest/70 p-1 align-top last:border-r-0 lg:p-1.5">
                                <ScheduleDropCell
                                  cellId={getScheduleDropCellId(day.key, time)}
                                  dayLabel={day.label}
                                  timeLabel={formatScheduleTimeLabel(time)}
                                >
                                  {entries.length > 0 ? (
                                    <div className="space-y-2">
                                      {entries.map((entry) => (
                                        <ScheduleCard
                                          key={entry.id}
                                          entry={entry}
                                        appearance={getScheduleEntryAppearance(entry.buildingId)}
                                        routeTarget={getScheduleRouteTarget(entry.buildingId, entry.room)}
                                        isConflict={scheduleConflictIds.has(entry.id)}
                                        isDragging={activeDragEntryId === entry.id}
                                        onEdit={openEditScheduleModal}
                                        compact
                                      />
                                    ))}
                                  </div>
                                ) : (
                                    <button
                                      type="button"
                                      onClick={() => openCreateScheduleModal(day.key, time)}
                                      className="flex min-h-[62px] w-full items-center justify-center rounded-[14px] border border-dashed border-outline/18 bg-transparent px-3 text-on-surface-variant/45 transition-all hover:border-outline/28 hover:bg-surface-container-low/40 hover:text-primary/75"
                                    >
                                      <div className="flex items-center gap-2 opacity-70 transition-opacity group-hover:opacity-100">
                                        <Plus className="h-4 w-4" />
                                        <span className="text-[10px] font-semibold uppercase tracking-[0.16em]">Add</span>
                                      </div>
                                    </button>
                                  )}
                                </ScheduleDropCell>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

              </>
            </DndContext>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-10 px-4 mb-12 md:px-12 lg:grid-cols-12 lg:gap-12">
        {/* Live Campus Stats */}
        <section className="lg:col-span-4 relative z-10">
          <h2 className="mb-6 font-headline text-2xl font-bold text-primary tracking-tight md:mb-8">Live Campus Stats</h2>
          <div className="flex flex-col gap-6 md:gap-8">
            <div className="flex items-center gap-4 md:gap-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-tertiary-container md:h-14 md:w-14">
                <Building2 className="w-6 h-6 text-on-tertiary-container" />
              </div>
              <div>
                <p className="text-on-surface font-headline text-2xl font-bold tracking-tighter">200+</p>
                <p className="text-on-surface-variant font-label text-[11px] tracking-widest uppercase font-bold mt-1">Buildings</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 md:gap-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-tertiary-container md:h-14 md:w-14">
                <Library className="w-6 h-6 text-on-tertiary-container" />
              </div>
              <div>
                <p className="text-on-surface font-headline text-2xl font-bold tracking-tighter">1,500+</p>
                <p className="text-on-surface-variant font-label text-[11px] tracking-widest uppercase font-bold mt-1">Classrooms</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 md:gap-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-tertiary-container md:h-14 md:w-14">
                <Bus className="w-6 h-6 text-on-tertiary-container" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-on-surface font-headline text-2xl font-bold tracking-tighter">Live</p>
                </div>
                <p className="text-on-surface-variant font-label text-[11px] tracking-widest uppercase font-bold mt-1">Shuttle Updates</p>
              </div>
            </div>
          </div>
        </section>

        {/* Current Activity */}
        <section className="lg:col-span-8 relative z-10">
          <div className="mb-6 flex items-end justify-between md:mb-8">
            <div>
              <h2 className="font-headline text-2xl font-bold text-primary tracking-tight">Live Shuttle</h2>
              <p className="text-sm text-on-surface-variant mt-2">Real-time Bull Runner status powered by Passio.</p>
            </div>
            <Link to="/shuttle" className="flex items-center gap-1.5 text-sm font-bold text-on-surface transition-colors hover:text-primary md:gap-2 md:text-base">
              Full shuttle view <ArrowRight className="h-4 w-4 md:h-5 md:w-5" />
            </Link>
          </div>

          {isLoadingShuttle ? (
            <div className="glass-panel rounded-3xl p-5 text-on-surface-variant md:p-6">Loading live Bull Runner data...</div>
          ) : shuttleError ? (
            <div className="glass-panel rounded-3xl border border-error/20 bg-error/5 p-5 md:p-6">
              <h3 className="font-headline text-lg font-bold text-on-surface mb-2">Live shuttle feed unavailable</h3>
              <p className="text-sm text-on-surface-variant">{shuttleError}</p>
            </div>
          ) : shuttleOverview ? (
            <div className="flex flex-col gap-5 rounded-3xl border border-outline-variant/20 bg-surface-container p-5 md:p-7">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-5">
                <div className="flex items-start gap-3 md:gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface-container-lowest shadow-sm md:h-14 md:w-14">
                    <Bus className="w-7 h-7 text-primary" />
                  </div>
                  <div>
                    <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-[0.22em]">Bull Runner Live</span>
                    <h3 className="mt-1.5 font-headline text-xl md:text-2xl font-bold text-primary">{shuttleOverview.activeVehicleCount} Active Bus{shuttleOverview.activeVehicleCount === 1 ? "" : "es"}</h3>
                    <p className="text-sm text-on-surface-variant mt-2">
                      {primaryShuttleAlert ? primaryShuttleAlert.title : "No active service alerts right now."}
                    </p>
                  </div>
                </div>

                <Link
                  to="/shuttle"
                  className="inline-flex items-center gap-1.5 self-start rounded-lg bg-primary px-3 py-2 text-sm font-bold text-on-primary transition-colors hover:brightness-110 md:gap-2 md:rounded-xl md:px-4 md:py-3 md:text-base"
                >
                  <MapIcon className="h-3.5 w-3.5 md:h-4 md:w-4" /> More Shuttle Info
                </Link>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span className="bg-primary text-on-primary text-xs font-bold px-4 py-2 rounded-full">
                  {shuttleOverview.routeCount} routes
                </span>
                <span className="bg-surface-container-lowest text-on-surface-variant border border-outline-variant/50 text-xs font-bold px-4 py-2 rounded-full">
                  {shuttleOverview.alertCount} alert{shuttleOverview.alertCount === 1 ? "" : "s"}
                </span>
                <span className="bg-surface-container-lowest text-on-surface-variant border border-outline-variant/50 text-xs font-bold px-4 py-2 rounded-full inline-flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5" /> {formatDashboardTimestamp(shuttleOverview.fetchedAt)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                {topShuttleRoutes.map((route) => (
                  <div key={route.id} className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-4">
                    <div className="flex items-center gap-3">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: route.color ?? "var(--color-primary)" }} />
                      <div className="min-w-0">
                        <p className="font-bold text-on-surface truncate">{route.name}</p>
                        <p className="text-xs text-on-surface-variant mt-1">{route.activeVehicleCount} live</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </div>

      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-[80] px-4 py-8 flex items-center justify-center">
          <button className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeScheduleModal} aria-label="Close schedule editor" />

          <div className="relative w-full max-w-xl glass-panel-heavy rounded-[28px] p-6 md:p-7 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <span className="text-on-surface-variant font-body text-[10px] tracking-[0.2em] uppercase font-bold mb-2 block">Schedule Entry</span>
                <h3 className="font-headline text-3xl font-bold text-primary tracking-tight">
                  {editingScheduleEntryId ? "Edit Class" : "Add Class"}
                </h3>
                <p className="text-sm text-on-surface-variant mt-2">Choose a weekday and flexible time range, then add the course, room, and building.</p>
              </div>
              <button
                onClick={closeScheduleModal}
                disabled={isSavingSchedule || isDeletingSchedule}
                className="rounded-full bg-surface-container p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-high disabled:opacity-50 md:p-2"
              >
                <X className="h-4 w-4 md:h-5 md:w-5" />
              </button>
            </div>

            <form onSubmit={handleScheduleSubmit} className="space-y-5">
              <div className={`rounded-2xl border px-4 py-3 ${activeScheduleAppearance.cardClassName}`}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    {/* <p className="text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">Style Preview</p> */}
                    <p className="font-headline text-lg font-bold text-on-surface mt-1">
                      {scheduleForm.course.trim() || "Your class will appear here"}
                    </p>
                    <p className="text-sm text-on-surface-variant mt-1">
                      {scheduleForm.room.trim() ? `Room ${scheduleForm.room.trim()}` : "Add a room number"}
                    </p>
                  </div>
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${activeScheduleAppearance.badgeClassName}`}>
                    {activeScheduleAppearance.label}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant block mb-2">Course</label>
                <input
                  required
                  value={scheduleForm.course}
                  onChange={(event) => handleScheduleFieldChange("course", event.target.value)}
                  className="w-full rounded-2xl border border-outline-variant/40 bg-surface-container-low px-4 py-3 text-on-surface outline-none focus:border-primary"
                  placeholder="COP 3514 Data Structures"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant block mb-2">Room</label>
                  <input
                    required
                    value={scheduleForm.room}
                    onChange={(event) => handleScheduleFieldChange("room", event.target.value)}
                    className="w-full rounded-2xl border border-outline-variant/40 bg-surface-container-low px-4 py-3 text-on-surface outline-none focus:border-primary"
                    placeholder="ENB 118"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant block mb-2">Building</label>
                  <select
                    required
                    value={scheduleForm.buildingId}
                    onChange={(event) => handleScheduleFieldChange("buildingId", event.target.value)}
                    className="w-full rounded-2xl border border-outline-variant/40 bg-surface-container-low px-4 py-3 text-on-surface outline-none focus:border-primary"
                  >
                    {BUILDINGS.map((building) => (
                      <option key={building.id} value={building.id}>
                        {building.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant block mb-2">Day</label>
                  <select
                    required
                    value={scheduleForm.dayOfWeek}
                    onChange={(event) => handleScheduleFieldChange("dayOfWeek", event.target.value as ScheduleDay)}
                    className="w-full rounded-2xl border border-outline-variant/40 bg-surface-container-low px-4 py-3 text-on-surface outline-none focus:border-primary"
                  >
                    {SCHEDULE_DAYS.map((day) => (
                      <option key={day.key} value={day.key}>
                        {day.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant block mb-2">Start Time</label>
                  <select
                    required
                    value={scheduleForm.startTime}
                    onChange={(event) => handleScheduleFieldChange("startTime", event.target.value)}
                    className="w-full rounded-2xl border border-outline-variant/40 bg-surface-container-low px-4 py-3 text-on-surface outline-none focus:border-primary"
                  >
                    {scheduleTimeOptions.map((time) => (
                      <option key={`start-${time}`} value={time}>
                        {formatScheduleTimeLabel(time)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant block mb-2">End Time</label>
                  <select
                    required
                    value={scheduleForm.endTime}
                    onChange={(event) => handleScheduleFieldChange("endTime", event.target.value)}
                    className="w-full rounded-2xl border border-outline-variant/40 bg-surface-container-low px-4 py-3 text-on-surface outline-none focus:border-primary"
                  >
                    {scheduleTimeOptions.map((time) => (
                      <option key={`end-${time}`} value={time}>
                        {formatScheduleTimeLabel(time)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {scheduleFormTimeError ? (
                <div className="rounded-2xl border border-error/20 bg-error/10 px-4 py-3 text-sm text-on-surface-variant">
                  {scheduleFormTimeError}
                </div>
              ) : null}

              {scheduleFormHasConflict ? (
                <div className="rounded-2xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
                  This class overlaps another class. You can still save it, and the planner will keep the conflict highlighted.
                </div>
              ) : null}

              {scheduleMutationError && (
                <div className="rounded-2xl border border-error/20 bg-error/10 px-4 py-3 text-sm text-on-surface-variant">
                  {scheduleMutationError}
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                    <Link
                      to={activeScheduleRoute.to}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-colors md:gap-2 md:rounded-xl md:px-3.5 md:py-2.5 md:text-sm ${activeScheduleAppearance.badgeClassName}`}
                    >
                      <Navigation className="h-3.5 w-3.5 md:h-4 md:w-4" /> {activeScheduleRoute.label}
                    </Link>
                    {editingScheduleEntryId ? (
                      <button
                        type="button"
                        onClick={() => { void handleScheduleDelete(); }}
                        disabled={isSavingSchedule || isDeletingSchedule}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-error/10 px-3 py-2 text-xs font-bold text-error transition-colors hover:bg-error/15 disabled:opacity-50 md:gap-2 md:rounded-xl md:px-3.5 md:py-2.5 md:text-sm"
                      >
                        <Trash2 className="h-3.5 w-3.5 md:h-4 md:w-4" /> Delete
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={closeScheduleModal}
                    disabled={isSavingSchedule || isDeletingSchedule}
                    className="rounded-lg bg-surface-container px-3 py-2 text-xs font-bold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-50 md:rounded-xl md:px-3.5 md:py-2.5 md:text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingSchedule || isDeletingSchedule || Boolean(scheduleFormTimeError)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-on-primary transition-colors hover:brightness-110 disabled:opacity-50 md:gap-2 md:rounded-xl md:px-4 md:py-2.5 md:text-sm"
                  >
                    <CalendarDays className="h-3.5 w-3.5 md:h-4 md:w-4" /> {isSavingSchedule ? "Saving..." : editingScheduleEntryId ? "Save change" : "Add Class"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {isBulkScheduleModalOpen && (
        <div className="fixed inset-0 z-[80] px-4 py-8 flex items-center justify-center">
          <button className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeBulkScheduleModal} aria-label="Close bulk schedule import" />

          <div className="relative w-full max-w-3xl glass-panel-heavy rounded-[28px] p-6 md:p-7 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <span className="text-on-surface-variant font-body text-[10px] tracking-[0.2em] uppercase font-bold mb-2 block">Fast Import</span>
                <h3 className="font-headline text-3xl font-bold text-primary tracking-tight">Bulk Add Schedule</h3>
                <p className="text-sm text-on-surface-variant mt-2">
                  Paste one class per line using `day | start time | end time | course | room | building`. Legacy `day | time | ...` lines still work.
                </p>
              </div>
              <button
                onClick={closeBulkScheduleModal}
                disabled={isBulkImportingSchedule}
                className="rounded-full bg-surface-container p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-high disabled:opacity-50 md:p-2"
              >
                <X className="h-4 w-4 md:h-5 md:w-5" />
              </button>
            </div>

            <form onSubmit={handleBulkScheduleSubmit} className="space-y-5">
              <div className="rounded-2xl border border-outline-variant/25 bg-surface-container-low p-4 text-sm text-on-surface-variant">
                <p className="font-bold text-on-surface mb-2">Example</p>
                <pre className="whitespace-pre-wrap font-mono text-xs leading-6 text-primary">
{`Mon | 9:30 AM | 10:45 AM | COP 3514 Data Structures | ENB 118 | ENB
Tue | 11:30 AM | 12:45 PM | Calculus I | ISA 1051 | ISA
Thu | 6:45 PM | 8:00 PM | Student Success Seminar | SVC 1 | SVC`}
                </pre>
                <p className="mt-3 text-xs">
                  For building, you can use the building code like `ENB`, the building id like `enb`, or the full building name.
                </p>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant block mb-2">Schedule Lines</label>
                <textarea
                  required
                  value={bulkScheduleText}
                  onChange={(event) => setBulkScheduleText(event.target.value)}
                  rows={10}
                  className="w-full rounded-2xl border border-outline-variant/40 bg-surface-container-low px-4 py-3 text-on-surface outline-none focus:border-primary resize-y"
                  placeholder="Mon | 9:30 AM | 10:45 AM | COP 3514 Data Structures | ENB 118 | ENB"
                />
              </div>

              {bulkScheduleError && (
                <div className="rounded-2xl border border-error/20 bg-error/10 px-4 py-3 text-sm text-on-surface-variant">
                  {bulkScheduleError}
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeBulkScheduleModal}
                  disabled={isBulkImportingSchedule}
                  className="rounded-lg bg-surface-container px-3 py-2.5 text-xs font-bold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-50 md:rounded-xl md:px-4 md:py-3 md:text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isBulkImportingSchedule}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-xs font-bold text-on-primary transition-colors hover:brightness-110 disabled:opacity-50 md:gap-2 md:rounded-xl md:px-5 md:py-3 md:text-sm"
                >
                  <Upload className="h-3.5 w-3.5 md:h-4 md:w-4" /> {isBulkImportingSchedule ? "Importing..." : "Import Schedule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
