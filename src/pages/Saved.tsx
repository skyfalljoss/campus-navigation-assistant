import { SignInButton, useAuth } from "@clerk/clerk-react";
import { Bookmark, MapPin, ArrowRight, Library, Building2, Dumbbell } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { BUILDINGS } from "../data/buildings";
import { fetchSavedLocations } from "../lib/api";

export default function SavedPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [savedLocationIds, setSavedLocationIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    if (!isSignedIn) {
      setSavedLocationIds([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    let isCancelled = false;

    async function loadSavedLocations() {
      setIsLoading(true);
      setError(null);

      try {
        const token = await getToken();
        if (!token) {
          throw new Error("Unable to load your saved locations right now.");
        }

        const savedLocations = await fetchSavedLocations(token);
        if (!isCancelled) {
          setSavedLocationIds(savedLocations.map((location) => location.buildingId));
        }
      } catch (loadError) {
        if (!isCancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load your saved locations.");
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadSavedLocations();

    return () => {
      isCancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn]);

  const savedBuildings = savedLocationIds
    .map((buildingId) => BUILDINGS.find((building) => building.id === buildingId))
    .filter((building): building is (typeof BUILDINGS)[number] => Boolean(building));

  return (
    <div className="px-6 md:px-12 py-8 max-w-4xl mx-auto w-full">
      <div className="flex items-center gap-4 mb-10">
        <div className="w-12 h-12 bg-secondary/10 rounded-xl flex items-center justify-center text-secondary">
          <Bookmark className="w-6 h-6 fill-secondary/20" />
        </div>
        <div>
          <h1 className="font-headline text-3xl font-bold text-on-surface">Saved Locations</h1>
          <p className="text-on-surface-variant text-sm mt-1">Your Clerk account bookmarks, stored in Neon.</p>
        </div>
      </div>

      {!isSignedIn ? (
        <div className="glass-panel p-12 rounded-2xl text-center flex flex-col items-center">
          <Bookmark className="w-12 h-12 text-outline-variant mb-4" />
          <h2 className="font-headline text-xl font-bold text-on-surface mb-2">Sign in to view saved places</h2>
          <p className="text-on-surface-variant text-sm mb-6 max-w-md">
            You can explore the map as a guest, but bookmarks stay attached to your account once you sign in.
          </p>
          <SignInButton mode="modal">
            <button className="bg-primary text-on-primary px-6 py-3 rounded-xl font-bold text-sm hover:brightness-110 transition-all">
              Sign In
            </button>
          </SignInButton>
        </div>
      ) : isLoading ? (
        <div className="glass-panel p-12 rounded-2xl text-center text-on-surface-variant">
          Loading your saved locations...
        </div>
      ) : error ? (
        <div className="glass-panel p-8 rounded-2xl border border-error/20 bg-error/5 text-center">
          <h2 className="font-headline text-xl font-bold text-on-surface mb-2">Could not load saved locations</h2>
          <p className="text-sm text-on-surface-variant">{error}</p>
        </div>
      ) : savedBuildings.length === 0 ? (
        <div className="glass-panel p-12 rounded-2xl text-center flex flex-col items-center">
          <Bookmark className="w-12 h-12 text-outline-variant mb-4" />
          <h2 className="font-headline text-xl font-bold text-on-surface mb-2">No saved locations yet</h2>
          <p className="text-on-surface-variant text-sm mb-6 max-w-md">
            Head over to the map, open a building, and save it to your account for quick access later.
          </p>
          <Link to="/map" className="bg-primary text-on-primary px-6 py-3 rounded-xl font-bold text-sm hover:brightness-110 transition-all">
            Explore Map
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {savedBuildings.map((building) => (
            <Link
              key={building.id}
              to={`/map?dest=${building.id}`}
              className="glass-panel p-6 rounded-2xl flex flex-col gap-4 hover:border-primary/40 transition-all hover:bg-primary/5 group"
            >
              <div className="flex justify-between items-start">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                  {building.type === "academic" ? <Building2 className="w-5 h-5" /> :
                  building.id === "lib" ? <Library className="w-5 h-5" /> :
                  building.id === "rec" ? <Dumbbell className="w-5 h-5" /> :
                  <MapPin className="w-5 h-5" />}
                </div>
                <div className="bg-surface-container px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                  {building.type}
                </div>
              </div>

              <div>
                <h3 className="font-headline font-bold text-lg text-on-surface">{building.name}</h3>
                <p className="text-sm text-on-surface-variant mt-1 line-clamp-2">{building.desc}</p>
              </div>

              <div className="mt-auto pt-4 border-t border-outline-variant/10 flex items-center justify-between">
                <span className="text-xs text-on-surface-variant font-medium">
                  {building.rooms.length} Directory items
                </span>
                <span className="text-primary text-xs font-bold uppercase tracking-widest flex items-center gap-1 group-hover:gap-2 transition-all">
                  Navigate <ArrowRight className="w-4 h-4" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
