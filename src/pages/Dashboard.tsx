import { SignInButton, useAuth } from "@clerk/clerk-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Search, Library, Building2, Wrench, Dumbbell, Bus, ArrowRight, Navigation, Map as MapIcon, Coffee, Car, CalendarDays, Plus, X, PencilLine, Trash2, Upload, Download, ChevronDown, ChevronUp, AlertTriangle, RefreshCw, type LucideIcon } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { BUILDINGS } from "../data/buildings";
import { bulkUpsertScheduleEntries, createScheduleEntry, deleteScheduleEntry, fetchRecentLocations, fetchScheduleEntries, fetchShuttleOverview, type RecentLocationRecord, type ScheduleEntryRecord, type ShuttleOverviewRecord, updateScheduleEntry } from "../lib/api";
import { buildRoute, CAMPUS_CENTER, formatEta, getWalkabilityLabel, readStoredUserLocation, writeStoredUserLocation, type Coordinates } from "../lib/navigation";
import { subscribeToRecentDestinationsUpdates } from "../lib/recent-destinations";
import { SCHEDULE_DAYS, SCHEDULE_SLOTS, type ScheduleDay, type ScheduleSlotKey } from "../lib/schedule";

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
  slotKey: ScheduleSlotKey;
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

function createDefaultScheduleForm(dayOfWeek: ScheduleDay = "mon", slotKey: ScheduleSlotKey = "09:30") {
  return {
    course: "",
    room: "",
    buildingId: BUILDINGS[0]?.id ?? "",
    dayOfWeek,
    slotKey,
  } satisfies ScheduleFormState;
}

function getScheduleCellKey(dayOfWeek: string, slotKey: string) {
  return `${dayOfWeek}:${slotKey}`;
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

function parseScheduleSlotInput(value: string) {
  const normalizedValue = value.trim().toLowerCase().replace(/\s+/g, " ");
  const directSlot = SCHEDULE_SLOTS.find((slot) => slot.key === normalizedValue);

  if (directSlot) {
    return directSlot.key;
  }

  const matchingSlot = SCHEDULE_SLOTS.find((slot) => {
    return (
      slot.startLabel.toLowerCase() === normalizedValue ||
      `${slot.startLabel.toLowerCase()} - ${slot.endLabel.toLowerCase()}` === normalizedValue ||
      `${slot.startLabel.toLowerCase()}–${slot.endLabel.toLowerCase()}` === normalizedValue
    );
  });

  return matchingSlot?.key ?? null;
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
  const seenCells = new Set<string>();

  const entries = lines.map((line, index) => {
    const separator = line.includes("|") ? "|" : ",";
    const parts = line.split(separator).map((part) => part.trim());

    if (parts.length < 5) {
      throw new Error(`Line ${index + 1} must have 5 values: day | time | course | room | building.`);
    }

    const [dayInput, slotInput, course, room, buildingInput] = parts;
    const dayOfWeek = parseScheduleDayInput(dayInput);
    const slotKey = parseScheduleSlotInput(slotInput);
    const buildingId = resolveScheduleBuildingId(buildingInput);

    if (!dayOfWeek) {
      throw new Error(`Line ${index + 1} has an invalid day: ${dayInput}.`);
    }

    if (!slotKey) {
      throw new Error(`Line ${index + 1} has an invalid time slot: ${slotInput}.`);
    }

    if (!buildingId) {
      throw new Error(`Line ${index + 1} has an unknown building: ${buildingInput}.`);
    }

    if (!course || !room) {
      throw new Error(`Line ${index + 1} must include both course and room.`);
    }

    const cellKey = getScheduleCellKey(dayOfWeek, slotKey);
    if (seenCells.has(cellKey)) {
      throw new Error(`Line ${index + 1} duplicates another imported class in the same day and time slot.`);
    }

    seenCells.add(cellKey);

    return {
      course,
      room,
      buildingId,
      dayOfWeek,
      slotKey,
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
    return new Map(scheduleEntries.map((entry) => [getScheduleCellKey(entry.dayOfWeek, entry.slotKey), entry]));
  }, [scheduleEntries]);

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

  const sortedScheduleEntries = useMemo(() => {
    const dayOrder = new Map(SCHEDULE_DAYS.map((day, index) => [day.key, index]));
    const slotOrder = new Map(SCHEDULE_SLOTS.map((slot, index) => [slot.key, index]));

    return [...scheduleEntries].sort((left, right) => {
      const dayDelta = (dayOrder.get(left.dayOfWeek) ?? 99) - (dayOrder.get(right.dayOfWeek) ?? 99);
      if (dayDelta !== 0) {
        return dayDelta;
      }

      return (slotOrder.get(left.slotKey) ?? 99) - (slotOrder.get(right.slotKey) ?? 99);
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

  const openCreateScheduleModal = (dayOfWeek: ScheduleDay, slotKey: ScheduleSlotKey) => {
    setEditingScheduleEntryId(null);
    setScheduleForm(createDefaultScheduleForm(dayOfWeek, slotKey));
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
      slotKey: entry.slotKey as ScheduleSlotKey,
    });
    setScheduleMutationError(null);
    setIsScheduleModalOpen(true);
  };

  const handleScheduleFieldChange = <K extends keyof ScheduleFormState>(field: K, value: ScheduleFormState[K]) => {
    setScheduleForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleScheduleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isSignedIn) {
      setScheduleMutationError("Sign in to manage your schedule.");
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
        slotKey: scheduleForm.slotKey,
      };

      const entry = editingScheduleEntryId
        ? await updateScheduleEntry(token, editingScheduleEntryId, payload)
        : await createScheduleEntry(token, payload);

      setScheduleEntries((current) => {
        const nextEntries = current.filter((item) => item.id !== entry.id && getScheduleCellKey(item.dayOfWeek, item.slotKey) !== getScheduleCellKey(entry.dayOfWeek, entry.slotKey));
        return [...nextEntries, entry];
      });
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
      const importedCellKeys = new Set(importedEntries.map((entry) => getScheduleCellKey(entry.dayOfWeek, entry.slotKey)));

      setScheduleEntries((current) => {
        const remainingEntries = current.filter((entry) => !importedCellKeys.has(getScheduleCellKey(entry.dayOfWeek, entry.slotKey)));
        return [...remainingEntries, ...importedEntries];
      });
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
      ["Day", "Time", "End Time", "Course", "Room", "Building Code", "Building Name"],
      ...sortedScheduleEntries.map((entry) => {
        const dayLabel = SCHEDULE_DAYS.find((day) => day.key === entry.dayOfWeek)?.label ?? entry.dayOfWeek;
        const slot = SCHEDULE_SLOTS.find((item) => item.key === entry.slotKey);
        const building = BUILDINGS.find((item) => item.id === entry.buildingId);

        return [
          dayLabel,
          slot?.startLabel ?? entry.slotKey,
          slot?.endLabel ?? "",
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

  return (
    <div className="max-w-7xl mx-auto w-full">
      {/* Hero Section & Integrated Search */}
      <section className="relative z-10 px-6 md:px-12 mb-16 flex flex-col items-start pt-8">
        <h1 className="font-headline text-5xl md:text-7xl font-bold text-primary leading-[1.05] mb-12 tracking-tighter">
          Where are you <br/>headed today?
        </h1>
        
        {/* Search Bar */}
        <form 
          onSubmit={handleSearch}
          className="w-full max-w-3xl bg-surface-container-lowest p-2 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] mb-16 cursor-text border border-outline-variant/30"
          onClick={handleMobileSearchClick}
        >
          <div className="relative flex items-center px-4 py-2">
            <Search className="text-on-surface-variant mr-4 w-6 h-6" />
            <input 
              className="bg-transparent border-none text-on-surface placeholder:text-on-surface-variant/50 focus:ring-0 focus:outline-none w-full font-body text-xl pointer-events-none md:pointer-events-auto" 
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
      <section className="relative z-10 px-6 md:px-12 mb-16">
        <div className="flex items-end justify-between mb-8">
          <div>
            <span className="text-on-surface-variant font-body text-[10px] tracking-[0.2em] uppercase font-bold mb-2 block">Quick Access</span>
            <h2 className="font-headline text-3xl font-bold text-primary tracking-tight">Frequent Destinations</h2>
            <p className="text-sm text-on-surface-variant mt-2">{estimateNote}</p>
          </div>
          <Link to="/map" className="text-on-surface font-bold flex items-center gap-2 hover:text-primary transition-colors">
            View all <ArrowRight className="w-5 h-5" />
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

        <div className="mt-8 glass-panel-heavy rounded-[24px] overflow-hidden">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between px-5 py-4 border-b border-outline-variant/20 bg-surface-container-low">
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
                  className="inline-flex items-center justify-center gap-2 bg-surface-container text-on-surface px-4 py-3 rounded-xl font-bold text-sm hover:bg-surface-container-high transition-colors border border-outline-variant/30"
                >
                  {isScheduleCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                  {isScheduleCollapsed ? "Expand" : "Collapse"}
                </button>
                <button
                  onClick={handleScheduleExport}
                  disabled={scheduleEntries.length === 0}
                  className="inline-flex items-center justify-center gap-2 bg-surface-container text-on-surface px-5 py-3 rounded-xl font-bold text-sm hover:bg-surface-container-high transition-colors border border-outline-variant/30 disabled:opacity-45 disabled:hover:bg-surface-container"
                >
                  <Download className="w-4 h-4" /> Export CSV
                </button>
                <button
                  onClick={() => {
                    setBulkScheduleError(null);
                    setIsBulkScheduleModalOpen(true);
                  }}
                  className="inline-flex items-center justify-center gap-2 bg-surface-container text-on-surface px-5 py-3 rounded-xl font-bold text-sm hover:bg-surface-container-high transition-colors border border-outline-variant/30"
                >
                  <Upload className="w-4 h-4" /> Bulk Import
                </button>
                <button
                  onClick={() => openCreateScheduleModal("mon", "09:30")}
                  className="inline-flex items-center justify-center gap-2 bg-primary text-on-primary px-5 py-3 rounded-xl font-bold text-sm hover:brightness-110 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add Class
                </button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setIsScheduleCollapsed((current) => !current)}
                  className="inline-flex items-center justify-center gap-2 bg-surface-container text-on-surface px-4 py-3 rounded-xl font-bold text-sm hover:bg-surface-container-high transition-colors border border-outline-variant/30"
                >
                  {isScheduleCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                  {isScheduleCollapsed ? "Preview" : "Hide"}
                </button>
                <SignInButton mode="modal">
                  <button className="inline-flex items-center justify-center gap-2 bg-primary text-on-primary px-5 py-3 rounded-xl font-bold text-sm hover:brightness-110 transition-colors">
                    <CalendarDays className="w-4 h-4" /> Sign In To Edit
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
            <div className="px-6 py-8 text-center text-on-surface-variant">
              Sign in to build a personal weekly schedule that stays synced with your account.
            </div>
          ) : isLoadingSchedule ? (
            <div className="px-6 py-8 text-center text-on-surface-variant">Loading your weekly schedule...</div>
          ) : scheduleLoadError ? (
            <div className="px-6 py-8 text-center text-on-surface-variant">{scheduleLoadError}</div>
          ) : (
            <>
              <div className="md:hidden px-4 py-4">
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
                  {SCHEDULE_SLOTS.map((slot) => {
                    const entry = scheduleEntriesByCell.get(getScheduleCellKey(selectedMobileScheduleDay, slot.key));
                    const routeTarget = entry ? getScheduleRouteTarget(entry.buildingId, entry.room) : null;
                    const appearance = entry ? getScheduleEntryAppearance(entry.buildingId) : null;

                    return (
                      <div key={`${selectedMobileScheduleDay}-${slot.key}`} className="rounded-[18px] border border-outline-variant/20 bg-surface-container-lowest/80 p-2.5">
                        <div className="flex items-start gap-3">
                          <div className="w-[76px] shrink-0 pt-1">
                            <p className="font-headline text-[13px] font-bold text-on-surface leading-none">{slot.startLabel}</p>
                            <p className="text-[10px] text-primary mt-1 font-semibold">{slot.endLabel}</p>
                          </div>

                          <div className="flex-1">
                            {entry ? (
                              <div className={`rounded-[16px] border p-2.5 ${appearance?.cardClassName ?? "border-primary/15 bg-primary/8"}`}>
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <p className="font-headline text-sm font-bold text-on-surface leading-tight">{entry.course}</p>
                                    <p className="text-xs text-on-surface-variant mt-1">{entry.room} • {getBuildingScheduleLabel(entry.buildingId)}</p>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <Link
                                      to={routeTarget?.to ?? "/map"}
                                      className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors ${appearance?.actionClassName ?? "bg-primary text-on-primary hover:brightness-110"}`}
                                      title={routeTarget?.label ?? "Open map"}
                                    >
                                      <Navigation className="w-4 h-4" />
                                    </Link>
                                    <button
                                      type="button"
                                      onClick={() => openEditScheduleModal(entry)}
                                      className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-high text-primary hover:bg-surface-container-highest transition-colors"
                                      title="Edit class"
                                    >
                                      <PencilLine className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openCreateScheduleModal(selectedMobileScheduleDay, slot.key)}
                                className="flex min-h-[54px] w-full items-center justify-center rounded-[16px] border border-dashed border-outline/50 bg-surface-container-low text-primary/80 hover:bg-surface-container transition-colors"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="hidden md:block overflow-x-auto px-2 pb-3 md:px-3 md:pb-4">
              <table className="min-w-[860px] w-full table-fixed border-separate border-spacing-0">
                <colgroup>
                  <col className="w-[88px]" />
                  <col className="w-[154px]" />
                  <col className="w-[154px]" />
                  <col className="w-[154px]" />
                  <col className="w-[154px]" />
                  <col className="w-[154px]" />
                </colgroup>
                <thead>
                  <tr className="bg-primary text-on-primary">
                    <th className="w-28 px-3 py-3 text-left text-[10px] font-bold tracking-[0.22em] uppercase border-r border-white/10 rounded-tl-[20px]">Time</th>
                    {SCHEDULE_DAYS.map((day) => (
                      <th key={day.key} className={`px-3 py-3 text-left text-[10px] font-bold tracking-[0.22em] uppercase border-r border-white/10 last:border-r-0 ${day.key === "fri" ? "rounded-tr-[20px]" : ""}`}>
                        {day.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SCHEDULE_SLOTS.map((slot) => (
                    <tr key={slot.key}>
                      <td className="w-28 px-3 py-3 align-top border-r border-b border-outline-variant/18 bg-surface-container-low">
                        <p className="font-headline text-sm font-bold text-on-surface leading-none">{slot.startLabel}</p>
                        <p className="text-[10px] text-primary mt-1 font-semibold tracking-wide">{slot.endLabel}</p>
                      </td>
                      {SCHEDULE_DAYS.map((day) => {
                        const entry = scheduleEntriesByCell.get(getScheduleCellKey(day.key, slot.key));
                        const routeTarget = entry ? getScheduleRouteTarget(entry.buildingId, entry.room) : null;
                        const appearance = entry ? getScheduleEntryAppearance(entry.buildingId) : null;

                        return (
                          <td key={day.key} className="border-r border-b border-outline-variant/18 last:border-r-0 bg-surface-container-lowest/70 align-top p-1.5 lg:p-2">
                            {entry ? (
                              <div className="relative flex min-h-[74px] w-full flex-col items-start justify-between rounded-[18px] bg-surface-container-low p-2 text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_18px_rgb(0,0,0,0.04)]">
                                <span className={`absolute right-0 top-0 h-0 w-0 border-l-[12px] border-l-transparent border-t-[12px] ${appearance?.cornerClassName ?? "border-t-primary"} opacity-80`} />
                                <div className={`rounded-[14px] border p-2 w-full shadow-[0_8px_18px_rgb(0,0,0,0.03)] ${appearance?.cardClassName ?? "border-primary/15 bg-primary/8"}`}>
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="font-headline text-[13px] font-bold text-on-surface leading-tight line-clamp-1">{entry.course}</p>
                                      <p className="text-[11px] text-on-surface-variant mt-1">{entry.room}</p>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <Link
                                        to={routeTarget?.to ?? "/map"}
                                        title={routeTarget?.label ?? "Open map"}
                                        className={`inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors ${appearance?.actionClassName ?? "bg-primary text-on-primary hover:brightness-110"}`}
                                      >
                                        <Navigation className="w-3.5 h-3.5" />
                                      </Link>
                                      <button
                                        type="button"
                                        onClick={() => openEditScheduleModal(entry)}
                                        className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-surface-container-high text-primary hover:bg-surface-container-highest transition-colors"
                                        title="Edit class"
                                      >
                                        <PencilLine className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="mt-2.5 flex items-center justify-between gap-2 flex-wrap">
                                    <p className={`text-[10px] uppercase tracking-[0.16em] font-bold ${appearance?.helperTextClassName ?? "text-primary"}`}>
                                      {getBuildingScheduleLabel(entry.buildingId)}
                                    </p>
                                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] ${appearance?.badgeClassName ?? "bg-primary/12 text-primary border-primary/15"}`}>
                                      {appearance?.label ?? "Academic"}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  openCreateScheduleModal(day.key, slot.key);
                                }}
                                className="relative flex min-h-[74px] w-full items-center justify-center rounded-[18px] bg-surface-container-low/60 p-2 text-left transition-all hover:bg-surface-container hover:-translate-y-0.5"
                              >
                                <span className="absolute right-0 top-0 h-0 w-0 border-l-[12px] border-l-transparent border-t-[12px] border-t-primary opacity-28" />
                                <div className="rounded-[14px] border border-dashed border-outline/45 bg-surface-container-lowest/70 flex h-full min-h-[56px] w-full items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.3)] dark:shadow-none">
                                  <Plus className="w-3.5 h-3.5 text-primary/75" />
                                </div>
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 px-6 md:px-12 mb-12">
        {/* Live Campus Stats */}
        <section className="lg:col-span-4 relative z-10">
          <h2 className="font-headline text-2xl font-bold text-primary tracking-tight mb-8">Live Campus Stats</h2>
          <div className="flex flex-col gap-8">
            <div className="flex items-center gap-6">
              <div className="w-14 h-14 rounded-xl bg-tertiary-container flex items-center justify-center shrink-0">
                <Building2 className="w-6 h-6 text-on-tertiary-container" />
              </div>
              <div>
                <p className="text-on-surface font-headline text-2xl font-bold tracking-tighter">200+</p>
                <p className="text-on-surface-variant font-label text-[11px] tracking-widest uppercase font-bold mt-1">Buildings</p>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="w-14 h-14 rounded-xl bg-tertiary-container flex items-center justify-center shrink-0">
                <Library className="w-6 h-6 text-on-tertiary-container" />
              </div>
              <div>
                <p className="text-on-surface font-headline text-2xl font-bold tracking-tighter">1,500+</p>
                <p className="text-on-surface-variant font-label text-[11px] tracking-widest uppercase font-bold mt-1">Classrooms</p>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="w-14 h-14 rounded-xl bg-tertiary-container flex items-center justify-center shrink-0">
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
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="font-headline text-2xl font-bold text-primary tracking-tight">Live Shuttle</h2>
              <p className="text-sm text-on-surface-variant mt-2">Real-time Bull Runner status powered by Passio.</p>
            </div>
            <Link to="/shuttle" className="text-on-surface font-bold flex items-center gap-2 hover:text-primary transition-colors">
              Full shuttle view <ArrowRight className="w-5 h-5" />
            </Link>
          </div>

          {isLoadingShuttle ? (
            <div className="glass-panel p-6 rounded-3xl text-on-surface-variant">Loading live Bull Runner data...</div>
          ) : shuttleError ? (
            <div className="glass-panel p-6 rounded-3xl border border-error/20 bg-error/5">
              <h3 className="font-headline text-lg font-bold text-on-surface mb-2">Live shuttle feed unavailable</h3>
              <p className="text-sm text-on-surface-variant">{shuttleError}</p>
            </div>
          ) : shuttleOverview ? (
            <div className="bg-surface-container p-6 md:p-7 rounded-3xl border border-outline-variant/20 flex flex-col gap-5">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 bg-surface-container-lowest rounded-2xl flex items-center justify-center shrink-0 shadow-sm">
                    <Bus className="w-7 h-7 text-primary" />
                  </div>
                  <div>
                    <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-[0.22em]">Bull Runner Live</span>
                    <h3 className="font-headline font-bold text-primary text-2xl mt-2">{shuttleOverview.activeVehicleCount} Active Bus{shuttleOverview.activeVehicleCount === 1 ? "" : "es"}</h3>
                    <p className="text-sm text-on-surface-variant mt-2">
                      {primaryShuttleAlert ? primaryShuttleAlert.title : "No active service alerts right now."}
                    </p>
                  </div>
                </div>

                <Link
                  to="/shuttle"
                  className="inline-flex items-center gap-2 self-start bg-primary text-on-primary rounded-xl px-4 py-3 font-bold hover:brightness-110 transition-colors"
                >
                  <MapIcon className="w-4 h-4" /> More Shuttle Info
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
                <p className="text-sm text-on-surface-variant mt-2">Choose a weekday slot, then add the course, room, and building.</p>
              </div>
              <button
                onClick={closeScheduleModal}
                disabled={isSavingSchedule || isDeletingSchedule}
                className="rounded-full bg-surface-container p-2 text-on-surface-variant hover:bg-surface-container-high transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleScheduleSubmit} className="space-y-5">
              <div className={`rounded-2xl border px-4 py-3 ${activeScheduleAppearance.cardClassName}`}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">Style Preview</p>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <label className="text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant block mb-2">Time Slot</label>
                  <select
                    required
                    value={scheduleForm.slotKey}
                    onChange={(event) => handleScheduleFieldChange("slotKey", event.target.value as ScheduleSlotKey)}
                    className="w-full rounded-2xl border border-outline-variant/40 bg-surface-container-low px-4 py-3 text-on-surface outline-none focus:border-primary"
                  >
                    {SCHEDULE_SLOTS.map((slot) => (
                      <option key={slot.key} value={slot.key}>
                        {slot.startLabel} - {slot.endLabel}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {scheduleMutationError && (
                <div className="rounded-2xl border border-error/20 bg-error/10 px-4 py-3 text-sm text-on-surface-variant">
                  {scheduleMutationError}
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
                <div>
                  <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                    <Link
                      to={activeScheduleRoute.to}
                      className={`inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-colors ${activeScheduleAppearance.badgeClassName}`}
                    >
                      <Navigation className="w-4 h-4" /> {activeScheduleRoute.label}
                    </Link>
                    {editingScheduleEntryId ? (
                      <button
                        type="button"
                        onClick={() => { void handleScheduleDelete(); }}
                        disabled={isSavingSchedule || isDeletingSchedule}
                        className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-error bg-error/10 hover:bg-error/15 transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" /> Delete Class
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                  <button
                    type="button"
                    onClick={closeScheduleModal}
                    disabled={isSavingSchedule || isDeletingSchedule}
                    className="rounded-xl px-4 py-3 text-sm font-bold text-on-surface bg-surface-container hover:bg-surface-container-high transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingSchedule || isDeletingSchedule}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-on-primary px-5 py-3 text-sm font-bold hover:brightness-110 transition-colors disabled:opacity-50"
                  >
                    <CalendarDays className="w-4 h-4" /> {isSavingSchedule ? "Saving..." : editingScheduleEntryId ? "Save Changes" : "Add To Schedule"}
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
                  Paste one class per line using `day | time | course | room | building`. Existing classes in the same slot will be updated.
                </p>
              </div>
              <button
                onClick={closeBulkScheduleModal}
                disabled={isBulkImportingSchedule}
                className="rounded-full bg-surface-container p-2 text-on-surface-variant hover:bg-surface-container-high transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBulkScheduleSubmit} className="space-y-5">
              <div className="rounded-2xl border border-outline-variant/25 bg-surface-container-low p-4 text-sm text-on-surface-variant">
                <p className="font-bold text-on-surface mb-2">Example</p>
                <pre className="whitespace-pre-wrap font-mono text-xs leading-6 text-primary">
{`Mon | 09:30 | COP 3514 Data Structures | ENB 118 | ENB
Tue | 11:30 | Calculus I | ISA 1051 | ISA
Thu | 13:30 | Student Success Seminar | SVC 1 | SVC`}
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
                  placeholder="Mon | 09:30 | COP 3514 Data Structures | ENB 118 | ENB"
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
                  className="rounded-xl px-4 py-3 text-sm font-bold text-on-surface bg-surface-container hover:bg-surface-container-high transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isBulkImportingSchedule}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-on-primary px-5 py-3 text-sm font-bold hover:brightness-110 transition-colors disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" /> {isBulkImportingSchedule ? "Importing..." : "Import Schedule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
