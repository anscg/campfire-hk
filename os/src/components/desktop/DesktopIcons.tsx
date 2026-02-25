"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useWindowStore } from "@/stores/windowStore";
import { useAuthStore } from "@/stores/authStore";
import { DESKTOP_ICONS } from "@/lib/windowRegistry";
import { IconRenderer } from "@/lib/iconRenderer";
import type { DesktopIcon } from "@/types";

const POSITIONS_KEY = "campfire_os_icon_positions";
const MOVED_KEY = "campfire_os_icon_moved";

// Icon cell dimensions — must match the rendered size
const ICON_W = 80;   // w-20
const ICON_H = 110;  // icon + label + padding
const COL_GAP = 8;   // horizontal gap between columns
const ROW_GAP = 8;   // vertical gap between rows
const MARGIN = 16;   // distance from screen edge
const TASKBAR_H = 40;

function clampPos(x: number, y: number): IconPos {
  const maxX = Math.max(0, window.innerWidth - ICON_W);
  const maxY = Math.max(0, window.innerHeight - TASKBAR_H - ICON_H);
  return {
    x: Math.max(0, Math.min(x, maxX)),
    y: Math.max(0, Math.min(y, maxY)),
  };
}

/**
 * Compute auto-layout positions for icons that haven't been manually moved.
 * Fills a left-hand column top-to-bottom, then starts a new column to the right.
 */
function computeAutoLayout(iconIds: string[], movedIds: Set<string>): Record<string, IconPos> {
  const usableHeight = window.innerHeight - TASKBAR_H - MARGIN;
  const cellH = ICON_H + ROW_GAP;
  const cellW = ICON_W + COL_GAP;
  const iconsPerCol = Math.max(1, Math.floor((usableHeight - MARGIN) / cellH));

  const result: Record<string, IconPos> = {};
  let autoIndex = 0;

  for (const id of iconIds) {
    if (movedIds.has(id)) continue; // skip manually placed icons
    const col = Math.floor(autoIndex / iconsPerCol);
    const row = autoIndex % iconsPerCol;
    result[id] = {
      x: MARGIN + col * cellW,
      y: MARGIN + row * cellH,
    };
    autoIndex++;
  }

  return result;
}

// ============================================================
// Desktop Icons
// - Single click: select
// - Double click: open window (desktop)
// - Single tap: open window (mobile)
// - Draggable on desktop
// - Selected state: 1px border, no rounded corners
// - Clicking empty desktop deselects
// ============================================================

interface IconPos { x: number; y: number }

export default function DesktopIcons() {
  const { openWindow, isMobile } = useWindowStore();
  const { user } = useAuthStore();
  const isAdmin = !!user?.isAdmin;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(0);

  // Filter out adminOnly icons for non-admins — memoized so the array reference
  // is stable across renders (prevents infinite useEffect → recomputeLayout loop)
  const visibleIcons = useMemo(
    () => DESKTOP_ICONS.filter((icon) => !icon.adminOnly || isAdmin),
    [isAdmin]
  );

  // Track which icons the user has manually dragged
  const [movedIds, setMovedIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const saved = localStorage.getItem(MOVED_KEY);
      if (saved) return new Set(JSON.parse(saved) as string[]);
    } catch { /* ignore */ }
    return new Set();
  });

  const [positions, setPositions] = useState<Record<string, IconPos>>(() => {
    if (typeof window === "undefined") {
      // SSR: return placeholder; real layout computed in useEffect
      const defaults: Record<string, IconPos> = {};
      DESKTOP_ICONS.forEach((icon, i) => { defaults[icon.id] = { x: MARGIN, y: MARGIN + i * (ICON_H + ROW_GAP) }; });
      return defaults;
    }

    // Load which icons were manually moved
    let moved = new Set<string>();
    try {
      const saved = localStorage.getItem(MOVED_KEY);
      if (saved) moved = new Set(JSON.parse(saved) as string[]);
    } catch { /* ignore */ }

    // Load saved positions for moved icons
    let savedPositions: Record<string, IconPos> = {};
    try {
      const saved = localStorage.getItem(POSITIONS_KEY);
      if (saved) savedPositions = JSON.parse(saved) as Record<string, IconPos>;
    } catch { /* ignore */ }

    // Auto-layout for non-moved icons (use all icons as placeholder; recomputed after mount)
    const iconIds = DESKTOP_ICONS.map((i) => i.id);
    const autoLayout = computeAutoLayout(iconIds, moved);

    // Merge: moved icons use saved positions (clamped), rest use auto-layout
    const result: Record<string, IconPos> = {};
    for (const icon of DESKTOP_ICONS) {
      if (moved.has(icon.id) && savedPositions[icon.id]) {
        result[icon.id] = clampPos(savedPositions[icon.id].x, savedPositions[icon.id].y);
      } else {
        result[icon.id] = autoLayout[icon.id] ?? { x: MARGIN, y: MARGIN };
      }
    }
    return result;
    // Note: recomputeLayout() runs after mount and uses visibleIcons, correcting gaps.
  });

  // Recompute auto-layout positions on resize (only for non-moved icons)
  const recomputeLayout = useCallback(() => {
    setPositions((prev) => {
      // Re-read movedIds from localStorage directly to avoid stale closure
      let moved = new Set<string>();
      try {
        const saved = localStorage.getItem(MOVED_KEY);
        if (saved) moved = new Set(JSON.parse(saved) as string[]);
      } catch { /* ignore */ }

      const iconIds = visibleIcons.map((i) => i.id);
      const autoLayout = computeAutoLayout(iconIds, moved);

      const next: Record<string, IconPos> = {};
      for (const icon of visibleIcons) {
        if (moved.has(icon.id)) {
          next[icon.id] = clampPos(prev[icon.id]?.x ?? MARGIN, prev[icon.id]?.y ?? MARGIN);
        } else {
          next[icon.id] = autoLayout[icon.id] ?? { x: MARGIN, y: MARGIN };
        }
      }
      return next;
    });
  }, [visibleIcons]);

  useEffect(() => {
    recomputeLayout();
    window.addEventListener("resize", recomputeLayout);
    return () => window.removeEventListener("resize", recomputeLayout);
  }, [recomputeLayout]);

  // Reveal icons one-by-one with 65ms base + random jitter
  // Re-runs if admin status changes (admin icon appears/disappears)
  useEffect(() => {
    let cancelled = false;
    let current = 0;
    setVisibleCount(0);

    const scheduleNext = () => {
      if (cancelled || current >= visibleIcons.length) return;
      const delay = 40 + Math.random() * 40;
      setTimeout(() => {
        if (cancelled) return;
        current += 1;
        setVisibleCount(current);
        scheduleNext();
      }, delay);
    };

    scheduleNext();
    return () => { cancelled = true; };
  }, [visibleIcons.length]);

  // Persist positions whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(POSITIONS_KEY, JSON.stringify(positions));
    } catch { /* ignore */ }
  }, [positions]);

  // Persist movedIds whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(MOVED_KEY, JSON.stringify([...movedIds]));
    } catch { /* ignore */ }
  }, [movedIds]);

  // Deselect when clicking empty desktop
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-desktop-icon]")) {
        setSelectedId(null);
      }
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, []);

  if (isMobile) {
    // Mobile: simple grid, tap to open
    return (
      <div className="grid grid-cols-4 gap-4 p-4 place-items-center">
        {visibleIcons.map((icon, i) => (
          <button
            key={icon.id}
            data-desktop-icon
            onClick={() => openWindow(icon.windowConfig)}
            className="flex flex-col items-center gap-1 p-2 select-none"
            style={{ visibility: i < visibleCount ? "visible" : "hidden" }}
          >
            <IconRenderer icon={icon.icon} size={48} />
            <span className="text-xs font-mono text-zinc-400 text-center leading-tight">
              {icon.label}
            </span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="absolute inset-0 pointer-events-none">
      {visibleIcons.map((icon, i) => (
        <DraggableIcon
          key={icon.id}
          icon={icon}
          position={positions[icon.id] ?? { x: MARGIN, y: MARGIN }}
          selected={selectedId === icon.id}
          visible={i < visibleCount}
          onSelect={() => setSelectedId(icon.id)}
          onOpen={() => openWindow(icon.windowConfig)}
          onMove={(pos) => {
            setPositions((prev) => ({ ...prev, [icon.id]: pos }));
            setMovedIds((prev) => {
              if (prev.has(icon.id)) return prev;
              return new Set([...prev, icon.id]);
            });
          }}
        />
      ))}
    </div>
  );
}

// ── Single draggable desktop icon ─────────────────────────────────────────────

interface DraggableIconProps {
  icon: DesktopIcon;
  position: IconPos;
  selected: boolean;
  visible: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onMove: (pos: IconPos) => void;
}

function DraggableIcon({ icon, position, selected, visible, onSelect, onOpen, onMove: reportMove }: DraggableIconProps) {
  const dragRef = useRef<{ startMouseX: number; startMouseY: number; startX: number; startY: number } | null>(null);
  const hasDragged = useRef(false);
  const [hovered, setHovered] = useState(false);

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    dragRef.current = { startMouseX: e.clientX, startMouseY: e.clientY, startX: position.x, startY: position.y };
    hasDragged.current = false;

    const handleMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startMouseX;
      const dy = ev.clientY - dragRef.current.startMouseY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        hasDragged.current = true;
        reportMove(clampPos(dragRef.current.startX + dx, dragRef.current.startY + dy));
      }
    };

    const handleUp = () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      dragRef.current = null;
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasDragged.current) return;
    onSelect();
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpen();
  };

  return (
    <div
      data-desktop-icon
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        cursor: "default",
        visibility: visible ? "visible" : "hidden",
        pointerEvents: visible ? undefined : "none",
      }}
      className="pointer-events-auto"
      onMouseDown={onMouseDown}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <div
        className="flex flex-col items-center gap-1 p-2 select-none w-20"
        style={{
          border: selected ? "1px solid rgba(255,255,255,0.4)" : "1px solid transparent",
          background: selected
            ? "rgba(255,255,255,0.08)"
            : hovered
            ? "rgba(255,255,255,0.05)"
            : "transparent",
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <IconRenderer icon={icon.icon} size={48} />
        <span
          className="text-xs font-mono text-center leading-tight whitespace-nowrap"
          style={{ color: selected ? "#fff" : "rgba(255,255,255,0.7)" }}
        >
          {icon.label}
        </span>
      </div>
    </div>
  );
}
