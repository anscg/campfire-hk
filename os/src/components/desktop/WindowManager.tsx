"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ComponentType } from "react";
import { createPortal } from "react-dom";
import { useWindowStore } from "@/stores/windowStore";
import type { WindowInstance, WindowAnimState } from "@/types";
import WindowFrame from "./WindowFrame";
import { getWindowComponent, getResolvedComponent, registerBuiltinWindows } from "@/lib/windowRegistry";
import { taskbarButtonRects } from "@/lib/taskbarRefs";

// ============================================================
// Window Manager - Renders all open windows + animation ghost layer
// The ghost layer lives here so it outlives individual window unmounts
// ============================================================

const ANIM_SCALE_MS = 180;
const ANIM_FLY_MS = 220;

interface GhostRect { x: number; y: number; width: number; height: number }

type GhostSpec =
  | { type: "scale-in";  rect: GhostRect }
  | { type: "scale-out"; rect: GhostRect }
  | { type: "fly"; from: GhostRect; to: GhostRect };

interface ActiveGhost {
  spec: GhostSpec;
  phase: "start" | "end";
}

function getTaskbarRect(winId: string): GhostRect {
  const r = taskbarButtonRects.get(winId);
  if (r) return { x: r.left, y: r.top, width: r.width, height: r.height };
  // Fallback: bottom-left area
  return {
    x: 80,
    y: typeof window !== "undefined" ? window.innerHeight - 44 : 600,
    width: 120,
    height: 32,
  };
}

// ── Ghost overlay ─────────────────────────────────────────────────────────────

function GhostOverlay({ ghost }: { ghost: ActiveGhost | null }) {
  if (!ghost) return null;

  const { spec, phase } = ghost;
  const base: React.CSSProperties = {
    position: "fixed",
    zIndex: 9990,
    pointerEvents: "none",
    border: "2px dashed rgba(255,255,255,0.5)",
    backgroundColor: "rgba(255,255,255,0.04)",
    boxSizing: "border-box",
  };

  if (spec.type === "scale-in") {
    const scale = phase === "start" ? 0 : 1;
    return (
      <div style={{
        ...base,
        left: spec.rect.x,
        top: spec.rect.y,
        width: spec.rect.width,
        height: spec.rect.height,
        transformOrigin: "center center",
        transform: `scale(${scale})`,
        transition: phase === "end"
          ? `transform ${ANIM_SCALE_MS}ms cubic-bezier(0.2,0,0.2,1)`
          : "none",
      }} />
    );
  }

  if (spec.type === "scale-out") {
    const scale = phase === "start" ? 1 : 0;
    return (
      <div style={{
        ...base,
        left: spec.rect.x,
        top: spec.rect.y,
        width: spec.rect.width,
        height: spec.rect.height,
        transformOrigin: "center center",
        transform: `scale(${scale})`,
        transition: phase === "end"
          ? `transform ${ANIM_SCALE_MS}ms cubic-bezier(0.4,0,1,1)`
          : "none",
      }} />
    );
  }

  // fly
  const current = phase === "start" ? spec.from : spec.to;
  return (
    <div style={{
      ...base,
      left: current.x,
      top: current.y,
      width: current.width,
      height: current.height,
      transition: phase === "end"
        ? `left ${ANIM_FLY_MS}ms cubic-bezier(0.4,0,0.2,1), top ${ANIM_FLY_MS}ms cubic-bezier(0.4,0,0.2,1), width ${ANIM_FLY_MS}ms cubic-bezier(0.4,0,0.2,1), height ${ANIM_FLY_MS}ms cubic-bezier(0.4,0,0.2,1)`
        : "none",
    }} />
  );
}

// ── Animation ghost controller ────────────────────────────────────────────────
// Lives in WindowManager so the ghost outlives individual window unmounts.
// Ghost is self-clearing via setTimeout — never depends on animState going back to null.
//
// useLayoutEffect fires synchronously after DOM mutations, before the browser paints.
// This ensures phase:"start" (scale:0, no transition) is committed to the DOM before
// the rAF requests phase:"end" (scale:1, with transition) — giving CSS something to
// transition FROM. This also avoids the StrictMode double-effect problem because
// the fired Set guards re-entry by key.

function useAnimGhosts(windows: WindowInstance[]) {
  const [ghost, setGhost] = useState<ActiveGhost | null>(null);
  const fired = useRef<Set<string>>(new Set());

  useLayoutEffect(() => {
    for (const win of windows) {
      const curr = win.animState;
      if (!curr) continue;
      const key = `${win.id}:${curr}`;
      if (fired.current.has(key)) continue;
      fired.current.add(key);

      let spec: GhostSpec;
      let durationMs: number;

      if (curr === "opening") {
        spec = { type: "scale-in", rect: { x: win.position.x, y: win.position.y, width: win.size.width, height: win.size.height } };
        durationMs = ANIM_SCALE_MS;
      } else if (curr === "closing") {
        spec = { type: "scale-out", rect: { x: win.position.x, y: win.position.y, width: win.size.width, height: win.size.height } };
        durationMs = ANIM_SCALE_MS;
      } else if (curr === "minimizing") {
        spec = { type: "fly", from: { x: win.position.x, y: win.position.y, width: win.size.width, height: win.size.height }, to: getTaskbarRect(win.id) };
        durationMs = ANIM_FLY_MS;
      } else { // unminimizing
        spec = { type: "fly", from: getTaskbarRect(win.id), to: { x: win.position.x, y: win.position.y, width: win.size.width, height: win.size.height } };
        durationMs = ANIM_FLY_MS;
      }

      // phase:"start" → DOM commits it (no transition) → next two frames: phase:"end" triggers CSS transition
      setGhost({ spec, phase: "start" });
      requestAnimationFrame(() => requestAnimationFrame(() => {
        setGhost({ spec, phase: "end" });
      }));

      // Self-clear after animation completes — independent of window still existing
      setTimeout(() => {
        setGhost(null);
        fired.current.delete(key);
      }, durationMs + 50);
    }
  }); // no dep array — runs after every render, guard prevents double-fire

  return ghost;
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function WindowManager() {
  const { windows } = useWindowStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    registerBuiltinWindows();
    setReady(true);
  }, []);

  const ghost = useAnimGhosts(windows);

  if (!ready) return null;

  return (
    <>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {windows.map((win) => (
          <div key={win.id} className="pointer-events-auto">
            <WindowFrame window={win}>
              <WindowContent componentName={win.component} />
            </WindowFrame>
          </div>
        ))}
      </div>

      {/* Global ghost overlay — portal to body, survives window unmount */}
      {typeof document !== "undefined" && createPortal(
        <GhostOverlay ghost={ghost} />,
        document.body
      )}
    </>
  );
}

// ============================================================
// Window Content Loader
// ============================================================

function WindowContent({ componentName }: { componentName: string }) {
  const [Component, setComponent] = useState<ComponentType<any> | null>(
    () => getResolvedComponent(componentName)
  );
  const [loading, setLoading] = useState(!Component);

  useEffect(() => {
    if (Component) return;
    let cancelled = false;
    getWindowComponent(componentName).then((comp) => {
      if (!cancelled && comp) {
        setComponent(() => comp);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [componentName, Component]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-zinc-900">
        <div className="text-zinc-500 font-mono text-sm animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!Component) {
    return (
      <div className="flex items-center justify-center h-full bg-zinc-900">
        <div className="text-red-400 font-mono text-sm">Component &quot;{componentName}&quot; not found</div>
      </div>
    );
  }

  return <Component />;
}
