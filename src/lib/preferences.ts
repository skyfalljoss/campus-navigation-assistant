export const THEME_STORAGE_KEY = "usf_theme_preference";
export const EMAIL_UPDATES_STORAGE_KEY = "usf_email_updates_enabled";
export const PUSH_UPDATES_STORAGE_KEY = "usf_push_updates_enabled";
export const LOCATION_SERVICES_STORAGE_KEY = "usf_location_services_enabled";

export function isLocationServicesEnabled() {
  if (typeof window === "undefined") {
    return true;
  }

  return window.localStorage.getItem(LOCATION_SERVICES_STORAGE_KEY) !== "false";
}
