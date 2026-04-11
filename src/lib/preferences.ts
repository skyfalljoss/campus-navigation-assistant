export const THEME_STORAGE_KEY = "usf_theme_preference";
export const EMAIL_UPDATES_STORAGE_KEY = "usf_email_updates_enabled";
export const PUSH_UPDATES_STORAGE_KEY = "usf_push_updates_enabled";
export const LOCATION_SERVICES_STORAGE_KEY = "usf_location_services_enabled";

export type ThemePreference = "dark" | "light" | "system";

export function getThemePreference(): ThemePreference {
  if (typeof window === "undefined") {
    return "system";
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (storedTheme === "dark" || storedTheme === "light" || storedTheme === "system") {
    return storedTheme;
  }

  return "system";
}

export function applyThemePreference(theme: ThemePreference) {
  if (typeof window === "undefined") {
    return;
  }

  const root = window.document.documentElement;
  const shouldUseDarkMode =
    theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  root.classList.toggle("dark", shouldUseDarkMode);
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
}

export function initializeThemePreference() {
  if (typeof window === "undefined") {
    return () => {};
  }

  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

  const syncTheme = () => {
    applyThemePreference(getThemePreference());
  };

  syncTheme();
  mediaQuery.addEventListener("change", syncTheme);

  return () => {
    mediaQuery.removeEventListener("change", syncTheme);
  };
}

export function isLocationServicesEnabled() {
  if (typeof window === "undefined") {
    return true;
  }

  return window.localStorage.getItem(LOCATION_SERVICES_STORAGE_KEY) !== "false";
}
