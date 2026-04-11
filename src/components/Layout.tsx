import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/clerk-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { 
  Compass, Map as MapIcon, Calendar, GraduationCap, Library, Bus,
  Settings, HelpCircle, Bell, Search, Bookmark, User, ChevronLeft, ChevronRight
} from "lucide-react";
import { cn } from "../lib/utils";

export function Sidebar({ isOpen, toggle }: { isOpen: boolean, toggle: () => void }) {
  const location = useLocation();

  const navItems = [
    { icon: Compass, label: "Dashboard", path: "/" },
    { icon: MapIcon, label: "Campus Map", path: "/map" },
    { icon: Bus, label: "Shuttle", path: "/shuttle" },
    { icon: Bookmark, label: "Saved", path: "/saved" },
    { icon: User, label: "Profile", path: "/profile" },
  ];

  return (
    <aside className={cn(
      "fixed left-0 top-0 h-full z-[130] bg-surface-container-lowest flex-col py-8 shadow-[4px_0_24px_rgba(0,0,0,0.02)] transition-all duration-300 hidden md:flex",
      isOpen ? "w-72" : "w-24"
    )}>
      <button 
        onClick={toggle}
        className="absolute -right-4 top-10 z-[140] flex items-center justify-center rounded-full bg-primary p-1.5 text-on-primary shadow-lg transition-transform hover:scale-110"
      >
        {isOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>

      <div className={cn("mb-12 flex flex-col gap-1 transition-all duration-300", isOpen ? "px-8" : "px-0 items-center")}>
        {isOpen ? (
          <div className="animate-in fade-in duration-300 whitespace-nowrap overflow-hidden">
            <h1 className="text-primary font-bold font-headline text-xl leading-tight">USF Assistant</h1>
          </div>
        ) : (
          <div className="w-10 h-10 shrink-0 bg-primary-container rounded-lg flex items-center justify-center">
            <GraduationCap className="text-primary w-6 h-6" />
          </div>
        )}
      </div>
      
      <nav className="flex-1 px-4 space-y-2 overflow-hidden flex flex-col">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              title={!isOpen ? item.label : undefined}
              className={cn(
                "flex items-center gap-4 py-3 transition-all rounded-lg group duration-300",
                isOpen ? "px-4" : "px-0 justify-center w-12 h-12 mx-auto",
                isActive 
                  ? "text-on-primary-container bg-primary-container font-bold" 
                  : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
              )}
            >
              <item.icon className={cn("w-5 h-5 shrink-0", isActive && "text-primary")} />
              {isOpen && <span className="font-body tracking-wide whitespace-nowrap">{item.label}</span>}
            </Link>
          );
        })}
      </nav>
      
      <div className="px-6 mt-auto pt-8 space-y-4 flex flex-col">
        <Link to="/settings" title={!isOpen ? "Settings" : undefined} className={cn("flex items-center gap-4 py-2 text-on-surface-variant hover:text-on-surface transition-all", isOpen ? "px-2" : "justify-center")}>
          <Settings className="w-5 h-5 shrink-0" />
          {isOpen && <span className="font-body tracking-wide whitespace-nowrap">Settings</span>}
        </Link>
      </div>
    </aside>
  );
}

export function TopBar({ isSidebarOpen }: { isSidebarOpen: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isMapPage = location.pathname === "/map";
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const handleSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedQuery = searchQuery.trim();

    if (trimmedQuery) {
      navigate(`/map?q=${encodeURIComponent(trimmedQuery)}`);
      setSearchQuery("");
    }
  };

  const focusSearchInput = () => {
    searchInputRef.current?.focus();
  };

  const openMapSearch = () => {
    if (location.pathname !== "/map") {
      navigate("/map");
      return;
    }

    focusSearchInput();
  };

  const openNotifications = () => {
    navigate("/settings#notifications");
  };

  const openSettings = () => {
    navigate("/settings");
  };

  return (
    <header className={cn(
      "relative ml-auto flex justify-between md:justify-end items-center px-4 py-3 md:px-6 md:py-4 bg-surface/80 backdrop-blur-xl transition-all duration-300 pointer-events-auto",
      isSidebarOpen ? "w-full md:w-[calc(100%-18rem)]" : "w-full md:w-[calc(100%-6rem)]"
    )}>
      <div className="text-lg font-bold tracking-tighter text-primary font-headline md:hidden">USF Assistant</div>
      
      <div className="flex items-center gap-1.5 md:gap-3 pointer-events-auto">
        <form
          onSubmit={handleSearch}
          onClick={focusSearchInput}
          className={cn(
          "items-center rounded-xl border border-transparent bg-surface-container-high px-4 py-2 transition-colors hover:border-outline-variant/40 focus-within:border-primary/30",
          isMapPage ? "hidden" : "hidden md:flex"
        )}>
          <button
            type="submit"
            className="mr-2 flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container"
            aria-label="Search campus"
          >
            <Search className="w-4 h-4" />
          </button>
          <input 
            ref={searchInputRef}
            className="bg-transparent border-none text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:ring-0 focus:outline-none w-48 font-body" 
            placeholder="Search campus..." 
            type="text"
            value={searchQuery}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
          />
        </form>
        <button
          type="button"
          onClick={openMapSearch}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full text-on-surface transition-colors hover:bg-surface-container hover:text-primary md:h-10 md:w-10",
            isMapPage ? "hidden" : "md:hidden"
          )}
          aria-label="Open map search"
        >
          <Search className="h-4 w-4 md:h-5 md:w-5" />
        </button>
        <button
          type="button"
          onClick={openNotifications}
          className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface transition-colors hover:bg-surface-container hover:text-primary md:h-10 md:w-10"
          aria-label="Open notification settings"
        >
          <Bell className="h-4 w-4 md:h-5 md:w-5" />
        </button>
        <button
          type="button"
          onClick={openSettings}
          className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface transition-colors hover:bg-surface-container hover:text-primary md:h-10 md:w-10"
          aria-label="Open settings"
        >
          <Settings className="h-4 w-4 md:h-5 md:w-5" />
        </button>
        <SignedOut>
          <SignInButton mode="modal">
            <button className="ml-1.5 rounded-xl border border-outline-variant/50 bg-surface-container-low/85 px-3 py-1.5 text-xs font-bold text-on-surface shadow-[0_8px_20px_rgba(10,20,16,0.06)] backdrop-blur-sm transition-colors hover:bg-surface-container md:ml-2 md:px-4 md:py-2 md:text-sm dark:border-primary/10 dark:bg-surface-container-low/90 dark:shadow-none">
                Sign In
              </button>
          </SignInButton>
        </SignedOut>
        <SignedIn>
          <div className="ml-1.5 rounded-full border border-outline-variant/45 bg-surface-container-low/80 p-1 shadow-[0_8px_18px_rgba(10,20,16,0.06)] backdrop-blur-sm md:ml-2 dark:border-primary/10 dark:bg-surface-container-low/88 dark:shadow-none">
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: "h-8 w-8 md:h-9 md:w-9 ring-0 shadow-none",
                  userButtonTrigger: "rounded-full focus:shadow-none",
                },
              }}
            />
          </div>
        </SignedIn>
      </div>
    </header>
  );
}

export function BottomNav() {
  const location = useLocation();
  
  const navItems = [
    { icon: Compass, label: "Explore", path: "/" },
    { icon: Search, label: "Search", path: "/map" },
    { icon: Bus, label: "Shuttle", path: "/shuttle" },
    { icon: Bookmark, label: "Saved", path: "/saved" },
    { icon: User, label: "Profile", path: "/profile" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 z-50 flex w-full items-center justify-around rounded-t-[1.4rem] border-t border-outline-variant/15 bg-surface/88 px-2 pb-[max(0.875rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl shadow-[0_-10px_30px_rgba(12,16,15,0.08)] md:hidden">
      {navItems.map((item) => {
        const isActive = location.pathname === item.path || (item.path === '/map' && location.pathname === '/map');
        return (
          <Link 
            key={item.path}
            to={item.path}
            className={cn(
              "group flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1.5 py-1 transition-colors",
              isActive ? "text-primary" : "text-on-surface/50"
            )}
          >
            <item.icon className={cn("h-4 w-4", isActive && "fill-primary/20")} />
            <span className="font-label text-[9px] font-bold uppercase tracking-[0.14em] leading-none">
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const location = useLocation();
  const isMapPage = location.pathname === "/map";
  const [isMapChromeVisible, setIsMapChromeVisible] = useState(true);

  useEffect(() => {
    if (!isMapPage) {
      setIsMapChromeVisible(true);
      return;
    }

    const handleMapChromeVisibility = (event: Event) => {
      const customEvent = event as CustomEvent<{ visible?: boolean }>;
      setIsMapChromeVisible(customEvent.detail?.visible ?? true);
    };

    window.addEventListener("map-chrome-visibility", handleMapChromeVisibility as EventListener);
    return () => {
      window.removeEventListener("map-chrome-visibility", handleMapChromeVisibility as EventListener);
    };
  }, [isMapPage]);

  return (
    <div className="relative isolate min-h-screen w-full bg-surface text-on-surface">
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] opacity-[0.15] dark:opacity-10 bg-[radial-gradient(circle_at_center,_var(--color-primary),_transparent,_transparent)]"></div>
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
      <div className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-[120] transition-all duration-300",
        isMapPage && !isMapChromeVisible ? "pointer-events-none opacity-0 -translate-y-4" : "opacity-100 translate-y-0"
      )}>
        <TopBar isSidebarOpen={isSidebarOpen} />
      </div>
      <Sidebar isOpen={isSidebarOpen} toggle={() => setIsSidebarOpen(!isSidebarOpen)} />
      <main className={cn(
        "relative z-10 min-h-screen w-full flex flex-col transition-all duration-300",
        isMapPage
          ? isMapChromeVisible
            ? cn("pt-24 pb-24 md:pb-10", isSidebarOpen ? "md:pl-72" : "md:pl-24")
            : cn("pt-0 pb-0", isSidebarOpen ? "md:pl-72" : "md:pl-24")
          : cn("pt-24 pb-24 md:pb-10", isSidebarOpen ? "md:pl-72" : "md:pl-24")
      )}>
        {children}
      </main>
      <div className="transition-all duration-300 md:hidden">
        <BottomNav />
      </div>
    </div>
  );
}
