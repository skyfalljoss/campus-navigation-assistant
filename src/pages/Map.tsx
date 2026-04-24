import { useAuth, useClerk } from "@clerk/clerk-react";
import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, Navigation, X, Bookmark, BookmarkCheck, MapPin, Footprints, Coffee, Car, BookOpen, HelpCircle, LocateFixed, AlertCircle, ChevronRight, ArrowUp, CornerUpLeft, CornerUpRight, Flag, Check, Volume2, VolumeX } from "lucide-react";
import { MapContainer, TileLayer, Marker, Polyline, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { BUILDINGS, type Building, type BuildingTag, type Room } from "../data/buildings";
import { fetchNavigationRoute, fetchSavedLocations, recordRecentLocation, removeSavedLocation, saveLocation, type NavigationResponseRecord } from "../lib/api";
import { CAMPUS_CENTER, formatDistance, formatEta, getDistanceMeters, getWalkabilityLabel, writeStoredUserLocation } from "../lib/navigation";
import { isLocationServicesEnabled } from "../lib/preferences";
import { notifyRecentDestinationsUpdated } from "../lib/recent-destinations";
import { getNearestRouteCoordinateIndex, getRemainingRouteDistance, hasMeaningfulMovement, isOffRoute } from "../lib/route-tracking";
import { cn } from "../lib/utils";

// Custom Leaflet Icons
const createIcon = (isSelected: boolean) => L.divIcon({
  className: "bg-transparent border-none",
  html: `<div class="w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${isSelected ? 'bg-primary border-white text-on-primary shadow-[0_0_20px_rgba(132,215,175,0.8)] scale-110' : 'bg-surface border-primary text-primary hover:scale-105 shadow-md'}"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 40],
});

const userIcon = L.divIcon({
  className: "bg-transparent border-none",
  html: `<div class="w-4 h-4 bg-tertiary rounded-full shadow-[0_0_15px_rgba(233,195,73,0.8)] animate-pulse border-2 border-surface"><div class="absolute inset-0 bg-tertiary rounded-full animate-ping opacity-50"></div></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const entranceIcon = L.divIcon({
  className: "bg-transparent border-none",
  html: `<div class="flex h-9 w-9 items-center justify-center rounded-2xl border-2 border-primary bg-surface text-primary shadow-[0_10px_24px_rgba(10,35,24,0.16)]"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/><path d="M9 9h.01"/><path d="M9 13h.01"/><path d="M9 17h.01"/></svg></div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

function getLocationErrorMessage(error: GeolocationPositionError) {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "Location access was denied. Enable location permission to start navigation.";
    case error.POSITION_UNAVAILABLE:
      return "Your location could not be determined right now.";
    case error.TIMEOUT:
      return "Locating you took too long. Please try again.";
    default:
      return "We could not access your current location.";
  }
}

function getArrivalInstruction(building: Building, entranceLabel: string, arrivalHint?: string | null, room?: Room | null) {
  const detail = arrivalHint?.trim();

  if (room) {
    return detail
      ? `You will arrive at the ${entranceLabel} of ${building.name}. ${detail} ${room.name} is on the ${room.floor.toLowerCase()}.`
      : `You will arrive at the ${entranceLabel} of ${building.name}. ${room.name} is on the ${room.floor.toLowerCase()}.`;
  }

  return detail ? `You will arrive at the ${entranceLabel} of ${building.name}. ${detail}` : `You will arrive at the ${entranceLabel} of ${building.name}.`;
}

const LOCATION_SETTINGS_DISABLED_MESSAGE = "Location Services are turned off in Settings. Turn them on there to use live navigation.";
const MIN_REROUTE_MOVEMENT_METERS = 10;
const OFF_ROUTE_THRESHOLD_METERS = 25;
const REROUTE_THROTTLE_MS = 8_000;
const ARRIVAL_RADIUS_METERS = 18;
const VOICE_GUIDANCE_STORAGE_KEY = "usf_voice_guidance_enabled";
const MAP_CHROME_REVEAL_HEIGHT = 28;

function getStepIcon(instruction: string, isArrival = false) {
  if (isArrival) {
    return Flag;
  }

  const normalizedInstruction = instruction.toLowerCase();
  if (normalizedInstruction.includes("left")) {
    return CornerUpLeft;
  }

  if (normalizedInstruction.includes("right")) {
    return CornerUpRight;
  }

  return ArrowUp;
}

function getActiveStepIndex(
  steps: Array<{ distanceMeters: number; waypoints: [number, number] | null }>,
  totalDistanceMeters: number,
  remainingDistanceMeters: number,
  nearestCoordinateIndex: number | null
) {
  if (steps.length === 0) {
    return 0;
  }

  if (nearestCoordinateIndex !== null) {
    for (let index = 0; index < steps.length; index += 1) {
      const waypoints = steps[index].waypoints;
      if (!waypoints) {
        continue;
      }

      if (nearestCoordinateIndex <= waypoints[1]) {
        return index;
      }
    }

    return steps.length - 1;
  }

  if (totalDistanceMeters <= 0) {
    return 0;
  }

  const traversedDistance = Math.max(0, totalDistanceMeters - remainingDistanceMeters);
  let coveredDistance = 0;

  for (let index = 0; index < steps.length; index += 1) {
    coveredDistance += Math.max(0, steps[index].distanceMeters);
    if (traversedDistance <= coveredDistance) {
      return index;
    }
  }

  return steps.length - 1;
}

function getStepCategory(instruction: string) {
  const normalizedInstruction = instruction.toLowerCase();

  if (normalizedInstruction.includes("left")) {
    return "left";
  }

  if (normalizedInstruction.includes("right")) {
    return "right";
  }

  if (normalizedInstruction.includes("arrive")) {
    return "arrival";
  }

  return "straight";
}

function mergeNavigationSteps(steps: Array<{ instruction: string; distanceMeters: number; pathName: string | null; waypoints: [number, number] | null }>) {
  const mergedSteps: Array<{ instruction: string; distanceMeters: number; pathName: string | null; waypoints: [number, number] | null }> = [];

  for (const step of steps) {
    const previousStep = mergedSteps[mergedSteps.length - 1];
    if (!previousStep) {
      mergedSteps.push(step);
      continue;
    }

    const previousCategory = getStepCategory(previousStep.instruction);
    const currentCategory = getStepCategory(step.instruction);
    const sameCategory = previousCategory === currentCategory;
    const samePath = previousStep.pathName === step.pathName;
    const shortSegment = step.distanceMeters <= 35 || previousStep.distanceMeters <= 35;

    if (sameCategory && samePath && shortSegment && currentCategory !== "arrival") {
      previousStep.distanceMeters += step.distanceMeters;
      if (previousStep.waypoints && step.waypoints) {
        previousStep.waypoints = [previousStep.waypoints[0], step.waypoints[1]];
      }
      continue;
    }

    mergedSteps.push(step);
  }

  return mergedSteps;
}

function getSpokenInstruction(step: { instruction: string; distanceMeters: number }) {
  if (step.distanceMeters <= 0) {
    return step.instruction;
  }

  return `In ${formatDistance(step.distanceMeters)}, ${step.instruction.charAt(0).toLowerCase()}${step.instruction.slice(1)}`;
}

// Component to handle map centering
function MapUpdater({
  center,
  zoom,
  bounds,
  focusCenter,
  focusToken,
}: {
  center: [number, number];
  zoom: number;
  bounds?: [[number, number], [number, number]] | null;
  focusCenter?: [number, number] | null;
  focusToken?: number;
}) {
  const map = useMap();
  const lastFocusTokenRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (focusCenter && focusToken !== undefined && focusToken !== lastFocusTokenRef.current) {
      lastFocusTokenRef.current = focusToken;
      map.flyTo(focusCenter, Math.max(map.getZoom(), 18), { duration: 1.1 });
      return;
    }

    if (bounds) {
      map.fitBounds(bounds, { padding: [70, 70] });
      return;
    }

    map.flyTo(center, zoom, { duration: 1.5 });
  }, [bounds, center, zoom, map]);
  return null;
}

// Component to handle map clicks
function MapClickHandler({ onClick }: { onClick: () => void }) {
  useMapEvents({
    click: onClick,
  });
  return null;
}

export default function MapPage() {
  const { getToken, isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const { openSignIn } = useClerk();
  const [searchParams] = useSearchParams();
  const destId = searchParams.get("dest");
  const q = searchParams.get("q");
  const roomId = searchParams.get("room");
  const shouldAutoNavigate = searchParams.get("navigate") === "1";
  
  const [searchQuery, setSearchQuery] = useState(q || "");
  const [activeFilter, setActiveFilter] = useState<BuildingTag | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isCardMinimized, setIsCardMinimized] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [isLocatingUser, setIsLocatingUser] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isDirectionsOpen, setIsDirectionsOpen] = useState(false);
  const [pendingAutoNavigate, setPendingAutoNavigate] = useState(false);
  const [savedLocations, setSavedLocations] = useState<string[]>([]);
  const [pendingSaveId, setPendingSaveId] = useState<string | null>(null);
  const [navigationRoute, setNavigationRoute] = useState<NavigationResponseRecord | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [isMapChromeVisible, setIsMapChromeVisible] = useState(true);
  const [isVoiceGuidanceEnabled, setIsVoiceGuidanceEnabled] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.localStorage.getItem(VOICE_GUIDANCE_STORAGE_KEY) === "true";
  });
  const [mapFocusToken, setMapFocusToken] = useState(0);
  const lastRouteRequestLocationRef = useRef<[number, number] | null>(null);
  const lastRerouteAtRef = useRef(0);
  const activeStepRef = useRef<HTMLDivElement | null>(null);
  const lastSpokenInstructionRef = useRef<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputId = useId();

  function updateMapChromeVisibility(nextVisible: boolean) {
    setIsMapChromeVisible(nextVisible);

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("map-chrome-visibility", { detail: { visible: nextVisible } }));
    }
  }

  async function trackRecentSelection(buildingId: string, nextRoomId: string | null, searchValue: string) {
    if (!isSignedIn) {
      return;
    }

    try {
      const token = await getToken();
      if (!token) {
        return;
      }

      await recordRecentLocation(token, {
        buildingId,
        roomId: nextRoomId,
        searchQuery: searchValue.trim() || null,
      });
      notifyRecentDestinationsUpdated();
    } catch (error) {
      console.error("Unable to record recent location", error);
    }
  }

  function selectSearchResult(building: Building, nextRoomId: string | null, searchValue: string) {
    setSelectedBuilding(building);
    setSelectedRoom(nextRoomId);
    setSearchQuery("");
    setNavigationRoute(null);
    setIsNavigating(false);
    setIsLocatingUser(false);
    setIsDirectionsOpen(false);
    updateMapChromeVisibility(true);
    setIsCardMinimized(false);
    setLocationError(null);
    setAccountError(null);
    void trackRecentSelection(building.id, nextRoomId, searchValue);
  }

  async function requestNavigationRoute(start: [number, number], options?: { startNavigation?: boolean; quiet?: boolean }) {
    if (!selectedBuilding) {
      return false;
    }

    if (!options?.quiet) {
      setIsLoadingRoute(true);
    }

    try {
      const response = await fetchNavigationRoute({
        start,
        destinationBuildingId: selectedBuilding.id,
        roomId: selectedRoom,
      });

      setNavigationRoute(response);
      setLocationError(null);
      lastRouteRequestLocationRef.current = start;

      if (options?.startNavigation) {
        setIsNavigating(true);
      }

      return true;
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : "Unable to load walking directions right now.");

      if (options?.startNavigation) {
        setIsNavigating(false);
      }

      return false;
    } finally {
      if (!options?.quiet) {
        setIsLoadingRoute(false);
      }
    }
  }

  useEffect(() => {
    if (!isAuthLoaded) {
      return;
    }

    if (!isSignedIn) {
      setSavedLocations([]);
      setPendingSaveId(null);
      setAccountError(null);
      return;
    }

    let isCancelled = false;

    async function loadSavedLocations() {
      try {
        const token = await getToken();
        if (!token) {
          throw new Error("Unable to load your saved locations.");
        }

        const saved = await fetchSavedLocations(token);
        if (!isCancelled) {
          setSavedLocations(saved.map((location) => location.buildingId));
        }
      } catch (error) {
        if (!isCancelled) {
          setAccountError(error instanceof Error ? error.message : "Unable to load your saved locations.");
        }
      }
    }

    void loadSavedLocations();

    return () => {
      isCancelled = true;
    };
  }, [getToken, isAuthLoaded, isSignedIn]);

  // Handle URL destination parameter
  useEffect(() => {
    if (destId) {
      const building = BUILDINGS.find(b => b.id === destId);
      if (building) {
        setSelectedBuilding(building);
        setSelectedRoom(roomId);
        setNavigationRoute(null);
        setIsNavigating(false);
        setIsDirectionsOpen(false);
        updateMapChromeVisibility(true);
        setIsCardMinimized(false);
        setLocationError(null);
        setAccountError(null);
        setPendingAutoNavigate(shouldAutoNavigate);
        void trackRecentSelection(building.id, roomId, q ?? "");
      }
    } else if (q) {
      setSearchQuery(q);
    }
  }, [destId, q, roomId, shouldAutoNavigate]);

  useEffect(() => {
    if (!isNavigating || typeof window === "undefined" || !("geolocation" in navigator)) {
      return;
    }

    if (!isLocationServicesEnabled()) {
      setLocationError(LOCATION_SETTINGS_DISABLED_MESSAGE);
      setIsNavigating(false);
      setIsLocatingUser(false);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setUserLocation([position.coords.latitude, position.coords.longitude]);
        setLocationError(null);
        setIsLocatingUser(false);
      },
      (error) => {
        setLocationError(getLocationErrorMessage(error));
        setIsLocatingUser(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [isNavigating]);

  useEffect(() => {
    if (userLocation) {
      writeStoredUserLocation(userLocation);
    }
  }, [userLocation]);

  useEffect(() => {
    if (!isNavigating || !userLocation || !selectedBuilding || !navigationRoute) {
      return;
    }

    if (!hasMeaningfulMovement(lastRouteRequestLocationRef.current, userLocation, MIN_REROUTE_MOVEMENT_METERS)) {
      return;
    }

    if (!isOffRoute(userLocation, navigationRoute.route.coordinates, OFF_ROUTE_THRESHOLD_METERS)) {
      return;
    }

    const now = Date.now();
    if (now - lastRerouteAtRef.current < REROUTE_THROTTLE_MS) {
      return;
    }

    lastRerouteAtRef.current = now;
    void requestNavigationRoute(userLocation, { quiet: true });
  }, [isNavigating, navigationRoute, selectedBuilding, userLocation]);

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const filteredResults = BUILDINGS.filter(b => !activeFilter || b.tags.includes(activeFilter)).map(b => {
    const keywordMatch = b.searchKeywords?.some((keyword) => keyword.toLowerCase().includes(normalizedSearchQuery)) ?? false;
    const bMatch =
      b.name.toLowerCase().includes(normalizedSearchQuery) ||
      b.desc.toLowerCase().includes(normalizedSearchQuery) ||
      keywordMatch;
    const matchedRooms = b.rooms.filter(r => 
      r.name.toLowerCase().includes(normalizedSearchQuery) || 
      r.desc.toLowerCase().includes(normalizedSearchQuery) ||
      r.floor.toLowerCase().includes(normalizedSearchQuery)
    );
    return { building: b, matchedRooms, bMatch };
  }).filter(res => res.bMatch || res.matchedRooms.length > 0);

  const toggleSave = async (id: string) => {
    if (!isSignedIn) {
      openSignIn();
      return;
    }

    setPendingSaveId(id);
    setAccountError(null);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Unable to update your saved locations.");
      }

      const isSaved = savedLocations.includes(id);
      if (isSaved) {
        await removeSavedLocation(token, id);
        setSavedLocations((current) => current.filter((entry) => entry !== id));
      } else {
        await saveLocation(token, id);
        setSavedLocations((current) => (current.includes(id) ? current : [...current, id]));
      }
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : "Unable to update your saved locations.");
    } finally {
      setPendingSaveId(null);
    }
  };

  const mapCenter = selectedBuilding 
    ? [selectedBuilding.lat, selectedBuilding.lng] as [number, number]
    : CAMPUS_CENTER;
  const mapZoom = selectedBuilding ? 17 : 16;
  const selectedRoomData = selectedBuilding?.rooms.find((room) => room.id === selectedRoom) ?? null;
  const routeData = navigationRoute?.route ?? null;
  const filteredRouteSteps = routeData?.steps.filter((step) => !/^arrive at your destination/i.test(step.instruction)) ?? [];
  const navigationSteps = filteredRouteSteps.length
    ? mergeNavigationSteps(filteredRouteSteps.map((step) => ({ ...step })))
    : [{ instruction: "Follow the highlighted walking path to the building entrance.", distanceMeters: 0, pathName: null, waypoints: null }];
  const remainingDistanceMeters = routeData && userLocation
    ? Math.min(routeData.distanceMeters, Math.max(0, Math.round(getRemainingRouteDistance(userLocation, routeData.coordinates))))
    : routeData?.distanceMeters ?? 0;
  const remainingDurationMinutes = routeData && routeData.distanceMeters > 0
    ? Math.max(1, Math.round(routeData.durationMinutes * (remainingDistanceMeters / routeData.distanceMeters)))
    : routeData?.durationMinutes ?? 0;
  const nearestCoordinateIndex = routeData && userLocation ? getNearestRouteCoordinateIndex(userLocation, routeData.coordinates) : null;
  const activeStepIndex = routeData ? getActiveStepIndex(navigationSteps, routeData.distanceMeters, remainingDistanceMeters, nearestCoordinateIndex) : 0;
  const nextStep = navigationSteps[activeStepIndex] ?? navigationSteps[0] ?? null;
  const spokenNextInstruction = nextStep ? getSpokenInstruction(nextStep) : null;
  const arrivalLabel = navigationRoute?.destination.arrivalLabel ?? selectedBuilding?.primaryEntranceLabel ?? "primary entrance";
  const arrivalHint = navigationRoute?.destination.arrivalHint ?? selectedBuilding?.primaryEntranceHint ?? "Follow the highlighted route to the marked entrance.";
  const arrivalInstruction = navigationRoute?.destination.arrivalInstruction
    ?? (selectedBuilding ? getArrivalInstruction(selectedBuilding, arrivalLabel, arrivalHint, selectedRoomData) : null);
  const supportsVoiceGuidance = typeof window !== "undefined" && "speechSynthesis" in window;
  const isNearArrival = Boolean(
    userLocation && navigationRoute && getDistanceMeters(userLocation, navigationRoute.destination.arrival) <= ARRIVAL_RADIUS_METERS
  );
  const mapFocusCenter = isNavigating && userLocation ? userLocation : null;
  const mapBounds = isNavigating && routeData?.bounds ? routeData.bounds : null;

  useEffect(() => {
    if (!isDirectionsOpen || !activeStepRef.current) {
      return;
    }

    activeStepRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeStepIndex, isDirectionsOpen]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(VOICE_GUIDANCE_STORAGE_KEY, String(isVoiceGuidanceEnabled));
  }, [isVoiceGuidanceEnabled]);

  useEffect(() => {
    updateMapChromeVisibility(true);

    return () => {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("map-chrome-visibility", { detail: { visible: true } }));
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    if (!isVoiceGuidanceEnabled || !isNavigating) {
      window.speechSynthesis.cancel();
      lastSpokenInstructionRef.current = null;
      return;
    }

    const instructionToSpeak = isNearArrival
      ? arrivalInstruction ?? `You are arriving at the ${arrivalLabel} of ${selectedBuilding?.name ?? "your destination"}.`
      : spokenNextInstruction;

    if (!instructionToSpeak || lastSpokenInstructionRef.current === instructionToSpeak) {
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(instructionToSpeak);
    utterance.rate = 1;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
    lastSpokenInstructionRef.current = instructionToSpeak;

    return () => {
      utterance.onend = null;
    };
  }, [arrivalInstruction, arrivalLabel, isNearArrival, isNavigating, isVoiceGuidanceEnabled, selectedBuilding?.name, spokenNextInstruction]);

  const startNavigation = () => {
    if (!selectedBuilding) {
      return;
    }

    if (!isLocationServicesEnabled()) {
      setLocationError(LOCATION_SETTINGS_DISABLED_MESSAGE);
      setIsNavigating(false);
      setIsLocatingUser(false);
      return;
    }

    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setLocationError("Geolocation is not supported in this browser.");
      return;
    }

    setIsLocatingUser(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation: [number, number] = [position.coords.latitude, position.coords.longitude];
        setUserLocation(nextLocation);
        setIsLocatingUser(false);
        void requestNavigationRoute(nextLocation, { startNavigation: true });
      },
      (error) => {
        setLocationError(getLocationErrorMessage(error));
        setNavigationRoute(null);
        setIsNavigating(false);
        setIsLocatingUser(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 15000,
      }
    );
  };

  const stopNavigation = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    setIsNavigating(false);
    setIsLocatingUser(false);
    setNavigationRoute(null);
    setIsDirectionsOpen(false);
    setIsLoadingRoute(false);
    lastRouteRequestLocationRef.current = null;
    updateMapChromeVisibility(true);
  };

  const closeGuide = () => {
    setIsGuideOpen(false);
  };

  const focusSearchInput = (target: EventTarget | null) => {
    const targetElement = target as HTMLElement | null;
    if (targetElement?.closest("button")) {
      return;
    }

    const input = searchInputRef.current;
    if (!input) {
      return;
    }

    input.focus();

    const cursorPosition = input.value.length;
    input.setSelectionRange(cursorPosition, cursorPosition);
  };

  const handleSearchShellPointerDown = (event: ReactPointerEvent<HTMLLabelElement>) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest("button")) {
      event.stopPropagation();
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    focusSearchInput(target);
  };

  useEffect(() => {
    if (!pendingAutoNavigate || !selectedBuilding || isNavigating || isLocatingUser) {
      return;
    }

    setPendingAutoNavigate(false);
    startNavigation();
  }, [pendingAutoNavigate, selectedBuilding, isNavigating, isLocatingUser]);

  return (
    <div className={cn(
      "relative w-full flex flex-col overflow-hidden",
      isMapChromeVisible ? "h-[calc(100vh-6rem)] md:h-[calc(100vh-2.5rem)]" : "h-[100svh] md:h-screen"
    )}>
      {!isMapChromeVisible ? (
        <>
          <button
            type="button"
            onMouseEnter={() => updateMapChromeVisibility(true)}
            onFocus={() => updateMapChromeVisibility(true)}
            onTouchStart={() => updateMapChromeVisibility(true)}
            className="absolute inset-x-0 top-0 z-[650] h-7 bg-transparent"
            aria-label="Reveal map header"
          />
        </>
      ) : null}
      
      {/* Floating Search Bar & Filters */}
      <div className={cn(
        "map-search-chrome absolute inset-x-0 top-3 z-[520] mx-auto flex w-full max-w-3xl flex-col gap-2.5 px-3 pointer-events-none transition-all duration-300 md:top-4 md:gap-3 md:px-4",
        isNavigating ? "opacity-0 -translate-y-6 pointer-events-none" : "opacity-100 translate-y-0"
      )}>
        <label
          htmlFor={searchInputId}
          data-testid="map-search-shell"
          className="relative flex h-12 cursor-text items-center rounded-full border border-outline-variant/20 bg-surface shadow-[0_12px_30px_rgba(26,28,27,0.18)] pointer-events-auto md:h-14 dark:shadow-[0_14px_34px_rgba(9,10,10,0.34)]"
          onPointerDown={handleSearchShellPointerDown}
        >
          <Search className="pointer-events-none ml-5 h-5 w-5 shrink-0 text-on-surface-variant" />
          <input
            id={searchInputId}
            ref={searchInputRef}
            type="text"
            className="h-full min-w-0 flex-1 rounded-full bg-transparent pl-4 pr-12 text-base leading-none text-on-surface placeholder:text-on-surface-variant focus:outline-none font-body"
            placeholder="Search buildings, rooms, services..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-surface-container transition-colors"
            >
              <X className="w-5 h-5 text-on-surface-variant" />
            </button>
          )}
        </label>

        <div className="flex gap-1.5 overflow-x-auto pb-2 hide-scrollbar px-1 pointer-events-auto md:gap-2">
          <button 
            onClick={() => setActiveFilter(activeFilter === "dining" ? null : "dining")}
            className={cn("flex items-center gap-2 px-4 py-2.5 md:px-5 shadow-lg rounded-full text-sm font-bold whitespace-nowrap border transition-colors", activeFilter === "dining" ? "bg-primary text-on-primary border-primary" : "bg-surface text-on-surface border-outline-variant/20 hover:bg-surface-container")}
          >
            <Coffee className={cn("w-4 h-4", activeFilter === "dining" ? "text-on-primary" : "text-orange-400")} /> Dining
          </button>
          <button 
            onClick={() => setActiveFilter(activeFilter === "parking" ? null : "parking")}
            className={cn("flex items-center gap-2 px-4 py-2.5 md:px-5 shadow-lg rounded-full text-sm font-bold whitespace-nowrap border transition-colors", activeFilter === "parking" ? "bg-primary text-on-primary border-primary" : "bg-surface text-on-surface border-outline-variant/20 hover:bg-surface-container")}
          >
            <Car className={cn("w-4 h-4", activeFilter === "parking" ? "text-on-primary" : "text-blue-400")} /> Parking
          </button>
          <button 
            onClick={() => setActiveFilter(activeFilter === "study" ? null : "study")}
            className={cn("flex items-center gap-2 px-4 py-2.5 md:px-5 shadow-lg rounded-full text-sm font-bold whitespace-nowrap border transition-colors", activeFilter === "study" ? "bg-primary text-on-primary border-primary" : "bg-surface text-on-surface border-outline-variant/20 hover:bg-surface-container")}
          >
            <BookOpen className={cn("w-4 h-4", activeFilter === "study" ? "text-on-primary" : "text-green-400")} /> Study
          </button>
          <button onClick={() => setIsGuideOpen(true)} className="flex items-center gap-2 px-4 py-2.5 md:px-5 bg-primary text-on-primary shadow-lg rounded-full text-sm font-bold whitespace-nowrap hover:brightness-110 transition-colors">
            <HelpCircle className="w-4 h-4" /> Guide
          </button>
        </div>

        {isGuideOpen && (
          <div className="pointer-events-auto glass-panel rounded-3xl p-5 md:p-6 shadow-[0_18px_36px_rgba(26,28,27,0.18)] dark:shadow-[0_20px_44px_rgba(9,10,10,0.34)] animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <span className="text-on-surface-variant font-body text-[10px] tracking-[0.22em] uppercase font-bold mb-2 block">Map Guide</span>
                <h2 className="font-headline text-xl font-bold text-primary">How to use the campus map</h2>
              </div>
              <button
                onClick={closeGuide}
                aria-label="Close map guide"
                className="rounded-full bg-surface-container p-2 text-on-surface-variant hover:bg-surface-container-high transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                {
                  title: "Search quickly",
                  body: "Type a building, room, or service name to jump straight to matching places.",
                },
                {
                  title: "Use filters",
                  body: "Tap Dining, Parking, or Study to narrow the map to the places you need right now.",
                },
                {
                  title: "Open a building",
                  body: "Select any pin to view rooms, building details, and navigation options.",
                },
                {
                  title: "Start your route",
                  body: "Use Start Route to locate yourself and get walking directions to the selected destination.",
                },
              ].map((item, index) => (
                <div key={item.title} className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold shrink-0">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-bold text-on-surface">{item.title}</p>
                      <p className="text-sm text-on-surface-variant mt-1.5 leading-6">{item.body}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search Results Dropdown */}
        {searchQuery && !selectedBuilding && (
          <div className="bg-surface rounded-2xl shadow-2xl mt-1 overflow-hidden max-h-[60vh] overflow-y-auto border border-outline-variant/20 pointer-events-auto">
            {filteredResults.length > 0 ? (
              filteredResults.map(res => (
                <div 
                  key={res.building.id}
                  className="w-full text-left px-6 py-4 border-b border-outline-variant/10 last:border-0 flex items-start gap-4"
                >
                  <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center shrink-0 mt-1">
                    <MapPin className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <button 
                      onClick={() => {
                        selectSearchResult(res.building, null, searchQuery);
                      }}
                      className="text-left hover:text-primary transition-colors block w-full"
                    >
                      <p className="font-headline font-bold text-on-surface">{res.building.name}</p>
                    </button>
                    {res.matchedRooms.length > 0 ? (
                      <div className="mt-2 flex flex-col gap-2">
                        {res.matchedRooms.map(room => (
                          <button 
                            key={room.id} 
                            onClick={() => {
                              selectSearchResult(res.building, room.id, searchQuery);
                            }}
                            className="bg-primary-container/50 p-2 rounded-lg border border-primary/10 text-left hover:bg-primary-container/80 transition-colors w-full"
                          >
                            <p className="text-sm font-bold text-primary">{room.name} <span className="text-xs font-normal text-on-surface-variant ml-1">• {room.floor}</span></p>
                            <p className="text-xs text-on-surface-variant mt-0.5">{room.desc}</p>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-on-surface-variant truncate mt-1">{res.building.desc}</p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="px-6 py-8 text-center text-on-surface-variant">
                No locations found.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Map Area */}
      <div
        className="flex-1 relative bg-surface z-0"
        onWheelCapture={() => {
          if (isMapChromeVisible && !isGuideOpen && !isDirectionsOpen && !searchQuery) {
            updateMapChromeVisibility(false);
          }
        }}
        onTouchMove={() => {
          if (isMapChromeVisible && !isGuideOpen && !isDirectionsOpen && !searchQuery) {
            updateMapChromeVisibility(false);
          }
        }}
        onPointerDown={(event) => {
          const target = event.target as HTMLElement;
          if (target.closest("button, input, a")) {
            return;
          }

          if (isMapChromeVisible && !isGuideOpen && !isDirectionsOpen && !searchQuery) {
            updateMapChromeVisibility(false);
          }
        }}
      >
        <MapContainer 
          center={CAMPUS_CENTER} 
          zoom={16} 
          zoomControl={false}
          className="w-full h-full"
        >
          {/* Standard OpenStreetMap Tiles */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          <MapUpdater center={mapCenter} zoom={mapZoom} bounds={mapBounds} focusCenter={mapFocusCenter} focusToken={mapFocusToken} />
          
          <MapClickHandler onClick={() => {
            if (selectedBuilding) {
              setIsCardMinimized(true);
            }
          }} />

          {/* User Location */}
          {userLocation && <Marker position={userLocation} icon={userIcon} />}

          {/* Destination Entrance */}
          {isNavigating && navigationRoute ? <Marker position={navigationRoute.destination.arrival} icon={entranceIcon} /> : null}

          {/* Buildings */}
          {BUILDINGS.filter(b => !activeFilter || b.tags.includes(activeFilter)).map(b => (
            <Marker 
              key={b.id} 
              position={[b.lat, b.lng]} 
              icon={createIcon(selectedBuilding?.id === b.id)}
              eventHandlers={{
                click: () => {
                  setSelectedBuilding(b);
                  setSelectedRoom(null);
                  setIsNavigating(false);
                  setNavigationRoute(null);
                  setIsDirectionsOpen(false);
                  setIsCardMinimized(false);
                  setLocationError(null);
                  setAccountError(null);
                }
              }}
            />
          ))}

          {/* Navigation Route */}
          {isNavigating && routeData && (
            <Polyline 
              positions={routeData.coordinates}
              pathOptions={{ color: 'var(--color-primary)', weight: 5, dashArray: '10, 10' }} 
              className="animate-[dash_1s_linear_infinite]"
            />
          )}
        </MapContainer>

        {isNavigating && routeData && nextStep && isCardMinimized ? (
          <div className="map-mini-instruction pointer-events-none absolute left-1/2 top-3 z-[450] w-[min(calc(100vw-2rem),24rem)] -translate-x-1/2 px-3 md:top-4 md:w-[24rem] md:px-0">
            <div className="rounded-[1.5rem] border border-outline-variant/20 bg-surface/94 px-4 py-3 shadow-[0_14px_34px_rgba(14,19,17,0.18)] backdrop-blur-xl transition-all duration-300 animate-in fade-in slide-in-from-top-4 dark:bg-surface-container/92 dark:border-outline-variant/15">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-on-primary shadow-sm">
                  {(() => {
                    const PreviewStepIcon = getStepIcon(nextStep.instruction);
                    return <PreviewStepIcon className="h-5 w-5" />;
                  })()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-primary/90">
                    <span>Next move</span>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px]">Step {activeStepIndex + 1}</span>
                  </div>
                    <p className="map-clamp-2 mt-1 text-[13px] md:text-sm font-semibold leading-5 text-on-surface">{spokenNextInstruction}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                    {nextStep.distanceMeters > 0 ? <span className="rounded-full bg-surface-container-low px-2.5 py-1 font-semibold text-on-surface-variant">{formatDistance(nextStep.distanceMeters)}</span> : null}
                    {nextStep.pathName ? <span className="rounded-full bg-surface-container-low px-2.5 py-1 font-semibold text-on-surface-variant">{nextStep.pathName}</span> : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {isNavigating ? (
          <div className="map-floating-actions absolute right-3 top-[7.25rem] z-[460] flex flex-col gap-2 md:right-5 md:top-[8.6rem]">
            {supportsVoiceGuidance ? (
              <button
                onClick={() => setIsVoiceGuidanceEnabled((current) => !current)}
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-2xl border shadow-[0_12px_26px_rgba(10,18,15,0.14)] backdrop-blur-xl transition-colors",
                  isVoiceGuidanceEnabled
                    ? "border-primary/20 bg-primary text-on-primary"
                    : "border-outline-variant/15 bg-surface/92 text-on-surface-variant"
                )}
                aria-label={isVoiceGuidanceEnabled ? "Mute voice guidance" : "Enable voice guidance"}
              >
                {isVoiceGuidanceEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
              </button>
            ) : null}
            <button
              onClick={() => setMapFocusToken((current) => current + 1)}
              disabled={!userLocation}
              className="flex h-12 w-12 items-center justify-center rounded-2xl border border-outline-variant/15 bg-surface/92 text-on-surface shadow-[0_12px_26px_rgba(10,18,15,0.14)] backdrop-blur-xl transition-colors hover:bg-surface-container-low disabled:opacity-50"
              aria-label="Recenter map on your location"
            >
              <LocateFixed className="h-5 w-5" />
            </button>
          </div>
        ) : null}
      </div>

      {/* Selected Building Details (Floating Bottom) */}
      {selectedBuilding && (
        <div className="map-bottom-card absolute bottom-[5.4rem] md:bottom-5 left-1/2 z-[500] w-full max-w-lg -translate-x-1/2 px-2 md:max-w-xl md:px-4 pointer-events-none">
          {isCardMinimized ? (
            <div 
              className="bg-surface/94 backdrop-blur-xl rounded-[1.7rem] md:rounded-[1.9rem] shadow-[0_18px_42px_rgba(18,20,19,0.14)] dark:shadow-[0_18px_42px_rgba(9,10,10,0.28)] p-3.5 md:p-5 flex flex-col cursor-pointer pointer-events-auto border border-outline-variant/15 hover:bg-surface-container transition-all animate-in slide-in-from-bottom-8"
              onClick={() => setIsCardMinimized(false)}
            >
              <div className="w-12 h-1.5 bg-on-surface-variant/20 rounded-full mx-auto mb-3 shrink-0 md:hidden" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 overflow-hidden">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex flex-col">
                    <p className="font-headline font-bold text-on-surface truncate">{selectedBuilding.name}</p>
                    <p className="text-[11px] text-on-surface-variant">Tap for details & routing</p>
                  </div>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); setSelectedBuilding(null); setSelectedRoom(null); setIsNavigating(false); setNavigationRoute(null); setIsDirectionsOpen(false); setLocationError(null); setAccountError(null); }} 
                  className="p-2 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface-variant transition-colors ml-4 shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-surface/95 backdrop-blur-xl rounded-t-[1.85rem] md:rounded-[2rem] shadow-[0_-12px_38px_rgba(18,20,19,0.14)] md:shadow-[0_18px_42px_rgba(18,20,19,0.14)] dark:shadow-[0_-12px_38px_rgba(9,10,10,0.28)] px-4 py-4 pb-4 md:p-6 animate-in slide-in-from-bottom-8 border border-outline-variant/15 pointer-events-auto flex flex-col max-h-[58svh] sm:max-h-[63svh] md:max-h-[74vh]">
              <div className="w-12 h-1.5 bg-on-surface-variant/20 rounded-full mx-auto mb-3 shrink-0 cursor-pointer" onClick={() => setIsCardMinimized(true)} />
              <div className="flex justify-between items-start gap-3 mb-2 shrink-0">
                <div className="min-w-0 pr-2">
                  <h2 className="font-headline text-lg sm:text-xl md:text-[1.7rem] font-bold text-on-surface leading-tight">{selectedBuilding.name}</h2>
                  <p className="mt-1 text-sm leading-5 text-on-surface-variant">{selectedBuilding.desc}</p>
                </div>
                <button 
                  onClick={() => { setSelectedBuilding(null); setSelectedRoom(null); setIsNavigating(false); setNavigationRoute(null); setIsDirectionsOpen(false); setLocationError(null); setAccountError(null); }} 
                  className="p-2 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface-variant shrink-0 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="overflow-y-auto hide-scrollbar flex-1 pb-1 pr-1">
                {/* Selected Room Highlight */}
                {selectedRoom && selectedBuilding.rooms.find(r => r.id === selectedRoom) && (
                  <div className="mb-4 bg-primary-container/30 border border-primary/20 p-4 rounded-2xl">
                    <div className="flex items-center gap-2 mb-1">
                      <MapPin className="w-4 h-4 text-primary" />
                      <h3 className="font-bold text-primary">{selectedBuilding.rooms.find(r => r.id === selectedRoom)?.name}</h3>
                      <span className="text-xs font-bold text-primary bg-primary/20 px-2 py-0.5 rounded-md ml-auto">
                        {selectedBuilding.rooms.find(r => r.id === selectedRoom)?.floor}
                      </span>
                    </div>
                    <p className="text-sm text-on-surface-variant mt-2">
                      {selectedBuilding.rooms.find(r => r.id === selectedRoom)?.desc}
                    </p>
                    <button onClick={() => setSelectedRoom(null)} className="text-xs text-primary font-bold mt-3 hover:underline">
                      View all building locations
                    </button>
                  </div>
                )}
                {locationError && (
                  <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <p>{locationError}</p>
                      {locationError === LOCATION_SETTINGS_DISABLED_MESSAGE ? (
                        <Link to="/settings" className="inline-flex mt-3 font-bold text-primary hover:underline">
                          Open Settings
                        </Link>
                      ) : null}
                    </div>
                  </div>
                )}

                {accountError && (
                  <div className="mb-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <p>{accountError}</p>
                  </div>
                )}
                
                {/* Rooms/Floors Info */}
                {!isNavigating && selectedBuilding.rooms.length > 0 && !selectedRoom && (
                  <div className="mb-6">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Key Locations</h3>
                    <div className="flex flex-col gap-2">
                      {selectedBuilding.rooms.map(room => (
                        <button 
                          key={room.id} 
                          onClick={() => setSelectedRoom(room.id)}
                          className="flex justify-between items-center bg-surface-container-lowest p-2 rounded-lg border border-outline-variant/30 text-left hover:bg-surface-container transition-colors w-full"
                        >
                          <div>
                            <p className="text-sm font-bold text-on-surface">{room.name}</p>
                            <p className="text-xs text-on-surface-variant">{room.desc}</p>
                          </div>
                          <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-md whitespace-nowrap ml-2">{room.floor}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="pt-2 shrink-0">
                {isNavigating && routeData ? (
                  <div className="space-y-4">
                    <div className="overflow-hidden rounded-[1.75rem] md:rounded-[2rem] border border-outline-variant/15 bg-surface-container-lowest shadow-[0_18px_44px_rgba(10,35,24,0.10)] dark:bg-surface-container dark:border-outline-variant/12">
                      <div className="flex items-start justify-between gap-3 border-b border-primary/10 px-4 py-3.5 md:px-5 md:py-4">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="flex h-11 w-11 md:h-12 md:w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary shadow-inner">
                            <Navigation className="w-6 h-6 md:w-7 md:h-7" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] font-label font-bold uppercase tracking-[0.28em] text-primary/90">Live Navigation</p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-2">
                              <span className="font-headline text-lg md:text-xl font-bold text-on-surface">{formatEta(remainingDurationMinutes)}</span>
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-container-high px-2.5 py-1 text-xs md:text-sm font-semibold text-on-surface-variant"><Footprints className="w-3.5 h-3.5" /> {formatDistance(remainingDistanceMeters)}</span>
                              <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-primary">{getWalkabilityLabel(remainingDurationMinutes)}</span>
                              {isLoadingRoute ? <span className="inline-flex items-center rounded-full bg-secondary/12 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary">Updating route</span> : null}
                            </div>
                          </div>
                        </div>
                        <button 
                          onClick={stopNavigation}
                          className="rounded-2xl bg-red-500/10 px-3 py-2 md:px-4 md:py-2.5 text-sm font-bold text-red-700 transition-colors hover:bg-red-500/20 dark:text-red-300"
                        >
                          End
                        </button>
                      </div>

                      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-primary/10 px-4 py-3 md:px-5 text-xs text-on-surface-variant">
                        <p className="leading-5">{isNearArrival ? arrivalInstruction ?? `You are almost at the ${arrivalLabel}.` : `Route ends at the ${arrivalLabel}.`}</p>
                        {supportsVoiceGuidance ? (
                          <button
                            onClick={() => setIsVoiceGuidanceEnabled((current) => !current)}
                            className={cn(
                              "inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-semibold transition-colors",
                              isVoiceGuidanceEnabled
                                ? "bg-primary/10 text-primary"
                                : "bg-surface-container-high text-on-surface-variant"
                            )}
                          >
                            {isVoiceGuidanceEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
                            {isVoiceGuidanceEnabled ? "Voice on" : "Voice off"}
                          </button>
                        ) : null}
                      </div>

                      {nextStep ? (
                        <div className="px-4 py-3.5 md:px-5 md:py-4">
                          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-on-surface-variant">Next move</p>
                          <div className="mt-2.5 rounded-2xl border border-outline-variant/12 bg-surface-container px-4 py-3 dark:bg-surface-container-high">
                            <div className="flex items-start gap-3 transition-all duration-300">
                              <div className="mt-0.5 flex h-9 w-9 md:h-10 md:w-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-on-primary shadow-sm transition-transform duration-300 motion-safe:animate-[pulse_2.4s_ease-in-out_infinite]">
                                {(() => {
                                  const NextStepIcon = getStepIcon(nextStep.instruction);
                                  return <NextStepIcon className="h-4.5 w-4.5 md:h-5 md:w-5" />;
                                })()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm md:text-[15px] font-semibold leading-6 text-on-surface">{isNearArrival ? arrivalInstruction ?? `Arrive at the ${arrivalLabel} of ${selectedBuilding.name}.` : spokenNextInstruction}</p>
                                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] md:text-xs text-on-surface-variant">
                                  {nextStep.distanceMeters > 0 ? <span className="rounded-full bg-surface-container-high px-2.5 py-1 font-semibold text-on-surface-variant">{formatDistance(nextStep.distanceMeters)}</span> : null}
                                  {nextStep.pathName ? <span className="rounded-full bg-surface-container-high px-2.5 py-1 font-semibold text-on-surface-variant">{nextStep.pathName}</span> : null}
                                  <span className="rounded-full bg-primary/10 px-2.5 py-1 font-semibold text-primary">Step {activeStepIndex + 1} of {navigationSteps.length}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="rounded-[1.6rem] md:rounded-[2rem] border border-outline-variant/15 bg-surface-container-low p-3 md:p-4 shadow-[0_14px_34px_rgba(14,19,17,0.06)] dark:bg-surface-container-low">
                      <button
                        onClick={() => setIsDirectionsOpen(true)}
                        className="group flex w-full items-center justify-between gap-3 rounded-[1.25rem] md:rounded-[1.5rem] border border-outline-variant/15 bg-surface-container-lowest px-3 py-3 md:px-4 md:py-4 text-left transition-colors hover:bg-surface-container"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-9 w-9 md:h-11 md:w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                            <LocateFixed className="w-4.5 h-4.5 md:w-5 md:h-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-on-surface-variant">Detailed directions</p>
                            <p className="mt-0.5 text-[13px] md:text-sm font-semibold text-on-surface">Open detailed directions</p>
                            <p className="map-clamp-2 mt-0.5 text-[10px] md:text-xs leading-4 text-on-surface-variant">{navigationSteps.length} steps, entrance target, and arrival guidance</p>
                          </div>
                        </div>
                        <div className="flex h-8 w-8 md:h-10 md:w-10 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant transition-transform group-hover:translate-x-0.5">
                          <ChevronRight className="w-4.5 h-4.5 md:w-5 md:h-5" />
                        </div>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button 
                      onClick={startNavigation}
                      disabled={isLocatingUser || isLoadingRoute}
                      className="flex-1 bg-primary text-on-primary py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:brightness-110 transition-all shadow-lg shadow-primary/20  mb-1.5"
                    >
                      {isLocatingUser || isLoadingRoute ? <LocateFixed className="w-5 h-5 animate-pulse" /> : <Navigation className="w-5 h-5" />}
                      {isLocatingUser ? "Locating You..." : isLoadingRoute ? "Loading Route..." : "Start Route"}
                    </button>
                    <button 
                      onClick={() => { void toggleSave(selectedBuilding.id); }} 
                      disabled={pendingSaveId === selectedBuilding.id}
                      aria-label={savedLocations.includes(selectedBuilding.id) ? "Remove saved location" : "Save location"}
                      className="p-3.5 rounded-xl bg-surface-container-high text-on-surface hover:bg-surface-variant transition-colors border border-outline-variant/20 disabled:opacity-60"
                    >
                      {savedLocations.includes(selectedBuilding.id) ? (
                        <BookmarkCheck className="w-6 h-6 text-secondary" />
                      ) : (
                        <Bookmark className="w-6 h-6" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {selectedBuilding && isNavigating && routeData && isDirectionsOpen ? (
        <div className="absolute inset-0 z-[700] flex items-end justify-center bg-black/30 px-0 pb-0 pt-20 backdrop-blur-sm md:p-6">
          <button
            className="absolute inset-0"
            onClick={() => setIsDirectionsOpen(false)}
            aria-label="Close detailed directions"
          />
          <div className="map-directions-sheet relative z-10 flex max-h-[82vh] w-full max-w-xl flex-col overflow-hidden rounded-t-[2rem] border border-b-0 border-outline-variant/15 bg-surface shadow-[0_-12px_44px_rgba(7,10,9,0.18)] md:max-h-[78vh] md:rounded-[2rem] md:border md:shadow-[0_28px_60px_rgba(7,10,9,0.22)]">
            <div className="flex justify-center pt-3 md:hidden">
              <div className="h-1.5 w-14 rounded-full bg-on-surface-variant/20" />
            </div>
            <div className="flex items-start justify-between gap-4 border-b border-outline-variant/10 px-5 py-4 md:px-6">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary">Walking directions</p>
                <h3 className="map-clamp-2 mt-1 font-headline text-xl font-bold text-on-surface">{selectedBuilding.name}</h3>
                <p className="mt-1 text-sm text-on-surface-variant">{formatEta(remainingDurationMinutes)} remaining • {formatDistance(remainingDistanceMeters)}</p>
                <p className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-on-surface-variant">{arrivalLabel}</p>
                <p className="map-clamp-2 mt-1 text-xs text-on-surface-variant">{arrivalHint}</p>
              </div>
              <button
                onClick={() => setIsDirectionsOpen(false)}
                className="rounded-full bg-surface-container p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-4 md:px-6">
              <div className="mb-4 rounded-2xl border border-outline-variant/10 bg-surface-container-lowest px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Arrival target</p>
                <p className="mt-1 text-sm font-semibold text-on-surface">{arrivalLabel}</p>
                <p className="mt-1 text-xs leading-5 text-on-surface-variant">{arrivalHint}</p>
              </div>

              <div className="mb-4 rounded-2xl border border-primary/12 bg-primary/5 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">Current step</p>
                <div className="mt-2 flex items-start gap-3 transition-all duration-300">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-on-primary shadow-sm transition-transform duration-300 motion-safe:animate-[pulse_2.4s_ease-in-out_infinite]">
                    {(() => {
                      const ActiveStepIcon = getStepIcon(nextStep?.instruction ?? "");
                      return <ActiveStepIcon className="h-5 w-5" />;
                    })()}
                  </div>
                  <div className="min-w-0">
                    <p className="map-clamp-2 text-sm font-semibold leading-6 text-on-surface">{isNearArrival ? arrivalInstruction ?? `Arrive at the ${arrivalLabel} of ${selectedBuilding.name}.` : spokenNextInstruction ?? "Continue toward the building entrance."}</p>
                    <p className="mt-1 text-xs text-on-surface-variant">Step {Math.min(activeStepIndex + 1, navigationSteps.length)} of {navigationSteps.length}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {navigationSteps.map((step, index) => (
                  <div ref={index === activeStepIndex ? activeStepRef : null} key={`${index}-${step.instruction}`} className={cn(
                    "rounded-2xl border px-4 py-3 shadow-sm transition-all duration-300",
                    index === activeStepIndex
                      ? "border-primary/25 bg-primary/6 shadow-[0_10px_24px_rgba(14,108,75,0.08)] scale-[1.01]"
                      : "border-outline-variant/10 bg-surface-container-lowest"
                  )}>
                    <div className="flex items-start gap-3 text-sm text-on-surface">
                      <div className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl",
                        index === activeStepIndex
                          ? "bg-primary text-on-primary"
                          : index < activeStepIndex
                            ? "bg-secondary/15 text-secondary"
                            : "bg-primary/10 text-primary"
                      )}>
                        {index < activeStepIndex ? <Check className="h-4.5 w-4.5" /> : (() => {
                          const StepIcon = getStepIcon(step.instruction);
                          return <StepIcon className="h-4.5 w-4.5" />;
                        })()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                        <p className="map-clamp-3 font-medium leading-6 text-on-surface">{step.instruction}</p>
                          <span className={cn(
                            "shrink-0 rounded-full px-2 py-1 text-[11px] font-bold",
                            index === activeStepIndex
                              ? "bg-primary/12 text-primary"
                              : index < activeStepIndex
                                ? "bg-secondary/12 text-secondary"
                                : "bg-surface px-2.5 text-on-surface-variant"
                          )}>
                            {index === activeStepIndex ? "Now" : index < activeStepIndex ? "Done" : `${index + 1}`}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                          {step.distanceMeters > 0 ? <span className="rounded-full bg-surface px-2.5 py-1 font-semibold">Walk {formatDistance(step.distanceMeters)}</span> : null}
                          {step.pathName ? <span className="rounded-full bg-primary/8 px-2.5 py-1 font-semibold text-primary">{step.pathName}</span> : null}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="rounded-2xl border border-secondary/15 bg-secondary/5 px-4 py-3 text-sm text-on-surface">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-secondary/15 text-secondary">
                      <Flag className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <p className="font-medium leading-6">{arrivalInstruction ?? getArrivalInstruction(selectedBuilding, arrivalLabel, arrivalHint, selectedRoomData)}</p>
                      <p className="mt-1 text-xs text-on-surface-variant">{`Outdoor walking directions end at the ${arrivalLabel} for this building.`}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      
      <style>{`
        @keyframes dash {
          to { stroke-dashoffset: -20; }
        }
        .map-clamp-2,
        .map-clamp-3 {
          display: -webkit-box;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .map-clamp-2 {
          -webkit-line-clamp: 2;
        }
        .map-clamp-3 {
          -webkit-line-clamp: 3;
        }
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        @media (max-width: 480px) {
          .map-search-chrome {
            top: 0.65rem;
            gap: 0.5rem;
          }
          .map-mini-instruction {
            top: 0.65rem;
            width: min(calc(100vw - 1rem), 19rem);
          }
          .map-floating-actions {
            top: 5.9rem;
            right: 0.65rem;
          }
          .map-bottom-card {
            bottom: 5.1rem;
            padding-left: 0.35rem;
            padding-right: 0.35rem;
          }
          .map-directions-sheet {
            max-height: 76svh;
          }
        }
        @media (max-width: 640px) {
          .map-bottom-card > div {
            max-height: 56svh;
          }
        }
        @media (max-height: 740px) {
          .map-bottom-card {
            bottom: 5rem;
          }
          .map-mini-instruction {
            top: 0.65rem;
          }
        }
        @media (max-height: 520px) and (orientation: landscape) {
          .map-search-chrome {
            top: 0.5rem;
            gap: 0.35rem;
            max-width: min(44rem, calc(100vw - 2rem));
          }
          .map-mini-instruction {
            top: 0.5rem;
            left: 50%;
            width: min(20rem, calc(100vw - 8rem));
            transform: translateX(-50%);
          }
          .map-floating-actions {
            top: 4.75rem;
            right: 1rem;
          }
          .map-bottom-card {
            bottom: 0.75rem;
            max-width: min(22rem, calc(100vw - 8rem));
            left: 1rem;
            transform: none;
          }
          .map-directions-sheet {
            max-height: 92svh;
          }
        }
        @media (max-width: 768px) {
          .leaflet-control-attribution { display: none; }
        }
      `}</style>
    </div>
  );
}
