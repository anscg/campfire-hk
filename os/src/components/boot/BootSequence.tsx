"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

// ============================================================
// Boot Sequence — logo + Win95-style progress bar, ~5s, space to skip
// ============================================================

// Generate realistic-feeling progress waypoints:
// bursts of progress followed by pauses, totalling ~5000ms
function generateWaypoints(): { pct: number; time: number }[] {
  const points: { pct: number; time: number }[] = [{ pct: 0, time: 0 }];
  let pct = 0;
  let time = 0;

  while (pct < 100) {
    // Random pause before next burst (0–600ms), longer near 100%
    const pause = Math.random() * 500 + (pct > 80 ? 300 : 50);
    time += pause;

    // Burst size: small near end to build tension
    const maxBurst = pct > 85 ? 6 : pct > 60 ? 14 : 20;
    const burst = Math.random() * maxBurst + 2;
    pct = Math.min(100, pct + burst);

    points.push({ pct, time });
  }

  // Stretch or compress total time to land near 5000ms
  const scale = 5000 / time;
  return points.map((p) => ({ pct: p.pct, time: p.time * scale }));
}

interface BootSequenceProps {
  onComplete: () => void;
}

export default function BootSequence({ onComplete }: BootSequenceProps) {
  const [progress, setProgress] = useState(0);
  const waypointsRef = useRef(generateWaypoints());
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const doneRef = useRef(false);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setProgress(100);
    setTimeout(onComplete, 150);
  };

  useEffect(() => {
    const waypoints = waypointsRef.current;

    const step = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const elapsed = now - startRef.current;

      // Find current interpolated progress between waypoints
      let pct = 0;
      for (let i = 1; i < waypoints.length; i++) {
        const prev = waypoints[i - 1];
        const next = waypoints[i];
        if (elapsed <= next.time) {
          const t = (elapsed - prev.time) / (next.time - prev.time);
          pct = prev.pct + t * (next.pct - prev.pct);
          break;
        }
        pct = next.pct;
      }

      pct = Math.min(100, pct);
      setProgress(pct);

      if (pct < 100) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        finish();
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Space to skip (desktop) or tap to skip (mobile)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") finish();
    };
    const onTap = () => {
      finish();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("click", onTap);
    window.addEventListener("touchstart", onTap);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("click", onTap);
      window.removeEventListener("touchstart", onTap);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Detect mobile
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  // Filled block count for Win95 style (28 blocks on desktop, 20 on mobile)
  const BLOCKS = isMobile ? 20 : 28;
  const filled = Math.round((progress / 100) * BLOCKS);

  return (
    <div
      className="min-h-screen bg-black flex flex-col items-center justify-center gap-8 select-none"
      style={{ fontFamily: "var(--font-pixelify), sans-serif" }}
    >
      <LogoSweep isMobile={isMobile} />

      {/* Win95-style progress bar */}
      <div className="flex flex-col items-center gap-2">
        <div
          className="flex gap-[3px] p-[3px]"
          style={{ border: "1px solid #555" }}
        >
          {Array.from({ length: BLOCKS }).map((_, i) => (
            <div
              key={i}
              style={{
                width: isMobile ? 8 : 12,
                height: isMobile ? 14 : 20,
                background: i < filled ? "#fff" : "transparent",
                border: i < filled ? "none" : "1px solid #333",
              }}
            />
          ))}
        </div>
        <p className="text-zinc-600 text-xs" style={{ fontFamily: "var(--font-pixelify), sans-serif" }}>
          {isMobile ? "tap to skip" : "press space to skip"}
        </p>
      </div>
    </div>
  );
}

// ── Logo with sweep ───────────────────────────────────────────

function LogoSweep({ isMobile }: { isMobile: boolean }) {
  const size = isMobile ? { width: 280, height: 120 } : { width: 560, height: 240 };
  return (
    <div className="relative select-none" style={size}>
      <Image
        src="/logo.png"
        alt="Campfire OS"
        fill
        style={{ objectFit: "contain" }}
        priority
        draggable={false}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          maskImage: "url(/logo.png)",
          WebkitMaskImage: "url(/logo.png)",
          maskSize: "contain",
          WebkitMaskSize: "contain",
          maskRepeat: "no-repeat",
          WebkitMaskRepeat: "no-repeat",
          maskPosition: "center",
          WebkitMaskPosition: "center",
          overflow: "hidden",
        }}
      >
        <div className="logo-sweep-boot" />
      </div>

      <style>{`
        .logo-sweep-boot {
          position: absolute;
          top: -20%;
          left: -60%;
          width: 35%;
          height: 140%;
          background: linear-gradient(
            105deg,
            transparent 20%,
            rgba(255,255,255,0.7) 50%,
            transparent 80%
          );
          animation: logo-sweep-boot 1.5s ease-in-out infinite;
        }
        @keyframes logo-sweep-boot {
          0%   { left: -60%; }
          55%  { left: 130%; }
          100% { left: 130%; }
        }
      `}</style>
    </div>
  );
}
