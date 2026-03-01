"use client";

import { useState, useEffect, useRef } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

// ── Types ──────────────────────────────────────────────────────────────────────

interface RecentBid {
  displayName: string;
  amount: number;
  placedAt: number;
}

interface AuctionPublicState {
  active: boolean;
  itemId: string | null;
  itemName: string | null;
  itemDescription: string | null;
  itemIcon: string | null;
  itemImageUrl: string | null;
  startingBid: number;
  currentBid: number | null;
  currentBidder: string | null;
  recentBids: RecentBid[];
  goingPhase: null | "once" | "twice" | "sold";
  goingPhaseAt: number | null;
  winnerId: string | null;
  winnerName: string | null;
  winnerAmount: number | null;
}

// ── Paddle colors ─────────────────────────────────────────────────────────────

const PADDLE_COLORS = [
  "#ef4444",
  "#3b82f6",
  "#22c55e",
  "#a855f7",
  "#f97316",
  "#06b6d4",
  "#eab308",
  "#ec4899",
];

function paddleColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return PADDLE_COLORS[Math.abs(hash) % PADDLE_COLORS.length];
}

// ── Going-once overlay config ─────────────────────────────────────────────────

const GOING_PHASE_CONFIG = {
  once:  { label: "GOING ONCE",  color: "rgb(234,179,8)",  bg: "rgba(234,179,8,0.12)" },
  twice: { label: "GOING TWICE", color: "rgb(249,115,22)", bg: "rgba(249,115,22,0.12)" },
};

const BID_SFX_URL  = "https://cdn.hackclub.com/019ca521-a10c-7397-af31-7d39bdd661c8/bid_audio.mp4";
const SOLD_SFX_URL = "https://cdn.hackclub.com/019ca521-a276-744c-ac45-7cae7041babd/sold_audio.mp4";
const BGM_URL      = "https://cdn.hackclub.com/019ca521-baea-78bd-9f8c-6668cc5891e8/broken_brass_-_the_hitchhiker__official_video__-_broken_brass_audio.mp4";

// ── Main display page ─────────────────────────────────────────────────────────

export default function AuctionDisplayPage() {
  const [state, setState] = useState<AuctionPublicState | null>(null);
  const [unlocked, setUnlocked] = useState(false);

  // Web Audio refs — decoded into memory so playback is instant
  const audioCtxRef   = useRef<AudioContext | null>(null);
  const bidBufRef     = useRef<AudioBuffer | null>(null);
  const soldBufRef    = useRef<AudioBuffer | null>(null);
  const bgmRef        = useRef<HTMLAudioElement | null>(null);

  // Previous-state refs for change detection — updated directly in SSE handler
  const prevBidRef    = useRef<number | null>(null);
  const prevPhaseRef  = useRef<string | null>(null);
  const prevActiveRef = useRef<boolean | null>(null);

  function playBuf(buf: AudioBuffer | null) {
    const ctx = audioCtxRef.current;
    if (!ctx || !buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
  }

  // Decode a URL into an AudioBuffer
  async function loadBuf(url: string): Promise<AudioBuffer | null> {
    const ctx = audioCtxRef.current;
    if (!ctx) return null;
    try {
      const res = await fetch(url);
      const arr = await res.arrayBuffer();
      return await ctx.decodeAudioData(arr);
    } catch {
      return null;
    }
  }

  // SSE connection — audio triggers fire directly in onmessage, no React cycle
  useEffect(() => {
    const connect = () => {
      const es = new EventSource(`${API_URL}/api/auction/events/public`);
      es.onmessage = (e) => {
        let next: AuctionPublicState;
        try { next = JSON.parse(e.data); } catch { return; }

        const currentBid = next.currentBid ?? next.startingBid;
        const phase      = next.goingPhase;
        const active     = next.active;

        // First message — seed refs, no audio
        if (prevActiveRef.current === null) {
          prevBidRef.current    = currentBid;
          prevPhaseRef.current  = phase;
          prevActiveRef.current = active;
          setState(next);
          return;
        }

        // Audio triggers (only if unlocked)
        if (audioCtxRef.current) {
          // Auction started → start BGM
          if (active && prevActiveRef.current === false && !bgmRef.current) {
            const bgm = new Audio(BGM_URL);
            bgm.loop = true;
            bgm.volume = 0.7;
            bgm.play().catch(() => {});
            bgmRef.current = bgm;
          }

          // New bid → play bid SFX instantly
          if (active && currentBid !== prevBidRef.current) {
            playBuf(bidBufRef.current);
          }

          // SOLD → stop BGM + play sold SFX instantly
          if (phase === "sold" && prevPhaseRef.current !== "sold") {
            const bgm = bgmRef.current;
            if (bgm) { bgm.pause(); bgm.currentTime = 0; bgmRef.current = null; }
            playBuf(soldBufRef.current);
          }

          // Cancelled → stop BGM
          if (!active && prevActiveRef.current === true && phase !== "sold") {
            const bgm = bgmRef.current;
            if (bgm) { bgm.pause(); bgm.currentTime = 0; bgmRef.current = null; }
          }
        }

        prevBidRef.current    = currentBid;
        prevPhaseRef.current  = phase;
        prevActiveRef.current = active;
        setState(next);
      };
      es.onerror = () => {
        es.close();
        setTimeout(connect, 2000);
      };
      return es;
    };
    const es = connect();
    return () => es?.close();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // When unlocked → create AudioContext, decode both SFX into memory
  useEffect(() => {
    if (!unlocked) return;
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;

    // If auction already active when we unlock, start BGM
    if (prevActiveRef.current === true && !bgmRef.current) {
      const bgm = new Audio(BGM_URL);
      bgm.loop = true;
      bgm.volume = 0.7;
      bgm.play().catch(() => {});
      bgmRef.current = bgm;
    }

    // Decode SFX in parallel — fully buffered before first bid
    loadBuf(BID_SFX_URL).then(b  => { bidBufRef.current  = b; });
    loadBuf(SOLD_SFX_URL).then(b => { soldBufRef.current = b; });

    return () => { ctx.close(); };
  }, [unlocked]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stop BGM on unmount
  useEffect(() => {
    return () => {
      bgmRef.current?.pause();
      bgmRef.current = null;
    };
  }, []);

  // ── Audio unlock overlay ──
  if (!unlocked) {
    return (
      <div
        className="flex flex-col items-center justify-center w-screen h-screen font-mono cursor-pointer select-none"
        style={{ background: "#0a0a0a" }}
        onClick={() => {
          // Play a silent buffer to satisfy browser autoplay policy
          const ctx = new AudioContext();
          const buf = ctx.createBuffer(1, 1, 22050);
          const src = ctx.createBufferSource();
          src.buffer = buf;
          src.connect(ctx.destination);
          src.start(0);
          ctx.resume().then(() => ctx.close());
          setUnlocked(true);
        }}
      >
        <p className="text-7xl mb-6">🔊</p>
        <p className="text-2xl font-bold tracking-widest" style={{ color: "rgba(255,255,255,0.85)" }}>
          CLICK TO START
        </p>
        <p className="text-xs tracking-widest mt-3" style={{ color: "rgba(255,255,255,0.3)" }}>
          CAMPFIRE AUCTION · HONG KONG 2025
        </p>
      </div>
    );
  }

  // ── Winner celebration ──
  if (state && !state.active && state.winnerId) {
    return (
      <WinnerScreen
        itemName={state.itemName ?? "Item"}
        itemIcon={state.itemIcon ?? "🏆"}
        itemImageUrl={state.itemImageUrl}
        winnerName={state.winnerName ?? "Winner"}
        winnerAmount={state.winnerAmount ?? 0}
      />
    );
  }

  // ── Idle / loading ──
  if (!state || !state.active) {
    return <IdleScreen />;
  }

  // ── Active auction ──
  return <ActiveAuction state={state} />;
}

// ── Idle Screen ───────────────────────────────────────────────────────────────

function IdleScreen() {
  return (
    <div
      className="flex flex-col items-center justify-center w-screen h-screen font-mono"
      style={{ background: "#0a0a0a" }}
    >
      <div className="text-center space-y-4">
        <p className="text-7xl">🔨</p>
        <p
          className="text-4xl font-bold tracking-widest"
          style={{ color: "rgba(255,255,255,0.9)" }}
        >
          CAMPFIRE AUCTION
        </p>
        <p className="text-sm tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>
          HONG KONG 2025
        </p>
      </div>
    </div>
  );
}

// ── Winner Screen ─────────────────────────────────────────────────────────────

function WinnerScreen({
  itemName,
  itemIcon,
  itemImageUrl,
  winnerName,
  winnerAmount,
}: {
  itemName: string;
  itemIcon: string;
  itemImageUrl: string | null;
  winnerName: string;
  winnerAmount: number;
}) {
  // Show SOLD overlay for 3.5 seconds, then settle into the winner card
  const [showSold, setShowSold] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShowSold(false), 3500);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className="relative flex flex-col items-center justify-center w-screen h-screen font-mono gap-8"
      style={{ background: "#0a0a0a" }}
    >
      {showSold && (
        <SoldOverlay bidder={winnerName} amount={winnerAmount} />
      )}

      {!showSold && (
        <>
          {itemImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={itemImageUrl}
              alt={itemName}
              className="w-48 h-48 object-cover"
              style={{ border: "2px solid rgba(234,179,8,0.4)" }}
            />
          ) : (
            <p className="text-8xl">{itemIcon}</p>
          )}

          <div className="text-center space-y-2">
            <p className="text-lg tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>
              {itemName}
            </p>
            <p className="text-6xl font-bold tracking-wide" style={{ color: "rgb(234,179,8)" }}>
              {winnerName}
            </p>
            <p className="text-2xl font-bold" style={{ color: "rgba(255,255,255,0.6)" }}>
              {winnerAmount} XP
            </p>
          </div>

          <div
            className="border px-8 py-3 text-sm tracking-widest font-bold"
            style={{ borderColor: "rgb(234,179,8)", color: "rgb(234,179,8)" }}
          >
            WINNER
          </div>
        </>
      )}
    </div>
  );
}

// ── Going-once overlay ────────────────────────────────────────────────────────

function GoingPhaseOverlay({ phase }: { phase: "once" | "twice" }) {
  const cfg = GOING_PHASE_CONFIG[phase];
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none"
      style={{ background: cfg.bg }}
    >
      <p
        className="font-bold tracking-widest"
        style={{
          fontSize: "clamp(4rem, 12vw, 10rem)",
          color: cfg.color,
          textShadow: `0 0 80px ${cfg.color}80`,
          animation: "goingPulse 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        {cfg.label}
      </p>
      <style>{`
        @keyframes goingPulse {
          0%   { transform: scale(1.7); opacity: 0; }
          60%  { transform: scale(0.95); opacity: 1; }
          100% { transform: scale(1);   opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ── SOLD overlay ──────────────────────────────────────────────────────────────

function SoldOverlay({ bidder, amount }: { bidder: string | null; amount: number }) {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center z-30 pointer-events-none"
      style={{ background: "rgba(239,68,68,0.18)" }}
    >
      {/* Flash burst */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse at center, rgba(239,68,68,0.55) 0%, transparent 70%)",
          animation: "soldFlash 0.6s ease-out forwards",
        }}
      />

      {/* Gavel */}
      <p
        style={{
          fontSize: "clamp(3rem, 8vw, 7rem)",
          animation: "gavelHit 0.4s ease-out",
          marginBottom: "0.5rem",
        }}
      >
        🔨
      </p>

      {/* SOLD! text */}
      <p
        className="font-bold tracking-widest"
        style={{
          fontSize: "clamp(5rem, 18vw, 14rem)",
          color: "rgb(239,68,68)",
          textShadow: "0 0 120px rgba(239,68,68,0.8), 0 0 40px rgba(239,68,68,0.6)",
          lineHeight: 1,
          animation: "soldPop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        SOLD!
      </p>

      {/* Winner line */}
      {bidder && (
        <p
          className="font-bold tracking-widest mt-6"
          style={{
            fontSize: "clamp(1.5rem, 4vw, 3rem)",
            color: "rgba(255,255,255,0.9)",
            textShadow: "0 0 30px rgba(255,255,255,0.4)",
            animation: "soldFadeUp 0.4s 0.3s ease-out both",
          }}
        >
          {bidder} — {amount} XP
        </p>
      )}

      <style>{`
        @keyframes soldFlash {
          0%   { opacity: 1; }
          100% { opacity: 0.4; }
        }
        @keyframes gavelHit {
          0%   { transform: rotate(-45deg) scale(1.5); opacity: 0; }
          50%  { transform: rotate(10deg)  scale(1.1); opacity: 1; }
          100% { transform: rotate(0deg)   scale(1);   opacity: 1; }
        }
        @keyframes soldPop {
          0%   { transform: scale(1.7); opacity: 0; }
          60%  { transform: scale(0.93); opacity: 1; }
          100% { transform: scale(1);    opacity: 1; }
        }
        @keyframes soldFadeUp {
          0%   { transform: translateY(20px); opacity: 0; }
          100% { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ── Active Auction ────────────────────────────────────────────────────────────

function ActiveAuction({ state }: { state: AuctionPublicState }) {
  const currentBid = state.currentBid ?? state.startingBid;

  // Track bid changes to trigger bump animation
  const [bidKey, setBidKey] = useState(0);
  const prevBidRef = useRef(currentBid);
  useEffect(() => {
    if (currentBid !== prevBidRef.current) {
      prevBidRef.current = currentBid;
      setBidKey((k) => k + 1);
    }
  }, [currentBid]);
  const nextBidMin = currentBid + 50;

  // Unique recent bidders (last 6, newest first)
  const paddleBidders = state.recentBids
    .reduce<RecentBid[]>((acc, b) => {
      if (!acc.find((x) => x.displayName === b.displayName)) acc.push(b);
      return acc;
    }, [])
    .slice(0, 6);

  const phase = state.goingPhase;

  return (
    <div
      className="relative flex flex-col w-screen h-screen font-mono overflow-hidden"
      style={{ background: "#0a0a0a" }}
    >
      {/* Going-once overlay — key forces remount on each phase change so animation re-triggers */}
      {phase && phase !== "sold" && <GoingPhaseOverlay key={phase} phase={phase} />}

      {/* Top bar — item name */}
      <div
        className="flex items-center justify-between px-10 py-4 border-b"
        style={{ borderColor: "rgba(255,255,255,0.08)" }}
      >
        <div className="flex items-center gap-4">
          <span className="text-3xl">{state.itemIcon ?? "📦"}</span>
          <div>
            <p className="text-xl font-bold tracking-wide" style={{ color: "rgba(255,255,255,0.95)" }}>
              {state.itemName}
            </p>
            {state.itemDescription && (
              <p className="text-xs tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>
                {state.itemDescription}
              </p>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>
            CAMPFIRE AUCTION
          </p>
          <p className="text-xs tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>
            HONG KONG 2025
          </p>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 min-h-0">
        {/* Left — bid history */}
        <div
          className="flex flex-col w-56 border-r p-4 gap-2"
          style={{ borderColor: "rgba(255,255,255,0.08)" }}
        >
          <p className="text-xs tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.3)" }}>
            BID HISTORY
          </p>
          {state.recentBids.length === 0 && (
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>No bids yet</p>
          )}
          {state.recentBids.map((b, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-1.5 border-b"
              style={{
                borderColor: "rgba(255,255,255,0.06)",
                opacity: 1 - i * 0.08,
              }}
            >
              <span
                className="text-xs truncate mr-2 max-w-[100px]"
                style={{ color: i === 0 ? "rgb(234,179,8)" : "rgba(255,255,255,0.55)" }}
              >
                {b.displayName}
              </span>
              <span
                className="text-xs font-bold flex-shrink-0"
                style={{ color: i === 0 ? "rgb(234,179,8)" : "rgba(255,255,255,0.4)" }}
              >
                {b.amount}
              </span>
            </div>
          ))}
        </div>

        {/* Center — item image + current bid */}
        <div className="flex-1 flex flex-col items-center justify-center gap-8 px-12">
          {state.itemImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={state.itemImageUrl}
              alt={state.itemName ?? ""}
              className="object-contain"
              style={{
                maxHeight: "260px",
                maxWidth: "400px",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            />
          ) : (
            <p className="text-9xl">{state.itemIcon ?? "📦"}</p>
          )}

          <div className="text-center">
            <p
              className="text-xs tracking-widest mb-2"
              style={{ color: "rgba(255,255,255,0.35)" }}
            >
              CURRENT BID
            </p>
            <p
              key={bidKey}
              className="font-bold leading-none"
              style={{
                fontSize: "5rem",
                color: "rgba(255,255,255,0.95)",
                animation: bidKey > 0 ? "bidBump 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)" : undefined,
              }}
            >
              {currentBid}
              <span className="text-3xl ml-3 font-bold" style={{ color: "rgb(234,179,8)" }}>
                XP
              </span>
            </p>
            <style>{`
              @keyframes bidBump {
                0%   { transform: scale(1.35); color: rgb(234,179,8); }
                100% { transform: scale(1);    color: rgba(255,255,255,0.95); }
              }
            `}</style>
            {state.currentBidder && (
              <p className="text-sm tracking-wide mt-2" style={{ color: "rgba(255,255,255,0.45)" }}>
                {state.currentBidder}
              </p>
            )}

            <div
              className="flex items-center gap-3 mt-6 justify-center"
              style={{ color: "rgba(255,255,255,0.25)" }}
            >
              <span className="text-sm tracking-widest">NEXT BID FROM</span>
              <span className="text-xl font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>
                {nextBidMin} XP
              </span>
            </div>
          </div>
        </div>

        {/* Right — increment guide */}
        <div
          className="flex flex-col w-52 border-l p-4 gap-3 justify-center"
          style={{ borderColor: "rgba(255,255,255,0.08)" }}
        >
          <p className="text-xs tracking-widest mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>
            BID INCREMENTS
          </p>
          {([50, 100, 150] as const).map((inc) => (
            <div
              key={inc}
              className="border px-4 py-3 text-center"
              style={{ borderColor: "rgba(255,255,255,0.12)" }}
            >
              <p className="text-xs tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>
                +{inc}
              </p>
              <p className="text-lg font-bold" style={{ color: "rgba(255,255,255,0.7)" }}>
                {currentBid + inc} XP
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom — bidder paddles */}
      {paddleBidders.length > 0 && (
        <div
          className="border-t flex items-center gap-4 px-10 py-4"
          style={{ borderColor: "rgba(255,255,255,0.08)" }}
        >
          <p
            className="text-xs tracking-widest mr-2 flex-shrink-0"
            style={{ color: "rgba(255,255,255,0.3)" }}
          >
            BIDDERS
          </p>
          {paddleBidders.map((b, i) => {
            const color = paddleColor(b.displayName);
            return (
              <div
                key={i}
                className="flex items-center gap-2 border px-3 py-1.5 flex-shrink-0"
                style={{ borderColor: color, background: `${color}18` }}
              >
                <div className="w-5 h-5 rounded-full flex-shrink-0" style={{ background: color }} />
                <div>
                  <p className="text-xs font-bold leading-tight" style={{ color }}>
                    {b.displayName}
                  </p>
                  <p className="text-xs leading-tight" style={{ color: "rgba(255,255,255,0.45)" }}>
                    {b.amount} XP
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
