const RECENT_DESTINATIONS_UPDATED_EVENT = "usf:recent-destinations-updated";
const RECENT_DESTINATIONS_UPDATED_KEY = "usf_recent_destinations_updated_at";

export function notifyRecentDestinationsUpdated() {
  if (typeof window === "undefined") {
    return;
  }

  const timestamp = Date.now().toString();
  window.dispatchEvent(new CustomEvent(RECENT_DESTINATIONS_UPDATED_EVENT, { detail: timestamp }));
  window.localStorage.setItem(RECENT_DESTINATIONS_UPDATED_KEY, timestamp);
}

export function subscribeToRecentDestinationsUpdates(onUpdate: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleWindowUpdate = () => {
    onUpdate();
  };

  const handleStorageUpdate = (event: StorageEvent) => {
    if (event.key === RECENT_DESTINATIONS_UPDATED_KEY) {
      onUpdate();
    }
  };

  window.addEventListener(RECENT_DESTINATIONS_UPDATED_EVENT, handleWindowUpdate);
  window.addEventListener("storage", handleStorageUpdate);

  return () => {
    window.removeEventListener(RECENT_DESTINATIONS_UPDATED_EVENT, handleWindowUpdate);
    window.removeEventListener("storage", handleStorageUpdate);
  };
}
