"use client";

import { useState, useEffect, useRef } from "react";
import { useWindowStore } from "@/stores/windowStore";
import { useAuthStore } from "@/stores/authStore";
import { taskbarButtonRects } from "@/lib/taskbarRefs";
import { IconRenderer } from "@/lib/iconRenderer";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// ============================================================
// Now-Playing Ticker Hook — polls /api/music/queue every 3s
// ============================================================

function useNowPlaying() {
  const [title, setTitle] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`${API_URL}/api/music/queue`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;

        const player = data?.player;
        const queue: Array<{ _id: string; title: string; status: string }> = data?.queue ?? [];

        if (!player?.currentId || !player?.isPlaying) {
          setTitle(null);
          return;
        }

        const current = queue.find((s) => s._id === player.currentId);
        setTitle(current?.title ?? null);
      } catch {
        // silently ignore network errors
      }
    }

    poll();
    const interval = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return title;
}

// ============================================================
// Taskbar - Bottom bar with open windows, clock, XP display
// ============================================================

export default function Taskbar() {
  const { windows, activeWindowId, focusWindow, restoreWindow, minimizeWindow } =
    useWindowStore();
  const { user, logout } = useAuthStore();
  const nowPlaying = useNowPlaying();

  const handleTaskClick = (windowId: string) => {
    const win = windows.find((w) => w.id === windowId);
    if (!win) return;

    if (win.isMinimized) {
      restoreWindow(windowId);
    } else if (activeWindowId === windowId) {
      minimizeWindow(windowId);
    } else {
      focusWindow(windowId);
    }
  };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 h-12 bg-zinc-900/95 border-t border-zinc-800
        backdrop-blur-sm flex items-center px-2 gap-1 z-[9999] select-none"
    >
      {/* Start / Logo */}
      <div className="flex items-center gap-2 px-3 h-8 hover:bg-zinc-800 transition-colors cursor-pointer">
        <span className="text-sm">🔥</span>
        <span className="text-xs font-mono text-zinc-400 hidden sm:inline">
          Campfire
        </span>
      </div>

      <div className="w-px h-6 bg-zinc-700 mx-1" />

      {/* Window buttons */}
      <div className="flex-1 flex items-center gap-1 overflow-x-auto scrollbar-hide">
        {windows.map((win) => (
          <button
            key={win.id}
            ref={(el) => {
              if (el) taskbarButtonRects.set(win.id, el.getBoundingClientRect());
            }}
            onClick={() => handleTaskClick(win.id)}
            className={`flex items-center gap-1.5 px-3 h-8 text-xs font-mono
              transition-colors shrink-0 max-w-[160px]
              ${
                activeWindowId === win.id && !win.isMinimized
                  ? "bg-zinc-700 text-white"
                  : "bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300"
              }
              ${win.isMinimized ? "opacity-50" : ""}`}
          >
            <span className="flex items-center justify-center w-4 h-4">
              <IconRenderer icon={win.icon} size={14} />
            </span>
            <span className="truncate">{win.title}</span>
          </button>
        ))}
      </div>

      {/* System Tray */}
      <div className="flex items-center gap-2">
        {/* Now Playing Ticker */}
        {nowPlaying && (
          <div className="hidden sm:flex items-center gap-1.5 pl-2 pr-0 h-8 bg-zinc-800/50 text-xs font-mono w-[180px]">
            <span className="text-orange-400 shrink-0">&#9654;</span>
            <NowPlayingScroller title={nowPlaying} />
          </div>
        )}

        {/* XP Display */}
        {user && (
          <div className="hidden sm:flex items-center gap-1 px-2 h-8 bg-zinc-800/50 text-xs font-mono">
            <span className="text-yellow-400">{user.xp} XP</span>
          </div>
        )}

        {/* Clock */}
        <Clock />

        {/* Logout */}
        <button
          onClick={logout}
          className="h-8 px-2 hover:bg-zinc-800 transition-colors text-zinc-500 hover:text-zinc-300"
          title="Logout"
        >
          <span className="text-xs font-mono">⏻</span>
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Seamless scrolling ticker
// — renders text twice; animates the pair left by one full text-width
// — gradient fade on the right edge masks the seam
// ============================================================

function NowPlayingScroller({ title }: { title: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(false);

  // Re-measure whenever the title changes
  useEffect(() => {
    const container = containerRef.current;
    const text = textRef.current;
    if (!container || !text) return;
    setOverflow(text.scrollWidth > container.clientWidth);
  }, [title]);

  // Duration scales with text length so speed feels constant (~60px/s)
  const textWidth = textRef.current?.scrollWidth ?? 0;
  const duration = Math.max(6, Math.round(textWidth / 60));

  return (
    // Outer: fixed width, clips overflow, relative so gradient sibling can overlay
    <div ref={containerRef} className="relative overflow-hidden flex-1 min-w-0 h-full flex items-center">
      {overflow ? (
        // Seamless loop: two copies side by side, animating as one unit
        <div
          className="flex whitespace-nowrap"
          style={{
            animation: `taskbar-marquee ${duration}s linear infinite`,
          }}
        >
          <span ref={textRef} className="text-zinc-300 pr-12">{title}</span>
          {/* Second copy fills the gap so there's no blank period */}
          <span className="text-zinc-300 pr-12" aria-hidden>{title}</span>
        </div>
      ) : (
        <span ref={textRef} className="text-zinc-300 whitespace-nowrap">{title}</span>
      )}

      {/* Right-edge fade — only shown when overflowing */}
      {overflow && (
        <div
          className="absolute right-0 top-0 bottom-0 w-8 pointer-events-none"
          style={{
            background: "linear-gradient(to right, transparent, #18181b)",
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// Live Clock
// ============================================================

function Clock() {
  const now = useCurrentTime();
  const time = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="text-xs font-mono text-zinc-400 px-2">
      {time}
    </div>
  );
}

function useCurrentTime() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);
  return time;
}
