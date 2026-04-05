import { useEffect, useState, type FormEvent } from "react";
import { Search, Library, Building2, Wrench, Dumbbell, Bus, Footprints, ArrowRight, Navigation, Map as MapIcon, type LucideIcon } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { BUILDINGS } from "../data/buildings";
import { buildRoute, CAMPUS_CENTER, formatEta, getWalkabilityLabel, readStoredUserLocation, writeStoredUserLocation, type Coordinates } from "../lib/navigation";

interface DestinationCard {
  destinationId: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  accentClassName: string;
}

const QUICK_DESTINATIONS: DestinationCard[] = [
  { destinationId: "lib", title: "Library", subtitle: "Main Campus", icon: Library, accentClassName: "text-primary" },
  { destinationId: "msc", title: "Marshall Center", subtitle: "Student Union", icon: Building2, accentClassName: "text-primary" },
  { destinationId: "enb", title: "Engineering", subtitle: "Building II", icon: Wrench, accentClassName: "text-primary" },
  { destinationId: "rec", title: "REC Center", subtitle: "Wellness Hub", icon: Dumbbell, accentClassName: "text-primary" },
];

const CURRENT_ACTIVITY_DESTINATIONS = [
  {
    destinationId: "msc",
    title: "Marshall Student Center",
    subtitle: "Fastest walk to the Bull Runner drop-off area",
    icon: Bus,
    badgeClassName: "bg-primary text-on-primary",
    actionIcon: Navigation,
    actionTo: "/map?dest=msc&navigate=1",
  },
  {
    destinationId: "fletcher-hub",
    title: "East Fletcher Transit Hub",
    subtitle: "Open the map and route to the nearby pickup point",
    icon: Footprints,
    badgeClassName: "bg-secondary text-on-secondary",
    actionIcon: MapIcon,
    actionTo: "/map?dest=fletcher-hub&navigate=1",
  },
];

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

export default function Dashboard() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
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

  return (
    <div className="max-w-7xl mx-auto w-full">
      {/* Abstract Background */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] opacity-[0.15] dark:opacity-10 bg-[radial-gradient(circle_at_center,_var(--color-primary),_transparent,_transparent)]"></div>
        {/* Decorative Globe */}
        <div className="absolute -right-20 top-20 w-[600px] h-[600px] opacity-30 dark:opacity-20 hidden xl:block">
          <div className="relative w-full h-full rounded-full overflow-hidden border border-primary/20 animate-[spin_60s_linear_infinite]">
            <div className="absolute inset-0 bg-primary/40 mix-blend-color z-10"></div>
            <img 
              alt="Globe" 
              className="w-full h-full object-cover scale-110 grayscale brightness-50 contrast-125" 
              src="https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=800&q=80" 
            />
          </div>
        </div>
      </div>

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
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {QUICK_DESTINATIONS.map((destination) => {
            const route = getEtaForDestination(locationState.currentLocation, destination.destinationId);

            return (
              <Link
                key={destination.destinationId}
                to={`/map?dest=${destination.destinationId}&navigate=1`}
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
                <p className="text-on-surface font-headline text-2xl font-bold tracking-tighter">250+</p>
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
          <h2 className="font-headline text-2xl font-bold text-primary tracking-tight mb-8">Current Activity</h2>
          <div className="flex flex-col gap-6">
            {CURRENT_ACTIVITY_DESTINATIONS.map((activity) => {
              const route = getEtaForDestination(locationState.currentLocation, activity.destinationId);
              const AccentIcon = activity.icon;
              const ActionIcon = activity.actionIcon;
              const iconAccent = activity.destinationId === "fletcher-hub" ? "text-secondary" : "text-primary";
              const labelAccent = activity.destinationId === "fletcher-hub" ? "text-secondary" : "text-primary";

              return (
                <div
                  key={activity.destinationId}
                  className="bg-surface-container p-6 md:p-8 rounded-3xl border border-outline-variant/20 flex flex-col md:flex-row items-start md:items-center gap-6"
                >
                  <div className="w-24 h-24 bg-surface-container-lowest rounded-2xl flex flex-col items-center justify-center shrink-0 shadow-sm">
                    <AccentIcon className={`${iconAccent} w-8 h-8 mb-2`} />
                    <span className={`text-[10px] ${labelAccent} font-bold uppercase tracking-wider`}>
                      {activity.destinationId === "fletcher-hub" ? "Transit" : "Route"}
                    </span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-headline font-bold text-primary text-xl mb-1">{activity.title}</h3>
                    <p className="text-sm text-on-surface-variant mb-4">{activity.subtitle}</p>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className={`${activity.badgeClassName} text-xs font-bold px-4 py-2 rounded-full`}>
                        {route.isWalkable ? `${formatEta(route.etaMinutes)} away` : "Unwalkable"}
                      </span>
                      <span className="bg-surface-container-lowest text-on-surface-variant border border-outline-variant/50 text-xs font-bold px-4 py-2 rounded-full">
                        {getWalkabilityLabel(route.etaMinutes)}
                      </span>
                    </div>
                  </div>
                  <Link
                    to={activity.actionTo}
                    className="w-12 h-12 bg-surface-container-lowest rounded-xl flex items-center justify-center shadow-sm hover:bg-surface-variant transition-colors shrink-0 self-end md:self-center"
                  >
                    <ActionIcon className="w-5 h-5 text-primary" />
                  </Link>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
