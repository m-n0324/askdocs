import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { SESSION_STORAGE_KEY } from "@/constants";
import type { IAuthResponse, IUser } from "@/interfaces";

interface ISessionState {
  token: string | null;
  user: IUser | null;
  setSession: (session: IAuthResponse) => void;
  setUser: (user: IUser) => void;
  clearSession: () => void;
}

export const useSessionStore = create<ISessionState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setSession: ({ token, user }) => set({ token, user }),
      setUser: (user) => set({ user }),
      clearSession: () => set({ token: null, user: null }),
    }),
    {
      name: SESSION_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ token, user }) => ({ token, user }),
      // The server has no localStorage. We read it only after the first client
      // render (see useSessionReady) so server HTML and client HTML match.
      skipHydration: true,
      // Corrupt saved data: forget it, so the user just logs in again.
      onRehydrateStorage: () => (_state, error) => {
        if (error) localStorage.removeItem(SESSION_STORAGE_KEY);
      },
    },
  ),
);
