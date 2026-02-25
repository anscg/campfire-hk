"use client";

import { create } from "zustand";
import type { BootPhase, BootState } from "@/types";

export const useBootStore = create<BootState>((set) => ({
  phase: "init",
  progress: 0,
  messages: [],

  setPhase: (phase: BootPhase) => set({ phase }),

  addMessage: (message: string) =>
    set((state) => ({ messages: [...state.messages, message] })),

  setProgress: (progress: number) => set({ progress }),

  reset: () =>
    set({
      phase: "init",
      progress: 0,
      messages: [],
    }),
}));
