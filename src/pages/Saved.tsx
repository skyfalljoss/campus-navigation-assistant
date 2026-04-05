import { Bookmark, MapPin, ArrowRight, Library, Building2, Dumbbell } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { BUILDINGS } from "../data/buildings";

export default function SavedPage() {
  const [savedLocations, setSavedLocations] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("usf_saved_locations");
    if (saved) {
      setSavedLocations(JSON.parse(saved));
    }
  }, []);

  const savedBuildings = BUILDINGS.filter(b => savedLocations.includes(b.id));

  return (
    <div className="px-6 md:px-12 py-8 max-w-4xl mx-auto w-full">
      <div className="flex items-center gap-4 mb-10">
        <div className="w-12 h-12 bg-secondary/10 rounded-xl flex items-center justify-center text-secondary">
          <Bookmark className="w-6 h-6 fill-secondary/20" />
        </div>
        <div>
          <h1 className="font-headline text-3xl font-bold text-on-surface">Saved Locations</h1>
          <p className="text-on-surface-variant text-sm mt-1">Your bookmarked campus destinations.</p>
        </div>
      </div>

      {savedBuildings.length === 0 ? (
        <div className="glass-panel p-12 rounded-2xl text-center flex flex-col items-center">
          <Bookmark className="w-12 h-12 text-outline-variant mb-4" />
          <h2 className="font-headline text-xl font-bold text-on-surface mb-2">No saved locations</h2>
          <p className="text-on-surface-variant text-sm mb-6 max-w-md">
            You haven't bookmarked any buildings yet. Head over to the map to search and save locations for quick access.
          </p>
          <Link to="/map" className="bg-primary text-on-primary px-6 py-3 rounded-xl font-bold text-sm hover:brightness-110 transition-all">
            Explore Map
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {savedBuildings.map(b => (
            <Link 
              key={b.id}
              to={`/map?dest=${b.id}`}
              className="glass-panel p-6 rounded-2xl flex flex-col gap-4 hover:border-primary/40 transition-all hover:bg-primary/5 group"
            >
              <div className="flex justify-between items-start">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                  {b.type === 'academic' ? <Building2 className="w-5 h-5" /> : 
                   b.id === 'lib' ? <Library className="w-5 h-5" /> : 
                   b.id === 'rec' ? <Dumbbell className="w-5 h-5" /> : 
                   <MapPin className="w-5 h-5" />}
                </div>
                <div className="bg-surface-container px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                  {b.type}
                </div>
              </div>
              
              <div>
                <h3 className="font-headline font-bold text-lg text-on-surface">{b.name}</h3>
                <p className="text-sm text-on-surface-variant mt-1 line-clamp-2">{b.desc}</p>
              </div>

              <div className="mt-auto pt-4 border-t border-outline-variant/10 flex items-center justify-between">
                <span className="text-xs text-on-surface-variant font-medium">
                  {b.rooms.length} Directory items
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
