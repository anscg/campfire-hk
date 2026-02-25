"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { apiClient, ApiError } from "@/lib/api";
import type { User } from "@/types";

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  otpSent: boolean;
  pendingEmail: string | null;
  error: string | null;
  login: (email: string) => Promise<void>;
  verifyOTP: (email: string, code: string) => Promise<boolean>;
  logout: () => void;
  setUser: (user: User) => void;
  fetchUser: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      otpSent: false,
      pendingEmail: null,
      error: null,

      login: async (email: string) => {
        set({ isLoading: true, error: null });
        try {
          await apiClient.requestOTP(email);
          set({ otpSent: true, pendingEmail: email, isLoading: false });
        } catch (error: any) {
          set({
            error: error.message || "Failed to send OTP",
            isLoading: false,
          });
        }
      },

      verifyOTP: async (email: string, code: string) => {
        set({ isLoading: true, error: null });
        try {
          const result = await apiClient.verifyOTP(email, code);
          if (result.success) {
            apiClient.setToken(result.token);
            const user = await apiClient.getMe();
            set({
              token: result.token,
              user: { ...user, _id: user._id },
              isAuthenticated: true,
              isLoading: false,
              otpSent: false,
              pendingEmail: null,
            });
            return true;
          }
          set({ error: "Verification failed", isLoading: false });
          return false;
        } catch (error: any) {
          set({
            error: error.message || "Verification failed",
            isLoading: false,
          });
          return false;
        }
      },

      logout: () => {
        apiClient.setToken(null);
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          otpSent: false,
          pendingEmail: null,
          error: null,
        });
      },

      setUser: (user: User) => set({ user }),

      fetchUser: async () => {
        const { token } = get();
        if (!token) return;
        apiClient.setToken(token);
        try {
          const user = await apiClient.getMe();
          set({ user, isAuthenticated: true });
        } catch (err) {
          // Only clear the session on an explicit 401 (invalid/expired token).
          // Network errors (server restarting, offline) are transient — keep
          // the session alive so the user isn't logged out unnecessarily.
          if (err instanceof ApiError && err.status === 401) {
            set({ user: null, token: null, isAuthenticated: false });
          }
          // Otherwise: leave token + isAuthenticated untouched; page.tsx will
          // still route to the desktop and the next successful request will
          // re-hydrate the user object.
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: "campfire-os-auth",
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
