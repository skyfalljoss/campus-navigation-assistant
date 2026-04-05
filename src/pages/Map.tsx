import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Navigation, X, Bookmark, BookmarkCheck, MapPin, Footprints, Coffee, Car, BookOpen, HelpCircle, LocateFixed, AlertCircle } from "lucide-react";
import { MapContainer, TileLayer, Marker, Polyline, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { BUILDINGS, type Building, type Room } from "../data/buildings";
import { CAMPUS_CENTER, buildRoute, formatDistance, formatEta, getWalkabilityLabel, writeStoredUserLocation } from "../lib/navigation";
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

function getArrivalInstruction(building: Building, room?: Room | null) {
  if (room) {
    return `You will arrive at ${room.name} on the ${room.floor.toLowerCase()} of ${building.name}.`;
  }

  return `You will arrive at ${building.name}.`;
}

// Component to handle map centering
function MapUpdater({
  center,
  zoom,
  bounds,
}: {
  center: [number, number];
  zoom: number;
  bounds?: [[number, number], [number, number]] | null;
}) {
  const map = useMap();
  useEffect(() => {
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
  const [searchParams] = useSearchParams();
  const destId = searchParams.get("dest");
  const q = searchParams.get("q");
  const roomId = searchParams.get("room");
  const shouldAutoNavigate = searchParams.get("navigate") === "1";
  
  const [searchQuery, setSearchQuery] = useState(q || "");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isCardMinimized, setIsCardMinimized] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [isLocatingUser, setIsLocatingUser] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [pendingAutoNavigate, setPendingAutoNavigate] = useState(false);
  
  // Local Storage for saved locations
  const [savedLocations, setSavedLocations] = useState<string[]>(() => {
    const saved = localStorage.getItem("usf_saved_locations");
    return saved ? JSON.parse(saved) : ["lib"];
  });

  useEffect(() => {
    localStorage.setItem("usf_saved_locations", JSON.stringify(savedLocations));
  }, [savedLocations]);

  // Handle URL destination parameter
  useEffect(() => {
    if (destId) {
      const building = BUILDINGS.find(b => b.id === destId);
      if (building) {
        setSelectedBuilding(building);
        setSelectedRoom(roomId);
        setIsCardMinimized(false);
        setLocationError(null);
        setPendingAutoNavigate(shouldAutoNavigate);
      }
    } else if (q) {
      setSearchQuery(q);
    }
  }, [destId, q, roomId, shouldAutoNavigate]);

  useEffect(() => {
    if (!isNavigating || typeof window === "undefined" || !("geolocation" in navigator)) {
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

  const filteredResults = BUILDINGS.filter(b => !activeFilter || b.tags.includes(activeFilter)).map(b => {
    const bMatch = b.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchedRooms = b.rooms.filter(r => 
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      r.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.floor.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return { building: b, matchedRooms, bMatch };
  }).filter(res => res.bMatch || res.matchedRooms.length > 0);

  const toggleSave = (id: string) => {
    setSavedLocations(prev => 
      prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id]
    );
  };

  const mapCenter = selectedBuilding 
    ? [selectedBuilding.lat, selectedBuilding.lng] as [number, number]
    : CAMPUS_CENTER;
  const mapZoom = selectedBuilding ? 17 : 16;
  const selectedRoomData = selectedBuilding?.rooms.find((room) => room.id === selectedRoom) ?? null;
  const destinationLocation = selectedBuilding ? [selectedBuilding.lat, selectedBuilding.lng] as [number, number] : null;
  const routeData = userLocation && destinationLocation ? buildRoute(userLocation, destinationLocation) : null;
  const mapBounds = isNavigating && userLocation && destinationLocation
    ? [
        [Math.min(userLocation[0], destinationLocation[0]), Math.min(userLocation[1], destinationLocation[1])],
        [Math.max(userLocation[0], destinationLocation[0]), Math.max(userLocation[1], destinationLocation[1])],
      ] as [[number, number], [number, number]]
    : null;

  const startNavigation = () => {
    if (!selectedBuilding) {
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
        setUserLocation([position.coords.latitude, position.coords.longitude]);
        setIsNavigating(true);
        setIsLocatingUser(false);
      },
      (error) => {
        setLocationError(getLocationErrorMessage(error));
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
    setIsNavigating(false);
    setIsLocatingUser(false);
  };

  useEffect(() => {
    if (!pendingAutoNavigate || !selectedBuilding || isNavigating || isLocatingUser) {
      return;
    }

    setPendingAutoNavigate(false);
    startNavigation();
  }, [pendingAutoNavigate, selectedBuilding, isNavigating, isLocatingUser]);

  return (
    <div className="relative w-full h-[calc(100vh-6rem)] md:h-[calc(100vh-2.5rem)] flex flex-col overflow-hidden">
      
      {/* Floating Search Bar & Filters */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[500] w-full max-w-2xl px-4 flex flex-col gap-3 pointer-events-none">
        
        {/* Search Input */}
        <div className="relative shadow-[0_8px_30px_rgba(0,0,0,0.4)] rounded-full bg-surface border border-outline-variant/20 pointer-events-auto">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant" />
          <input
            type="text"
            className="w-full bg-transparent text-on-surface rounded-full pl-14 pr-12 py-4 focus:outline-none font-body text-base placeholder:text-on-surface-variant"
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
        </div>

        {/* Quick Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar px-1 pointer-events-auto">
          <button 
            onClick={() => setActiveFilter(activeFilter === "dining" ? null : "dining")}
            className={cn("flex items-center gap-2 px-5 py-2.5 shadow-lg rounded-full text-sm font-bold whitespace-nowrap border transition-colors", activeFilter === "dining" ? "bg-primary text-on-primary border-primary" : "bg-surface text-on-surface border-outline-variant/20 hover:bg-surface-container")}
          >
            <Coffee className={cn("w-4 h-4", activeFilter === "dining" ? "text-on-primary" : "text-orange-400")} /> Dining
          </button>
          <button 
            onClick={() => setActiveFilter(activeFilter === "parking" ? null : "parking")}
            className={cn("flex items-center gap-2 px-5 py-2.5 shadow-lg rounded-full text-sm font-bold whitespace-nowrap border transition-colors", activeFilter === "parking" ? "bg-primary text-on-primary border-primary" : "bg-surface text-on-surface border-outline-variant/20 hover:bg-surface-container")}
          >
            <Car className={cn("w-4 h-4", activeFilter === "parking" ? "text-on-primary" : "text-blue-400")} /> Parking
          </button>
          <button 
            onClick={() => setActiveFilter(activeFilter === "study" ? null : "study")}
            className={cn("flex items-center gap-2 px-5 py-2.5 shadow-lg rounded-full text-sm font-bold whitespace-nowrap border transition-colors", activeFilter === "study" ? "bg-primary text-on-primary border-primary" : "bg-surface text-on-surface border-outline-variant/20 hover:bg-surface-container")}
          >
            <BookOpen className={cn("w-4 h-4", activeFilter === "study" ? "text-on-primary" : "text-green-400")} /> Study
          </button>
          <button className="flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary shadow-lg rounded-full text-sm font-bold whitespace-nowrap hover:brightness-110 transition-colors">
            <HelpCircle className="w-4 h-4" /> Guide
          </button>
        </div>

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
                      onClick={() => { setSelectedBuilding(res.building); setSelectedRoom(null); setSearchQuery(""); setIsCardMinimized(false); }}
                      className="text-left hover:text-primary transition-colors block w-full"
                    >
                      <p className="font-headline font-bold text-on-surface">{res.building.name}</p>
                    </button>
                    {res.matchedRooms.length > 0 ? (
                      <div className="mt-2 flex flex-col gap-2">
                        {res.matchedRooms.map(room => (
                          <button 
                            key={room.id} 
                            onClick={() => { setSelectedBuilding(res.building); setSelectedRoom(room.id); setSearchQuery(""); setIsCardMinimized(false); }}
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
      <div className="flex-1 relative bg-surface z-0">
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
          
          <MapUpdater center={mapCenter} zoom={mapZoom} bounds={mapBounds} />
          
          <MapClickHandler onClick={() => {
            if (selectedBuilding) {
              setIsCardMinimized(true);
            }
          }} />

          {/* User Location */}
          {userLocation && <Marker position={userLocation} icon={userIcon} />}

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
                  setIsCardMinimized(false);
                  setLocationError(null);
                }
              }}
            />
          ))}

          {/* Navigation Route */}
          {isNavigating && routeData && (
            <Polyline 
              positions={routeData.route}
              pathOptions={{ color: 'var(--color-primary)', weight: 5, dashArray: '10, 10' }} 
              className="animate-[dash_1s_linear_infinite]"
            />
          )}
        </MapContainer>
      </div>

      {/* Selected Building Details (Floating Bottom) */}
      {selectedBuilding && (
        <div className="absolute bottom-0 md:bottom-6 left-1/2 -translate-x-1/2 z-[500] w-full max-w-md md:px-4 pointer-events-none">
          {isCardMinimized ? (
            <div 
              className="bg-surface/95 backdrop-blur-xl rounded-t-3xl md:rounded-3xl shadow-[0_-8px_30px_rgba(0,0,0,0.12)] p-5 pb-8 md:pb-5 flex flex-col cursor-pointer pointer-events-auto border-t md:border border-outline-variant/20 hover:bg-surface-container transition-all animate-in slide-in-from-bottom-8"
              onClick={() => setIsCardMinimized(false)}
            >
              <div className="w-12 h-1.5 bg-on-surface-variant/20 rounded-full mx-auto mb-4 shrink-0" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 overflow-hidden">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex flex-col">
                    <p className="font-headline font-bold text-on-surface truncate">{selectedBuilding.name}</p>
                    <p className="text-xs text-on-surface-variant">Tap for details & routing</p>
                  </div>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); setSelectedBuilding(null); setSelectedRoom(null); setIsNavigating(false); setLocationError(null); }} 
                  className="p-2 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface-variant transition-colors ml-4 shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-surface/95 backdrop-blur-xl rounded-t-3xl md:rounded-3xl shadow-[0_-8px_30px_rgba(0,0,0,0.12)] p-6 pb-8 md:pb-6 animate-in slide-in-from-bottom-8 border-t md:border border-outline-variant/20 pointer-events-auto flex flex-col max-h-[80vh]">
              <div className="w-12 h-1.5 bg-on-surface-variant/20 rounded-full mx-auto mb-4 shrink-0 cursor-pointer" onClick={() => setIsCardMinimized(true)} />
              <div className="flex justify-between items-start mb-2 shrink-0">
                <h2 className="font-headline text-xl font-bold text-on-surface pr-12">{selectedBuilding.name}</h2>
                <button 
                  onClick={() => { setSelectedBuilding(null); setSelectedRoom(null); setIsNavigating(false); setLocationError(null); }} 
                  className="p-2 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface-variant absolute right-6 top-6 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="overflow-y-auto hide-scrollbar flex-1 pb-2">
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

                <p className="text-sm text-on-surface-variant mb-6">{selectedBuilding.desc}</p>

                {locationError && (
                  <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <p>{locationError}</p>
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
                    <div className="bg-surface-container-low p-4 rounded-2xl border border-primary/20">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
                            <Navigation className="w-6 h-6 text-primary" />
                          </div>
                          <div>
                            <p className="text-xs font-label text-primary uppercase tracking-widest font-bold">Live Navigation</p>
                            <div className="flex items-center gap-3 mt-1 flex-wrap">
                              <span className="font-headline font-bold text-lg text-on-surface">{formatEta(routeData.etaMinutes)}</span>
                              <span className="text-sm text-on-surface-variant flex items-center gap-1"><Footprints className="w-3 h-3"/> {formatDistance(routeData.totalDistance)}</span>
                              <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                                {getWalkabilityLabel(routeData.etaMinutes)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <button 
                          onClick={stopNavigation}
                          className="px-4 py-2 bg-red-500/10 text-red-700 dark:text-red-300 rounded-xl text-sm font-bold hover:bg-red-500/20 transition-colors"
                        >
                          End
                        </button>
                      </div>
                    </div>

                    <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <LocateFixed className="w-4 h-4 text-primary" />
                        <h3 className="text-sm font-bold text-on-surface">Directions from your current location</h3>
                      </div>
                      <div className="space-y-2">
                        {routeData.steps.map((step, index) => (
                          <div key={step} className="flex items-start gap-3 text-sm text-on-surface">
                            <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                              {index + 1}
                            </div>
                            <p>{step}</p>
                          </div>
                        ))}
                        <div className="flex items-start gap-3 text-sm text-on-surface">
                          <div className="w-6 h-6 rounded-full bg-secondary/10 text-secondary flex items-center justify-center text-xs font-bold shrink-0">
                            {routeData.steps.length + 1}
                          </div>
                          <p>{getArrivalInstruction(selectedBuilding, selectedRoomData)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button 
                      onClick={startNavigation}
                      disabled={isLocatingUser}
                      className="flex-1 bg-primary text-on-primary py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:brightness-110 transition-all shadow-lg shadow-primary/20"
                    >
                      {isLocatingUser ? <LocateFixed className="w-5 h-5 animate-pulse" /> : <Navigation className="w-5 h-5" />}
                      {isLocatingUser ? "Locating You..." : "Start Route"}
                    </button>
                    <button 
                      onClick={() => toggleSave(selectedBuilding.id)} 
                      className="p-3.5 rounded-xl bg-surface-container-high text-on-surface hover:bg-surface-variant transition-colors border border-outline-variant/20"
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
      
      <style>{`
        @keyframes dash {
          to { stroke-dashoffset: -20; }
        }
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        @media (max-width: 768px) {
          .leaflet-control-attribution { display: none; }
        }
      `}</style>
    </div>
  );
}
