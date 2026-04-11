import { SignInButton, SignOutButton, useAuth, useClerk, useUser } from "@clerk/clerk-react";
import { User, Settings, LogOut, MapPin, Clock, Bookmark, Mail, ArrowRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { BUILDINGS } from "../data/buildings";
import { fetchRecentLocations, fetchSavedLocations, type RecentLocationRecord, type SavedLocationRecord } from "../lib/api";

function formatLastViewed(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function ProfilePage() {
  const { getToken, isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const { openUserProfile } = useClerk();
  const { isLoaded: isUserLoaded, user } = useUser();
  const [savedLocations, setSavedLocations] = useState<SavedLocationRecord[]>([]);
  const [recentLocations, setRecentLocations] = useState<RecentLocationRecord[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthLoaded) {
      return;
    }

    if (!isSignedIn) {
      setSavedLocations([]);
      setRecentLocations([]);
      setIsLoadingData(false);
      setError(null);
      return;
    }

    let isCancelled = false;

    async function loadAccountData() {
      setIsLoadingData(true);
      setError(null);

      try {
        const token = await getToken();
        if (!token) {
          throw new Error("Unable to load your profile data right now.");
        }

        const [saved, recent] = await Promise.all([
          fetchSavedLocations(token),
          fetchRecentLocations(token),
        ]);

        if (!isCancelled) {
          setSavedLocations(saved);
          setRecentLocations(recent);
        }
      } catch (loadError) {
        if (!isCancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load your profile data.");
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingData(false);
        }
      }
    }

    void loadAccountData();

    return () => {
      isCancelled = true;
    };
  }, [getToken, isAuthLoaded, isSignedIn]);

  const savedBuildings = useMemo(
    () =>
      savedLocations
        .map((location) => {
          const building = BUILDINGS.find((entry) => entry.id === location.buildingId);
          return building ? { location, building } : null;
        })
        .filter((entry): entry is { location: SavedLocationRecord; building: (typeof BUILDINGS)[number] } => Boolean(entry)),
    [savedLocations]
  );

  const recentBuildingViews = useMemo(
    () =>
      recentLocations
        .map((location) => {
          if (!location.buildingId) {
            return null;
          }

          const building = BUILDINGS.find((entry) => entry.id === location.buildingId);
          if (!building) {
            return null;
          }

          const room = location.roomId ? building.rooms.find((entry) => entry.id === location.roomId) ?? null : null;

          return { location, building, room };
        })
        .filter(
          (entry): entry is { location: RecentLocationRecord; building: (typeof BUILDINGS)[number]; room: (typeof BUILDINGS)[number]["rooms"][number] | null } => Boolean(entry)
        ),
    [recentLocations]
  );

  if (!isAuthLoaded || !isUserLoaded) {
    return (
      <div className="px-6 md:px-12 py-8 max-w-4xl mx-auto w-full">
        <div className="glass-panel p-12 rounded-3xl text-center text-on-surface-variant">Loading your profile...</div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="px-6 md:px-12 py-8 max-w-4xl mx-auto w-full">
        <div className="glass-panel p-12 rounded-3xl text-center flex flex-col items-center">
          <User className="w-14 h-14 text-primary mb-4" />
          <h1 className="font-headline text-3xl font-bold text-on-surface mb-2">Sign in to unlock your profile</h1>
          <p className="text-sm text-on-surface-variant max-w-md mb-6">
            Clerk keeps your account details in sync, and Neon stores your saved buildings and recent search history.
          </p>
          <SignInButton mode="modal">
            <button className="rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-on-primary shadow-[0_10px_24px_rgba(0,103,71,0.18)] transition-all hover:brightness-110 dark:shadow-[0_12px_28px_rgba(132,215,175,0.18)]">
              Sign In
            </button>
          </SignInButton>
        </div>
      </div>
    );
  }

  const displayName = user.fullName ?? user.username ?? user.primaryEmailAddress?.emailAddress ?? "Campus Navigator";
  const emailAddress = user.primaryEmailAddress?.emailAddress ?? "No primary email";

  return (
    <div className="px-6 md:px-12 py-8 max-w-4xl mx-auto w-full">
      <div className="glass-panel p-8 rounded-3xl mb-8 flex flex-col md:flex-row items-center md:items-start gap-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>

        <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-surface-container-high shrink-0 relative z-10 bg-surface-container">
          <img alt={displayName} className="w-full h-full object-cover" src={user.imageUrl} />
        </div>

        <div className="flex-1 text-center md:text-left relative z-10">
          <div className="inline-block bg-primary/10 text-primary px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest mb-3">
            Clerk Account
          </div>
          <h1 className="font-headline text-4xl font-bold text-on-surface mb-2">{displayName}</h1>
          <p className="text-on-surface-variant text-sm max-w-md mx-auto md:mx-0 mb-2">
            Signed in to keep your campus profile, saved buildings, and recent searches synced across sessions.
          </p>
          <p className="text-on-surface-variant text-sm max-w-md mx-auto md:mx-0 mb-6">{emailAddress}</p>

          <div className="flex flex-wrap justify-center md:justify-start gap-4">
            <button
              onClick={() => openUserProfile()}
              className="bg-surface-container hover:bg-surface-container-high text-on-surface px-6 py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center gap-2"
            >
              <Settings className="w-4 h-4" /> Manage Account
            </button>
            <SignOutButton>
              <button className="bg-error/10 hover:bg-error/20 text-error px-6 py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center gap-2">
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </SignOutButton>
          </div>
        </div>
      </div>

      {error && (
        <div className="glass-panel p-4 rounded-2xl border border-error/20 bg-error/5 mb-6 text-sm text-on-surface-variant">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="glass-panel p-6 rounded-2xl flex flex-col gap-3">
          <div className="w-10 h-10 bg-tertiary/10 rounded-lg flex items-center justify-center text-tertiary mb-2">
            <Bookmark className="w-5 h-5" />
          </div>
          <h3 className="font-headline font-bold text-lg text-on-surface">Saved Places</h3>
          <p className="text-3xl font-bold text-tertiary font-headline tracking-tighter">{savedBuildings.length}</p>
          <p className="text-xs text-on-surface-variant">Buildings saved to your Clerk account.</p>
        </div>

        <div className="glass-panel p-6 rounded-2xl flex flex-col gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary mb-2">
            <Clock className="w-5 h-5" />
          </div>
          <h3 className="font-headline font-bold text-lg text-on-surface">Recent Searches</h3>
          <p className="text-3xl font-bold text-primary font-headline tracking-tighter">{recentBuildingViews.length}</p>
          <p className="text-xs text-on-surface-variant">Latest destinations you opened from search.</p>
        </div>

        <div className="glass-panel p-6 rounded-2xl flex flex-col gap-3">
          <div className="w-10 h-10 bg-secondary/10 rounded-lg flex items-center justify-center text-secondary mb-2">
            <Mail className="w-5 h-5" />
          </div>
          <h3 className="font-headline font-bold text-lg text-on-surface">Primary Email</h3>
          <p className="text-sm font-bold text-on-surface break-all">{emailAddress}</p>
          <p className="text-xs text-on-surface-variant">This comes directly from your Clerk profile.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="glass-panel p-6 rounded-2xl">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="font-headline text-2xl font-bold text-on-surface">Recent Locations</h2>
              <p className="text-sm text-on-surface-variant">Stored from your latest search selections.</p>
            </div>
            <Clock className="w-5 h-5 text-primary" />
          </div>

          {isLoadingData ? (
            <p className="text-sm text-on-surface-variant">Loading recent activity...</p>
          ) : recentBuildingViews.length === 0 ? (
            <p className="text-sm text-on-surface-variant">Search for a building or room on the map to start building your recent history.</p>
          ) : (
            <div className="space-y-3">
              {recentBuildingViews.map(({ location, building, room }) => (
                <Link
                  key={location.id}
                  to={room ? `/map?dest=${building.id}&room=${room.id}` : `/map?dest=${building.id}`}
                  className="flex items-start justify-between gap-4 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-4 hover:border-primary/30 hover:bg-primary/5 transition-colors"
                >
                  <div>
                    <p className="font-bold text-on-surface">{room ? room.name : building.name}</p>
                    <p className="text-sm text-on-surface-variant">{room ? `${building.name} • ${room.floor}` : building.desc}</p>
                    <p className="text-xs text-on-surface-variant mt-2">
                      {location.query ? `Search: ${location.query} • ` : ""}
                      Viewed {formatLastViewed(location.updatedAt)}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-primary shrink-0 mt-1" />
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="glass-panel p-6 rounded-2xl">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="font-headline text-2xl font-bold text-on-surface">Saved Locations</h2>
              <p className="text-sm text-on-surface-variant">Your persistent bookmarks from Neon.</p>
            </div>
            <MapPin className="w-5 h-5 text-secondary" />
          </div>

          {isLoadingData ? (
            <p className="text-sm text-on-surface-variant">Loading saved places...</p>
          ) : savedBuildings.length === 0 ? (
            <p className="text-sm text-on-surface-variant">Save a location from the map and it will appear here and on the saved page.</p>
          ) : (
            <div className="space-y-3">
              {savedBuildings.map(({ location, building }) => (
                <Link
                  key={location.id}
                  to={`/map?dest=${building.id}`}
                  className="flex items-start justify-between gap-4 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-4 hover:border-primary/30 hover:bg-primary/5 transition-colors"
                >
                  <div>
                    <p className="font-bold text-on-surface">{building.name}</p>
                    <p className="text-sm text-on-surface-variant">{building.desc}</p>
                    <p className="text-xs text-on-surface-variant mt-2">Saved {formatLastViewed(location.createdAt)}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-primary shrink-0 mt-1" />
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
