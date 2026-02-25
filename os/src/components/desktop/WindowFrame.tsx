"use client";

import { useRef, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useWindowStore } from "@/stores/windowStore";
import { IconRenderer } from "@/lib/iconRenderer";
import type { WindowInstance } from "@/types";

interface WindowFrameProps {
  window: WindowInstance;
  children: ReactNode;
}

interface GhostRect { x: number; y: number; width: number; height: number }

const TASKBAR_H = 48;
const ANIM_MAXGHOST_MS = 150;

export default function WindowFrame({ window: win, children }: WindowFrameProps) {
  const {
    closeWindow,
    focusWindow,
    minimizeWindow,
    maximizeWindow,
    restoreWindow,
    updatePosition,
    activeWindowId,
    isMobile,
  } = useWindowStore();

  const nodeRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ startMouseX: number; startMouseY: number; startWinX: number; startWinY: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Resize ghost state
  const [resizeGhost, setResizeGhost] = useState<{ width: number; height: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);

  // Maximize ghost: from → to rects, animating flag
  const [maxGhost, setMaxGhost] = useState<{ from: GhostRect; to: GhostRect; animating: boolean } | null>(null);

  const isActive = activeWindowId === win.id;

  // Hide real window while open/close/minimize animations play — ghost in WindowManager handles visuals
  const hideRealWindow =
    win.animState === "closing" ||
    win.animState === "minimizing" ||
    win.animState === "opening" ||
    win.animState === "unminimizing";

  // ── Maximize ghost animation ───────────────────────────────────────────────

  const triggerMaximize = () => {
    const from: GhostRect = { x: win.position.x, y: win.position.y, width: win.size.width, height: win.size.height };
    const to: GhostRect = { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight - TASKBAR_H };
    setMaxGhost({ from, to, animating: false });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setMaxGhost((g) => g ? { ...g, animating: true } : null));
    });
    setTimeout(() => {
      maximizeWindow(win.id);
      setMaxGhost(null);
    }, ANIM_MAXGHOST_MS + 20);
  };

  const triggerRestore = () => {
    const pre = win.preMaximizeState;
    const to: GhostRect = pre
      ? { x: pre.position.x, y: pre.position.y, width: pre.size.width, height: pre.size.height }
      : { x: 80, y: 80, width: win.size.width, height: win.size.height };
    const from: GhostRect = { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight - TASKBAR_H };
    setMaxGhost({ from, to, animating: false });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setMaxGhost((g) => g ? { ...g, animating: true } : null));
    });
    setTimeout(() => {
      restoreWindow(win.id);
      setMaxGhost(null);
    }, ANIM_MAXGHOST_MS + 20);
  };

  // ── Drag ──────────────────────────────────────────────────────────────────

  const onDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (isMobile) return;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    dragState.current = {
      startMouseX: clientX,
      startMouseY: clientY,
      startWinX: win.position.x,
      startWinY: win.position.y,
    };
    setIsDragging(true);
    focusWindow(win.id);
    e.preventDefault();
  };

  useEffect(() => {
    const DRAG_THRESHOLD = 5;
    let unmaximizeHandled = false;

    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!dragState.current) return;
      const clientX = "touches" in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = "touches" in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;
      const dx = clientX - dragState.current.startMouseX;
      const dy = clientY - dragState.current.startMouseY;

      if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;

      if (win.isMaximized && !unmaximizeHandled) {
        unmaximizeHandled = true;
        const store = useWindowStore.getState();
        store.restoreWindow(win.id);
        const restoredW = win.preMaximizeState?.size.width ?? win.size.width;
        const newX = Math.min(Math.max(0, clientX - restoredW / 2), window.innerWidth - restoredW);
        const newY = Math.max(0, clientY - 20);
        store.updatePosition(win.id, { x: newX, y: newY });
        dragState.current = { startMouseX: clientX, startMouseY: clientY, startWinX: newX, startWinY: newY };
        return;
      }

      if (win.isMaximized) return;

      const newX = Math.max(-(win.size.width - 100), dragState.current.startWinX + dx);
      const newY = Math.max(0, dragState.current.startWinY + dy);
      updatePosition(win.id, { x: newX, y: newY });
    };
    const onUp = () => { dragState.current = null; unmaximizeHandled = false; setIsDragging(false); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [win.id, win.size.width, win.isMaximized, win.preMaximizeState, updatePosition]);

  // ── Resize (ghost box) ────────────────────────────────────────────────────

  useEffect(() => {
    if (isMobile || !resizeGhost) return;
    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      if (!resizeRef.current) return;
      const clientX = "touches" in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = "touches" in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;
      const newW = Math.max(win.minSize.width, resizeRef.current.startW + (clientX - resizeRef.current.startX));
      const newH = Math.max(win.minSize.height, resizeRef.current.startH + (clientY - resizeRef.current.startY));
      setResizeGhost({ width: newW, height: newH });
    };
    const handleMouseUp = () => {
      if (resizeRef.current && resizeGhost) {
        useWindowStore.getState().updateSize(win.id, resizeGhost);
      }
      setResizeGhost(null);
      resizeRef.current = null;
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("touchmove", handleMouseMove);
    document.addEventListener("touchend", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchmove", handleMouseMove);
      document.removeEventListener("touchend", handleMouseUp);
    };
  }, [resizeGhost, isMobile, win.id, win.minSize]);

  const startResize = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    resizeRef.current = { startX: clientX, startY: clientY, startW: win.size.width, startH: win.size.height };
    setResizeGhost({ width: win.size.width, height: win.size.height });
  };

  if (win.isMinimized) return null;

  const style: React.CSSProperties = isMobile || win.isMaximized
    ? {
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: `calc(100vh - ${TASKBAR_H}px)`,
        zIndex: win.zIndex,
        opacity: hideRealWindow ? 0 : 1,
        pointerEvents: hideRealWindow ? "none" : undefined,
      }
    : {
        position: "absolute",
        left: win.position.x,
        top: win.position.y,
        width: win.size.width,
        height: win.size.height,
        zIndex: win.zIndex,
        opacity: hideRealWindow ? 0 : 1,
        pointerEvents: hideRealWindow ? "none" : undefined,
      };

  const ghostRect = maxGhost ? (maxGhost.animating ? maxGhost.to : maxGhost.from) : null;

  return (
    <>
      <div
        ref={nodeRef}
        style={{
          ...style,
          border: "1px solid #fdb566",
          boxShadow: isDragging
            ? "8px 12px 0px rgba(255,255,255,0.15)"
            : "4px 6px 0px rgba(255,255,255,0.15)",
          transition: "box-shadow 0.2s ease",
        }}
        className="flex flex-col bg-zinc-900 overflow-hidden"
        onMouseDown={() => focusWindow(win.id)}
        onTouchStart={() => focusWindow(win.id)}
      >
        {/* Title Bar */}
        <div
          className="flex items-center h-10 px-3 bg-zinc-800 border-b border-[#fdb566]/40 select-none shrink-0"
          style={{ cursor: isMobile ? "default" : "grab" }}
          onMouseDown={onDragStart}
          onTouchStart={onDragStart}
          onDoubleClick={() => {
            if (isMobile) return;
            win.isMaximized ? triggerRestore() : triggerMaximize();
          }}
        >
          <span className="mr-2 flex items-center justify-center w-5 h-5">
            <IconRenderer icon={win.icon} size={16} />
          </span>
          <span className="text-xs font-mono text-zinc-300 flex-1 truncate">{win.title}</span>

          {/* Window Controls */}
          <div
            className="flex items-center gap-1"
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            {!isMobile && win.maximizable && (
              <button
                onClick={() => win.isMaximized ? triggerRestore() : triggerMaximize()}
                className="w-6 h-6 rounded flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700 transition-colors text-xs"
                title={win.isMaximized ? "Restore" : "Maximize"}
              >
                {win.isMaximized ? "◱" : "□"}
              </button>
            )}
            <button
              onClick={() => minimizeWindow(win.id)}
              className="w-6 h-6 rounded flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700 transition-colors text-xs"
              title="Minimize"
            >
              ─
            </button>
            {win.closable && (
              <button
                onClick={() => closeWindow(win.id)}
                className="w-6 h-6 rounded flex items-center justify-center text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors text-xs"
                title="Close"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">{children}</div>

        {/* Resize handle */}
        {!isMobile && win.resizable && !win.isMaximized && (
          <div
            onMouseDown={startResize}
            onTouchStart={startResize}
            className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-10"
            style={{ background: "linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.1) 50%)" }}
          />
        )}
      </div>

      {/* Resize ghost — portal so it's not clipped by the window */}
      {resizeGhost && typeof document !== "undefined" && createPortal(
        <div
          style={{
            position: "fixed",
            left: win.position.x,
            top: win.position.y,
            width: resizeGhost.width,
            height: resizeGhost.height,
            zIndex: 9999,
            pointerEvents: "none",
            border: "2px dashed rgba(255,255,255,0.45)",
            backgroundColor: "rgba(255,255,255,0.03)",
            boxSizing: "border-box",
          }}
        />,
        document.body
      )}

      {/* Maximize/restore ghost — portal, CSS transition animates from→to */}
      {ghostRect && typeof document !== "undefined" && createPortal(
        <div
          style={{
            position: "fixed",
            left: ghostRect.x,
            top: ghostRect.y,
            width: ghostRect.width,
            height: ghostRect.height,
            zIndex: 9998,
            pointerEvents: "none",
            border: "2px dashed rgba(255,255,255,0.45)",
            backgroundColor: "rgba(255,255,255,0.03)",
            boxSizing: "border-box",
            transition: `left ${ANIM_MAXGHOST_MS}ms ease, top ${ANIM_MAXGHOST_MS}ms ease, width ${ANIM_MAXGHOST_MS}ms ease, height ${ANIM_MAXGHOST_MS}ms ease`,
          }}
        />,
        document.body
      )}
    </>
  );
}
