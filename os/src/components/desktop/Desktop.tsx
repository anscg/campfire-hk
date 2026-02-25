"use client";

import { useEffect, useRef } from "react";
import { useWindowStore } from "@/stores/windowStore";
import { useAuthStore } from "@/stores/authStore";
import { WINDOW_CONFIGS, registerBuiltinWindows } from "@/lib/windowRegistry";
import WindowManager from "./WindowManager";
import DesktopIcons from "./DesktopIcons";
import Taskbar from "./Taskbar";

// ============================================================
// Desktop - Main desktop environment container
// Handles responsive detection and renders all desktop elements
// ============================================================

// Parse configIds from hash string, e.g. "#profile,leaderboard" or "#camppay?pay=TOKEN"
// Returns { configIds, params } — params extracts ?key=value from any segment
function parseHash(hash: string): { configIds: string[]; params: Record<string, string> } {
  const params: Record<string, string> = {};
  const raw = hash.replace(/^#/, "").split(",").map((s) => s.trim()).filter(Boolean);
  const configIds = raw.map((segment) => {
    const qIdx = segment.indexOf("?");
    if (qIdx === -1) return segment;
    // Extract query params from this segment
    const query = segment.slice(qIdx + 1);
    query.split("&").forEach((pair) => {
      const [k, v] = pair.split("=");
      if (k && v) params[decodeURIComponent(k)] = decodeURIComponent(v);
    });
    return segment.slice(0, qIdx);
  });
  return { configIds, params };
}

// Build hash string from list of configIds
function buildHash(configIds: string[]): string {
  return configIds.length ? "#" + configIds.join(",") : "";
}

export default function Desktop() {
  const { setMobile, windows, openWindow, closeWindow } = useWindowStore();
  const { fetchUser } = useAuthStore();
  // Guard against re-entrancy when we're the one pushing the history entry
  const updatingHash = useRef(false);
  // Don't sync hash until after the mount effect has had a chance to open windows
  const mountedRef = useRef(false);

  // ── 0. Refresh user XP every 15s so stale cached data doesn't linger ──
  useEffect(() => {
    fetchUser();
    const interval = setInterval(fetchUser, 15000);
    return () => clearInterval(interval);
  }, [fetchUser]);

  // ── 1. Sync windows → URL hash (only after mount effect runs) ──
  useEffect(() => {
    // Skip the very first render — let effect #2 open windows from the hash first
    if (!mountedRef.current) return;

    const configIds = windows
      .filter((w) => !w.isMinimized)
      .sort((a, b) => a.zIndex - b.zIndex)
      .map((w) => w.configId);

    const newHash = buildHash(configIds);
    const currentHash = window.location.hash;

    if (newHash === currentHash) return;

    updatingHash.current = true;
    window.history.pushState(null, "", newHash || window.location.pathname);
    updatingHash.current = false;
  }, [windows]);

  // ── 2. Restore windows from hash on mount ───────────────────
  useEffect(() => {
    registerBuiltinWindows();

    const { configIds, params } = parseHash(window.location.hash);

    // If a ?pay= token is present, stash it (page.tsx may have already done this,
    // but handle it here too as a safety net)
    if (params.pay) {
      sessionStorage.setItem("camppay_incoming_token", params.pay);
    }

    if (configIds.length > 0) {
      configIds.forEach((id) => {
        const config = WINDOW_CONFIGS[id];
        if (config) openWindow(config);
      });
    } else if (params.pay || sessionStorage.getItem("camppay_incoming_token")) {
      // Arrived via QR pay link — open CampPay directly
      const config = WINDOW_CONFIGS.camppay;
      if (config) openWindow(config);
    }

    // Allow hash sync AFTER this effect has opened the initial windows
    mountedRef.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 3. popstate → reconcile windows with new hash ───────────
  useEffect(() => {
    const onPopState = () => {
      if (updatingHash.current) return;

      const { configIds: targetIds } = parseHash(window.location.hash);
      const { windows: current } = useWindowStore.getState();

      // Close windows not in the target set
      current.forEach((w) => {
        if (!targetIds.includes(w.configId)) {
          closeWindow(w.id);
        }
      });

      // Open windows in the target set that aren't open yet
      targetIds.forEach((id) => {
        const alreadyOpen = useWindowStore.getState().windows.find((w) => w.configId === id);
        if (!alreadyOpen) {
          const config = WINDOW_CONFIGS[id];
          if (config) openWindow(config);
        }
      });
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [openWindow, closeWindow]);

  // ── 4. Mobile detection ─────────────────────────────────────
  useEffect(() => {
    const checkMobile = () => setMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, [setMobile]);

  return (
    <div className="h-screen w-screen bg-zinc-950 overflow-hidden relative select-none">
      {/* Desktop Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      {/* Desktop Icons */}
      <div className="absolute inset-0 pb-12 overflow-auto">
        <DesktopIcons />
      </div>

      {/* Window Manager - renders all open windows */}
      <WindowManager />

      {/* Taskbar */}
      <Taskbar />
    </div>
  );
}
