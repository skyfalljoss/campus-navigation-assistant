import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Navigation, X, Bookmark, BookmarkCheck, MapPin, Footprints, Coffee, Car, BookOpen, HelpCircle, ChevronDown, ChevronUp } from "lucide-react";
import { MapContainer, TileLayer, Marker, Polyline, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { cn } from "../lib/utils";

// Real USF Coordinates
const USER_LOCATION: [number, number] = [28.0540, -82.4139]; // South of campus
const CAMPUS_CENTER: [number, number] = [28.0600, -82.4130];

export const BUILDINGS = [
  { id: "lib", name: "USF Library (LIB)", type: "academic", tags: ["study"], lat: 28.05948, lng: -82.41228, desc: "Main campus library and study spaces.", rooms: [
    { id: "lib-1", name: "Learning Commons", floor: "1st Floor", desc: "Open study area with computers" },
    { id: "lib-2", name: "Digital Media Commons", floor: "1st Floor", desc: "Multimedia editing and equipment checkout" },
    { id: "lib-3", name: "Special Collections", floor: "4th Floor", desc: "Rare books and archives" }
  ] },
  { id: "msc", name: "Marshall Student Center (MSC)", type: "service", tags: ["dining", "study"], lat: 28.06373, lng: -82.41349, desc: "Student union, dining, and event spaces.", rooms: [
    { id: "msc-1", name: "Bulls Media", floor: "4th Floor", desc: "Student run media" },
    { id: "msc-2", name: "Food Court", floor: "1st Floor", desc: "Various dining options" },
    { id: "msc-3", name: "Oval Theater", floor: "2nd Floor", desc: "Large event and lecture space" }
  ] },
  { id: "enb", name: "Engineering Building II (ENB)", type: "academic", tags: ["study"], lat: 28.05875, lng: -82.41503, desc: "College of Engineering classrooms and labs.", rooms: [
    { id: "enb-109", name: "ENB 109", floor: "1st Floor", desc: "Near the main north entrance" },
    { id: "enb-118", name: "ENB 118", floor: "1st Floor", desc: "Large lecture hall" },
    { id: "enb-205", name: "ENB 205", floor: "2nd Floor", desc: "Computer Lab" }
  ] },
  { id: "isa", name: "Interdisciplinary Sciences (ISA)", type: "academic", tags: ["study"], lat: 28.06145, lng: -82.41385, desc: "Advanced science labs and lecture halls.", rooms: [
    { id: "isa-1051", name: "ISA 1051", floor: "1st Floor", desc: "Science Lecture Hall" },
    { id: "isa-2020", name: "ISA 2020", floor: "2nd Floor", desc: "Chemistry Lab" }
  ] },
  { id: "svc", name: "Student Services Building (SVC)", type: "service", tags: [], lat: 28.06249, lng: -82.41255, desc: "Admissions, Financial Aid, and Registrar.", rooms: [
    { id: "svc-1", name: "Admissions Desk", floor: "1st Floor", desc: "Undergraduate admissions" },
    { id: "svc-2", name: "Financial Aid Office", floor: "1st Floor", desc: "Financial aid counselors" }
  ] },
  { id: "rec", name: "Campus Recreation Center (REC)", type: "service", tags: [], lat: 28.06048, lng: -82.40752, desc: "Fitness center, indoor track, and courts.", rooms: [
    { id: "rec-1", name: "Weight Room", floor: "1st Floor", desc: "Free weights and machines" },
    { id: "rec-2", name: "Cardio Deck", floor: "2nd Floor", desc: "Treadmills and ellipticals" },
    { id: "rec-3", name: "Basketball Courts", floor: "1st Floor", desc: "Indoor courts" }
  ] },
  { id: "sun", name: "Yuengling Center (SUN)", type: "service", tags: [], lat: 28.05924, lng: -82.40662, desc: "Arena for sports, concerts, and events.", rooms: [
    { id: "sun-1", name: "Main Arena", floor: "1st Floor", desc: "Basketball and volleyball court" },
    { id: "sun-2", name: "Ticket Office", floor: "Gate A", desc: "Box office" }
  ] },
  { id: "cpr", name: "Cooper Hall (CPR)", type: "academic", tags: ["study"], lat: 28.05961, lng: -82.41075, desc: "College of Arts and Sciences.", rooms: [
    { id: "cpr-103", name: "CPR 103", floor: "1st Floor", desc: "General purpose classroom" }
  ] },
  { id: "bsn", name: "Business Building (BSN)", type: "academic", tags: ["study"], lat: 28.05835, lng: -82.40978, desc: "Muma College of Business.", rooms: [
    { id: "bsn-1100", name: "Atrium", floor: "1st Floor", desc: "Main gathering space" }
  ] },
  { id: "edu", name: "Education Building (EDU)", type: "academic", tags: ["study"], lat: 28.06076, lng: -82.41072, desc: "College of Education.", rooms: [
    { id: "edu-162", name: "TECO Hall", floor: "1st Floor", desc: "Large presentation hall" }
  ] },
  { id: "fah", name: "Fine Arts Building (FAH)", type: "academic", tags: ["study"], lat: 28.06307, lng: -82.41659, desc: "College of The Arts.", rooms: [
    { id: "fah-101", name: "Art Gallery", floor: "1st Floor", desc: "Student and faculty exhibitions" }
  ] },
  { id: "shs", name: "Student Health Services (SHS)", type: "service", tags: [], lat: 28.06352, lng: -82.41198, desc: "Medical clinic and pharmacy.", rooms: [
    { id: "shs-pharm", name: "Pharmacy", floor: "1st Floor", desc: "Prescription pickup" }
  ] },
  { id: "rab", name: "Richard A. Beard Parking Garage (RAB)", type: "parking", tags: ["parking"], lat: 28.05854, lng: -82.41711, desc: "Multi-level parking facility for students and staff.", rooms: [] },
  { id: "cbp", name: "Collins Blvd Parking Garage (CBP)", type: "parking", tags: ["parking"], lat: 28.06151, lng: -82.41197, desc: "Visitor and permit parking near the library.", rooms: [] },
  { id: "chg", name: "Crescent Hill Parking Garage (CHG)", type: "parking", tags: ["parking"], lat: 28.06518, lng: -82.41210, desc: "Parking near the Marshall Student Center.", rooms: [] }
];

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

// Component to handle map centering
function MapUpdater({ center, zoom }: { center: [number, number], zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.5 });
  }, [center, zoom, map]);
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
  const [searchParams, setSearchParams] = useSearchParams();
  const destId = searchParams.get("dest");
  const q = searchParams.get("q");
  
  const [searchQuery, setSearchQuery] = useState(q || "");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<typeof BUILDINGS[0] | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isCardMinimized, setIsCardMinimized] = useState(false);
  
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
        setSearchParams({});
      }
    } else if (q) {
      setSearchQuery(q);
    }
  }, [destId, q, setSearchParams]);

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
          
          <MapUpdater center={mapCenter} zoom={mapZoom} />
          
          <MapClickHandler onClick={() => {
            if (selectedBuilding) {
              setIsCardMinimized(true);
            }
          }} />

          {/* User Location */}
          <Marker position={USER_LOCATION} icon={userIcon} />

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
                }
              }}
            />
          ))}

          {/* Navigation Route (Mock) */}
          {isNavigating && selectedBuilding && (
            <Polyline 
              positions={[USER_LOCATION, [selectedBuilding.lat, selectedBuilding.lng]]} 
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
                  onClick={(e) => { e.stopPropagation(); setSelectedBuilding(null); setSelectedRoom(null); setIsNavigating(false); }} 
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
                  onClick={() => { setSelectedBuilding(null); setSelectedRoom(null); setIsNavigating(false); }} 
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
                {isNavigating ? (
                  <div className="flex items-center justify-between bg-surface-container-low p-4 rounded-2xl border border-primary/20">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
                        <Navigation className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs font-label text-primary uppercase tracking-widest font-bold">En Route</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="font-headline font-bold text-lg text-on-surface">8 min</span>
                          <span className="text-sm text-on-surface-variant flex items-center gap-1"><Footprints className="w-3 h-3"/> 0.4 mi</span>
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => setIsNavigating(false)}
                      className="px-4 py-2 bg-error/10 text-error rounded-xl text-sm font-bold hover:bg-error/20 transition-colors"
                    >
                      End
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setIsNavigating(true)} 
                      className="flex-1 bg-primary text-on-primary py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:brightness-110 transition-all shadow-lg shadow-primary/20"
                    >
                      <Navigation className="w-5 h-5" /> Start Route
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


