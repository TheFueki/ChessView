/**
 * User entity types and persisted auth store.
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

const AUTH_STORAGE_KEY = "chessview-auth";

export interface User {
  id: string;
  username: string;
  rating: number;
  avatar_url?: string | null;
}

export interface AuthenticatedUser extends User {
  email: string;
  created_at: string;
  bio?: string | null;
}

interface UserState {
  user: AuthenticatedUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  hasHydrated: boolean;
  isBootstrapping: boolean;
  setAuth: (user: AuthenticatedUser, accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
  logout: () => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: AuthenticatedUser) => void;
  setHydrated: (hasHydrated: boolean) => void;
  setBootstrapping: (isBootstrapping: boolean) => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      hasHydrated: false,
      isBootstrapping: false,

      setAuth: (user, accessToken, refreshToken) =>
        set({
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
          isBootstrapping: false,
        }),

      clearAuth: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isBootstrapping: false,
        }),

      logout: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isBootstrapping: false,
        }),

      setTokens: (accessToken, refreshToken) =>
        set((state) => ({
          ...state,
          accessToken,
          refreshToken,
          isAuthenticated: Boolean(accessToken && state.user),
        })),

      setUser: (user) =>
        set((state) => ({
          ...state,
          user,
          isAuthenticated: Boolean(state.accessToken && user),
        })),

      setHydrated: (hasHydrated) => set({ hasHydrated }),

      setBootstrapping: (isBootstrapping) => set({ isBootstrapping }),
    }),
    {
      name: AUTH_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);

export function getPersistedAccessToken(): string | null {
  const state = useUserStore.getState();
  if (state.accessToken) {
    return state.accessToken;
  }

  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as {
      state?: { accessToken?: string | null };
    };
    return parsed.state?.accessToken ?? null;
  } catch {
    return null;
  }
}
