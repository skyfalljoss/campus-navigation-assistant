import { useState } from "react";
import { Search, Mic, QrCode, Library, Building2, Wrench, Dumbbell, Bus, Footprints, ArrowRight, ArrowUpRight, Navigation, Map as MapIcon } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

export default function Dashboard() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e?: React.FormEvent) => {
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
          </div>
          <Link to="/map" className="text-on-surface font-bold flex items-center gap-2 hover:text-primary transition-colors">
            View all <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Link to="/map?dest=lib" className="bg-surface-container-lowest p-6 rounded-2xl flex flex-col relative overflow-hidden group hover:shadow-lg transition-all border border-outline-variant/30 h-48">
            <Library className="w-8 h-8 text-primary mb-auto relative z-10" />
            <div className="relative z-10 mt-auto">
              <p className="font-headline font-bold text-on-surface text-xl">Library</p>
              <p className="text-sm text-on-surface-variant mt-1">Main Campus</p>
              <p className="text-[10px] text-on-surface-variant uppercase font-bold mt-4 tracking-wider">4 Mins Away</p>
            </div>
            <Library className="absolute -right-4 top-4 w-32 h-32 text-surface-variant/30 group-hover:scale-110 transition-transform duration-500" />
          </Link>
          
          <Link to="/map?dest=msc" className="bg-surface-container-lowest p-6 rounded-2xl flex flex-col relative overflow-hidden group hover:shadow-lg transition-all border border-outline-variant/30 h-48">
            <Building2 className="w-8 h-8 text-primary mb-auto relative z-10" />
            <div className="relative z-10 mt-auto">
              <p className="font-headline font-bold text-on-surface text-xl">Marshall Center</p>
              <p className="text-sm text-on-surface-variant mt-1">Student Union</p>
              <p className="text-[10px] text-on-surface-variant uppercase font-bold mt-4 tracking-wider">8 Mins Away</p>
            </div>
            <Building2 className="absolute -right-4 top-4 w-32 h-32 text-surface-variant/30 group-hover:scale-110 transition-transform duration-500" />
          </Link>
          
          <Link to="/map?dest=enb" className="bg-surface-container-lowest p-6 rounded-2xl flex flex-col relative overflow-hidden group hover:shadow-lg transition-all border border-outline-variant/30 h-48">
            <Wrench className="w-8 h-8 text-primary mb-auto relative z-10" />
            <div className="relative z-10 mt-auto">
              <p className="font-headline font-bold text-on-surface text-xl">Engineering</p>
              <p className="text-sm text-on-surface-variant mt-1">Building II</p>
              <p className="text-[10px] text-on-surface-variant uppercase font-bold mt-4 tracking-wider">12 Mins Away</p>
            </div>
            <Wrench className="absolute -right-4 top-4 w-32 h-32 text-surface-variant/30 group-hover:scale-110 transition-transform duration-500" />
          </Link>
          
          <Link to="/map?dest=rec" className="bg-surface-container-lowest p-6 rounded-2xl flex flex-col relative overflow-hidden group hover:shadow-lg transition-all border border-outline-variant/30 h-48">
            <Dumbbell className="w-8 h-8 text-primary mb-auto relative z-10" />
            <div className="relative z-10 mt-auto">
              <p className="font-headline font-bold text-on-surface text-xl">REC Center</p>
              <p className="text-sm text-on-surface-variant mt-1">Wellness Hub</p>
              <p className="text-[10px] text-on-surface-variant uppercase font-bold mt-4 tracking-wider">15 Mins Away</p>
            </div>
            <Dumbbell className="absolute -right-4 top-4 w-32 h-32 text-surface-variant/30 group-hover:scale-110 transition-transform duration-500" />
          </Link>
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
            {/* Transit Pulse */}
            <div className="bg-surface-container p-6 md:p-8 rounded-3xl border border-outline-variant/20 flex flex-col md:flex-row items-start md:items-center gap-6">
              <div className="w-24 h-24 bg-surface-container-lowest rounded-2xl flex flex-col items-center justify-center shrink-0 shadow-sm">
                <Bus className="text-primary w-8 h-8 mb-2" />
                <span className="text-[10px] text-primary font-bold uppercase tracking-wider">Route A</span>
              </div>
              <div className="flex-1">
                <h3 className="font-headline font-bold text-primary text-xl mb-1">Bull Runner Route A</h3>
                <p className="text-sm text-on-surface-variant mb-4">Heading towards MSC Student Center</p>
                <div className="flex items-center gap-3">
                  <span className="bg-primary text-on-primary text-xs font-bold px-4 py-2 rounded-full">3 min away</span>
                  <span className="bg-surface-container-lowest text-on-surface-variant border border-outline-variant/50 text-xs font-bold px-4 py-2 rounded-full">On Time</span>
                </div>
              </div>
              <button className="w-12 h-12 bg-surface-container-lowest rounded-xl flex items-center justify-center shadow-sm hover:bg-surface-variant transition-colors shrink-0 self-end md:self-center">
                <Navigation className="w-5 h-5 text-primary" />
              </button>
            </div>
            
            {/* Nearest Transit Walking Time */}
            <div className="bg-surface-container p-6 md:p-8 rounded-3xl border border-outline-variant/20 flex flex-col md:flex-row items-start md:items-center gap-6">
              <div className="w-24 h-24 bg-surface-container-lowest rounded-2xl flex flex-col items-center justify-center shrink-0 shadow-sm">
                <Footprints className="text-secondary w-8 h-8 mb-2" />
                <span className="text-[10px] text-secondary font-bold uppercase tracking-wider">Walk</span>
              </div>
              <div className="flex-1">
                <h3 className="font-headline font-bold text-primary text-xl mb-1">Nearest Transit Hub</h3>
                <p className="text-sm text-on-surface-variant mb-4">East Fletcher Ave & N Palms Dr</p>
                <div className="flex items-center gap-3">
                  <span className="bg-secondary text-on-secondary text-xs font-bold px-4 py-2 rounded-full">5 min walk</span>
                  <span className="bg-surface-container-lowest text-on-surface-variant border border-outline-variant/50 text-xs font-bold px-4 py-2 rounded-full">Optimal Path</span>
                </div>
              </div>
              <Link to="/map?nav=transit" className="w-12 h-12 bg-surface-container-lowest rounded-xl flex items-center justify-center shadow-sm hover:bg-surface-variant transition-colors shrink-0 self-end md:self-center">
                <MapIcon className="w-5 h-5 text-primary" />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
