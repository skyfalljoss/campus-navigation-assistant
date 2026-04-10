import { useClerk } from "@clerk/clerk-react";
import { Bell, Monitor, Moon, Shield, Smartphone, Sun } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  EMAIL_UPDATES_STORAGE_KEY,
  LOCATION_SERVICES_STORAGE_KEY,
  PUSH_UPDATES_STORAGE_KEY,
  THEME_STORAGE_KEY,
} from "../lib/preferences";

function Toggle({
  checked,
  onToggle,
  disabled = false,
}: {
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onToggle}
      disabled={disabled}
      className={`relative h-6 w-12 rounded-full transition-colors ${checked ? "bg-primary" : "bg-surface-container-highest"} ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
    >
      <span
        className={`absolute top-1 h-4 w-4 rounded-full transition-all ${checked ? "right-1 bg-on-primary" : "left-1 bg-on-surface-variant"}`}
      />
    </button>
  );
}

export default function SettingsPage() {
  const location = useLocation();
  const { openUserProfile } = useClerk();
  const [theme, setTheme] = useState<"dark" | "light" | "system">(() => {
    if (typeof window !== "undefined") {
      const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (storedTheme === "dark" || storedTheme === "light" || storedTheme === "system") {
        return storedTheme;
      }

      return "system";
    }
    return "system";
  });
  const [pushPermission, setPushPermission] = useState<NotificationPermission | "unsupported">(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return "unsupported";
    }

    return Notification.permission;
  });
  const [isUpdatingPush, setIsUpdatingPush] = useState(false);
  const [pushMessage, setPushMessage] = useState<string | null>(null);
  const [pushUpdatesEnabled, setPushUpdatesEnabled] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.localStorage.getItem(PUSH_UPDATES_STORAGE_KEY) === "true";
  });
  const [emailUpdatesEnabled, setEmailUpdatesEnabled] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.localStorage.getItem(EMAIL_UPDATES_STORAGE_KEY) !== "false";
  });
  const [locationServicesEnabled, setLocationServicesEnabled] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }

    return window.localStorage.getItem(LOCATION_SERVICES_STORAGE_KEY) !== "false";
  });
  const [locationPermission, setLocationPermission] = useState<PermissionState | "unsupported">("unsupported");
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);

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

    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(EMAIL_UPDATES_STORAGE_KEY, String(emailUpdatesEnabled));
  }, [emailUpdatesEnabled]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(PUSH_UPDATES_STORAGE_KEY, String(pushUpdatesEnabled));
  }, [pushUpdatesEnabled]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(LOCATION_SERVICES_STORAGE_KEY, String(locationServicesEnabled));
  }, [locationServicesEnabled]);

  useEffect(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setLocationPermission("unsupported");
      return;
    }

    if (!("permissions" in navigator)) {
      setLocationPermission("prompt");
      return;
    }

    let isCancelled = false;

    void navigator.permissions
      .query({ name: "geolocation" })
      .then((status) => {
        if (isCancelled) {
          return;
        }

        setLocationPermission(status.state);
        status.onchange = () => {
          setLocationPermission(status.state);
        };
      })
      .catch(() => {
        if (!isCancelled) {
          setLocationPermission("prompt");
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  const pushNotificationsEnabled = pushPermission === "granted" && pushUpdatesEnabled;

  useEffect(() => {
    if (!location.hash) {
      return;
    }

    const targetId = location.hash.slice(1);
    const targetElement = document.getElementById(targetId);
    if (!targetElement) {
      return;
    }

    targetElement.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [location.hash]);
  const locationServicesActive = locationPermission === "granted" && locationServicesEnabled;

  const handlePushToggle = async () => {
    if (pushPermission === "unsupported") {
      setPushMessage("This browser does not support push notifications.");
      return;
    }

    if (pushUpdatesEnabled && pushPermission === "granted") {
      setPushUpdatesEnabled(false);
      setPushMessage("Push notifications turned off in the app. Browser permission stays granted, but the app will treat notifications as disabled.");
      return;
    }

    if (pushPermission === "granted") {
      setPushUpdatesEnabled(true);
      setPushMessage("Push notifications are enabled for this browser and for the app.");
      return;
    }

    setIsUpdatingPush(true);
    setPushMessage(null);

    try {
      const permission = await Notification.requestPermission();
      setPushPermission(permission);

      if (permission === "granted") {
        setPushUpdatesEnabled(true);
        setPushMessage("Push notifications enabled. You can now receive campus alerts on this device.");

        new Notification("USF Assistant notifications enabled", {
          body: "You will now receive transit and campus alert notifications on this device.",
        });
      } else if (permission === "denied") {
        setPushUpdatesEnabled(false);
        setPushMessage("Push notifications are blocked in your browser. If no permission popup appeared, allow notifications in browser site settings and try again.");
      }
    } finally {
      setIsUpdatingPush(false);
    }
  };

  const handleEmailToggle = () => {
    setEmailUpdatesEnabled((current) => !current);
  };

  const handleLocationToggle = async () => {
    if (!locationServicesEnabled) {
      if (locationPermission === "unsupported") {
        setLocationMessage("This browser does not support location services.");
        return;
      }

      if (locationPermission === "granted") {
        setLocationServicesEnabled(true);
        setLocationMessage("Location services enabled for the app.");
        return;
      }

      setIsUpdatingLocation(true);
      setLocationMessage(null);

      navigator.geolocation.getCurrentPosition(
        () => {
          setLocationPermission("granted");
          setLocationServicesEnabled(true);
          setLocationMessage("Location services enabled. The app can now use your current location for routing.");
          setIsUpdatingLocation(false);
        },
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            setLocationPermission("denied");
            setLocationServicesEnabled(false);
            setLocationMessage("Location permission is blocked in your browser. If no permission popup appeared, enable location access in browser site settings and try again.");
          } else {
            setLocationMessage("We could not access your location right now. Try again in a moment.");
          }

          setIsUpdatingLocation(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );

      return;
    }

    setLocationServicesEnabled(false);
    setLocationMessage("Location services turned off in the app. Turn them back on whenever you want to use live navigation.");
  };

  return (
    <div className="max-w-4xl mx-auto w-full px-6 md:px-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-10">
        <h1 className="font-headline text-4xl font-bold text-on-surface tracking-tight mb-2">Settings</h1>
        <p className="text-on-surface-variant">Manage your app preferences and account settings.</p>
      </div>

      <div className="space-y-12">
        {/* Appearance Section */}
        <section id="notifications">
          <h2 className="font-headline text-xl font-bold text-on-surface mb-6 flex items-center gap-2">
            <Monitor className="w-5 h-5 text-primary" /> Appearance
          </h2>
          <div className="glass-panel rounded-2xl p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h3 className="font-bold text-on-surface">Theme Mode</h3>
                <p className="text-sm text-on-surface-variant mt-1">
                  Choose how the app looks across every page.
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
                <p className="text-sm text-on-surface-variant mt-1">
                  Receive alerts for transit and campus events.
                  {pushPermission === "unsupported"
                    ? " This browser does not support notifications."
                    : pushPermission === "granted"
                      ? pushUpdatesEnabled
                        ? " Notifications are enabled on this device and in the app."
                        : " Browser permission is granted, but notifications are turned off in the app."
                      : pushPermission === "denied"
                        ? " Notifications are blocked in browser settings."
                        : " Enable them for this browser when prompted."}
                </p>
              </div>
              <Toggle checked={pushNotificationsEnabled} onToggle={() => void handlePushToggle()} disabled={isUpdatingPush || pushPermission === "unsupported"} />
            </div>
            {pushMessage ? <p className="text-sm text-on-surface-variant -mt-2">{pushMessage}</p> : null}
            <div className="h-[1px] w-full bg-outline-variant/20"></div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-on-surface">Email Updates</h3>
                <p className="text-sm text-on-surface-variant mt-1">
                  Weekly newsletter and important announcements. This preference is saved on this device.
                </p>
              </div>
              <Toggle checked={emailUpdatesEnabled} onToggle={handleEmailToggle} />
            </div>
            <p className="text-sm text-on-surface-variant -mt-2">
              Email updates are currently <span className="font-semibold text-on-surface">{emailUpdatesEnabled ? "enabled" : "disabled"}</span>.
            </p>
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
                <p className="text-sm text-on-surface-variant mt-1">
                  Allow the app to use your location for navigation.
                  {locationPermission === "unsupported"
                    ? " This browser does not support geolocation."
                    : locationPermission === "granted"
                      ? locationServicesEnabled
                        ? " Location services are enabled on this device and in the app."
                        : " Browser permission is granted, but location services are turned off in the app."
                      : locationPermission === "denied"
                        ? " Location access is blocked in browser settings."
                        : " Enable it for this browser when prompted."}
                </p>
              </div>
              <Toggle checked={locationServicesActive} onToggle={() => void handleLocationToggle()} disabled={isUpdatingLocation || locationPermission === "unsupported"} />
            </div>
            <p className="text-sm text-on-surface-variant -mt-2">
              Location services are currently <span className="font-semibold text-on-surface">{locationServicesActive ? "enabled" : "disabled"}</span> for the app.
            </p>
            {locationMessage ? <p className="text-sm text-on-surface-variant -mt-2">{locationMessage}</p> : null}
            <div className="h-[1px] w-full bg-outline-variant/20"></div>
            <button onClick={() => openUserProfile()} className="text-primary font-bold text-sm hover:underline">
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
