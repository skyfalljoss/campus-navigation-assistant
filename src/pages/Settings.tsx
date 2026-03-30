import { Moon, Sun, Monitor, Bell, Shield, Smartphone } from "lucide-react";
import { useState, useEffect } from "react";

export default function SettingsPage() {
  const [theme, setTheme] = useState<"dark" | "light" | "system">(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    }
    return 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else if (theme === "light") {
      root.classList.remove("dark");
    } else {
      // System preference
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    }
  }, [theme]);

  return (
    <div className="max-w-4xl mx-auto w-full px-6 md:px-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-10">
        <h1 className="font-headline text-4xl font-bold text-on-surface tracking-tight mb-2">Settings</h1>
        <p className="text-on-surface-variant">Manage your app preferences and account settings.</p>
      </div>

      <div className="space-y-12">
        {/* Appearance Section */}
        <section>
          <h2 className="font-headline text-xl font-bold text-on-surface mb-6 flex items-center gap-2">
            <Monitor className="w-5 h-5 text-primary" /> Appearance
          </h2>
          <div className="glass-panel rounded-2xl p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h3 className="font-bold text-on-surface">Theme Mode</h3>
                <p className="text-sm text-on-surface-variant mt-1">
                  Choose how the app looks. Light mode is coming soon!
                </p>
              </div>
              <div className="flex bg-surface-container-high rounded-xl p-1 shrink-0">
                <button
                  onClick={() => setTheme("light")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    theme === "light" 
                      ? "bg-surface shadow-md text-on-surface" 
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  <Sun className="w-4 h-4" /> Light
                </button>
                <button
                  onClick={() => setTheme("dark")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    theme === "dark" 
                      ? "bg-surface shadow-md text-on-surface" 
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  <Moon className="w-4 h-4" /> Dark
                </button>
                <button
                  onClick={() => setTheme("system")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    theme === "system" 
                      ? "bg-surface shadow-md text-on-surface" 
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  <Monitor className="w-4 h-4" /> System
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Notifications Section */}
        <section>
          <h2 className="font-headline text-xl font-bold text-on-surface mb-6 flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" /> Notifications
          </h2>
          <div className="glass-panel rounded-2xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-on-surface">Push Notifications</h3>
                <p className="text-sm text-on-surface-variant mt-1">Receive alerts for transit and campus events.</p>
              </div>
              <div className="w-12 h-6 bg-primary rounded-full relative cursor-pointer">
                <div className="absolute right-1 top-1 w-4 h-4 bg-on-primary rounded-full"></div>
              </div>
            </div>
            <div className="h-[1px] w-full bg-outline-variant/20"></div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-on-surface">Email Updates</h3>
                <p className="text-sm text-on-surface-variant mt-1">Weekly newsletter and important announcements.</p>
              </div>
              <div className="w-12 h-6 bg-surface-container-highest rounded-full relative cursor-pointer">
                <div className="absolute left-1 top-1 w-4 h-4 bg-on-surface-variant rounded-full"></div>
              </div>
            </div>
          </div>
        </section>

        {/* Privacy Section */}
        <section>
          <h2 className="font-headline text-xl font-bold text-on-surface mb-6 flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" /> Privacy & Security
          </h2>
          <div className="glass-panel rounded-2xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-on-surface">Location Services</h3>
                <p className="text-sm text-on-surface-variant mt-1">Allow app to use your location for navigation.</p>
              </div>
              <div className="w-12 h-6 bg-primary rounded-full relative cursor-pointer">
                <div className="absolute right-1 top-1 w-4 h-4 bg-on-primary rounded-full"></div>
              </div>
            </div>
            <div className="h-[1px] w-full bg-outline-variant/20"></div>
            <button className="text-primary font-bold text-sm hover:underline">
              Manage Account Data
            </button>
          </div>
        </section>
        
        {/* App Info */}
        <section className="text-center pt-8 pb-12">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 rounded-xl mb-4">
            <Smartphone className="w-6 h-6 text-primary" />
          </div>
          <p className="font-headline font-bold text-on-surface">USF Assistant</p>
          <p className="text-sm text-on-surface-variant mt-1">Version 1.0.0</p>
        </section>
      </div>
    </div>
  );
}
