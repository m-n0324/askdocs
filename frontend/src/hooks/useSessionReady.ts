import { useEffect, useSyncExternalStore } from "react";
import { useSessionStore } from "@/stores";

// Module-level so every component shares one "has the saved session been loaded?" flag.
let isLoaded = false;
let isLoading = false;
const listeners = new Set<() => void>();

const subscribe = (onChange: () => void) => {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
};
const getSnapshot = () => isLoaded;
// On the server (and during the first client render) the session is never "ready".
const getServerSnapshot = () => false;

async function loadSavedSession() {
  if (isLoading || isLoaded) return;
  isLoading = true;
  // `persist` is missing when localStorage is blocked (some private modes): then there is simply no saved session.
  const persistApi = useSessionStore.persist as typeof useSessionStore.persist | undefined;
  try {
    if (persistApi && !persistApi.hasHydrated()) await persistApi.rehydrate();
  } finally {
    // Even if loading failed we must stop waiting, or the guards would show a spinner forever.
    isLoaded = true;
    listeners.forEach((listener) => listener());
  }
}

/**
 * Loads the saved session from localStorage after mount and reports when it's done.
 * Guards wait for this before deciding to redirect, so a logged-in user
 * isn't bounced to /login during the first render.
 */
export function useSessionReady(): boolean {
  const isReady = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    void loadSavedSession();
  }, []);

  return isReady;
}
