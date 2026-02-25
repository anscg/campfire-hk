"use client";

import { create } from "zustand";
import type {
  WindowConfig,
  WindowInstance,
  WindowPosition,
  WindowSize,
  WindowManagerState,
} from "@/types";
import { v4 as uuid } from "uuid";

const ANIM_OPEN_MS = 160;   // matches ANIM_SCALE_MS in WindowFrame
const ANIM_CLOSE_MS = 160;  // matches ANIM_SCALE_MS in WindowFrame
const ANIM_MINIMIZE_MS = 200; // matches ANIM_FLY_MS in WindowFrame

export const useWindowStore = create<WindowManagerState>((set, get) => ({
  windows: [],
  activeWindowId: null,
  nextZIndex: 1,
  isMobile: false,

  openWindow: (config: WindowConfig) => {
    const { windows, nextZIndex, isMobile } = get();

    // Check if window with same configId already exists
    const existing = windows.find((w) => w.configId === config.id);
    if (existing) {
      get().focusWindow(existing.id);
      if (existing.isMinimized) {
        get().restoreWindow(existing.id);
      }
      return;
    }

    const id = uuid();

    const position: WindowPosition = isMobile
      ? { x: 0, y: 0 }
      : {
          x: Math.max(
            40,
            window.innerWidth / 2 - config.defaultSize.width / 2 +
              (windows.length * 30) % 150
          ),
          y: Math.max(
            40,
            window.innerHeight / 2 - config.defaultSize.height / 2 +
              (windows.length * 30) % 100
          ),
        };

    const size: WindowSize = isMobile
      ? { width: window.innerWidth, height: window.innerHeight - 48 }
      : config.defaultSize;

    const newWindow: WindowInstance = {
      id,
      configId: config.id,
      title: config.title,
      icon: config.icon,
      component: config.component,
      position,
      size,
      minSize: config.minSize,
      isMaximized: isMobile,
      isMinimized: false,
      zIndex: nextZIndex,
      resizable: config.resizable,
      closable: config.closable,
      maximizable: config.maximizable,
      animState: "opening",
    };

    set({
      windows: [...windows, newWindow],
      activeWindowId: id,
      nextZIndex: nextZIndex + 1,
    });

    // Clear opening anim
    setTimeout(() => {
      set((s) => ({
        windows: s.windows.map((w) =>
          w.id === id ? { ...w, animState: null } : w
        ),
      }));
    }, ANIM_OPEN_MS);
  },

  closeWindow: (id: string) => {
    // Play closing anim then remove
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === id ? { ...w, animState: "closing" } : w
      ),
    }));
    setTimeout(() => {
      const { windows, activeWindowId } = get();
      const filtered = windows.filter((w) => w.id !== id);
      set({
        windows: filtered,
        activeWindowId:
          activeWindowId === id
            ? filtered.length > 0
              ? filtered[filtered.length - 1].id
              : null
            : activeWindowId,
      });
    }, ANIM_CLOSE_MS);
  },

  focusWindow: (id: string) => {
    const { windows, nextZIndex } = get();
    set({
      windows: windows.map((w) =>
        w.id === id ? { ...w, zIndex: nextZIndex } : w
      ),
      activeWindowId: id,
      nextZIndex: nextZIndex + 1,
    });
  },

  minimizeWindow: (id: string) => {
    // Play minimizing anim then hide
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === id ? { ...w, animState: "minimizing" } : w
      ),
    }));
    setTimeout(() => {
      const { windows, activeWindowId } = get();
      const updated = windows.map((w) =>
        w.id === id ? { ...w, isMinimized: true, animState: null } : w
      );
      const visible = updated.filter((w) => !w.isMinimized);
      set({
        windows: updated,
        activeWindowId:
          activeWindowId === id
            ? visible.length > 0
              ? visible[visible.length - 1].id
              : null
            : activeWindowId,
      });
    }, ANIM_MINIMIZE_MS);
  },

  maximizeWindow: (id: string) => {
    const { windows } = get();
    set({
      windows: windows.map((w) =>
        w.id === id
          ? {
              ...w,
              isMaximized: true,
              preMaximizeState: { position: w.position, size: w.size },
              position: { x: 0, y: 0 },
              size: {
                width: window.innerWidth,
                height: window.innerHeight - 48,
              },
            }
          : w
      ),
    });
  },

  restoreWindow: (id: string) => {
    const { windows, nextZIndex } = get();
    // Play unminimize anim if was minimized
    const win = windows.find((w) => w.id === id);
    const wasMinimized = win?.isMinimized ?? false;

    const restored = win?.preMaximizeState
      ? { position: win.preMaximizeState.position, size: win.preMaximizeState.size }
      : {};

    set({
      windows: windows.map((w) =>
        w.id === id
          ? {
              ...w,
              isMinimized: false,
              isMaximized: false,
              zIndex: nextZIndex,
              ...restored,
              preMaximizeState: undefined,
              animState: wasMinimized ? "unminimizing" : null,
            }
          : w
      ),
      activeWindowId: id,
      nextZIndex: nextZIndex + 1,
    });

    if (wasMinimized) {
      setTimeout(() => {
        set((s) => ({
          windows: s.windows.map((w) =>
            w.id === id ? { ...w, animState: null } : w
          ),
        }));
      }, ANIM_MINIMIZE_MS);
    }
  },

  updatePosition: (id: string, position: WindowPosition) => {
    const { windows } = get();
    set({
      windows: windows.map((w) => (w.id === id ? { ...w, position } : w)),
    });
  },

  updateSize: (id: string, size: WindowSize) => {
    const { windows } = get();
    set({
      windows: windows.map((w) => (w.id === id ? { ...w, size } : w)),
    });
  },

  setMobile: (isMobile: boolean) => {
    set({ isMobile });
    if (isMobile) {
      const { windows } = get();
      set({
        windows: windows.map((w) => ({
          ...w,
          isMaximized: true,
          position: { x: 0, y: 0 },
          size: {
            width: typeof window !== "undefined" ? window.innerWidth : 400,
            height:
              typeof window !== "undefined" ? window.innerHeight - 48 : 600,
          },
        })),
      });
    }
  },
}));
