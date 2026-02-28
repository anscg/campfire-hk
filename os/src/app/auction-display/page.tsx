"use client";

import { useState, useEffect, useCallback } from "react";

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
  currentBidderId: string | null;
  recentBids: RecentBid[];
  winnerId: string | null;
  winnerName: string | null;
  winnerAmount: number | null;
}

// ── Paddle colors ─────────────────────────────────────────────────────────────

const PADDLE_COLORS = [
  "#ef4444", // red
  "#3b82f6", // blue
  "#22c55e", // green
  "#a855f7", // purple
  "#f97316", // orange
  "#06b6d4", // cyan
  "#eab308", // yellow
  "#ec4899", // pink
];

function paddleColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return PADDLE_COLORS[Math.abs(hash) % PADDLE_COLORS.length];
}

// ── Main display page ─────────────────────────────────────────────────────────

export default function AuctionDisplayPage() {
  const [state, setState] = useState<AuctionPublicState | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/auction/state/public`);
      if (res.ok) setState(await res.json());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 1000);
    return () => clearInterval(id);
  }, [poll]);

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
  return (
    <div
      className="flex flex-col items-center justify-center w-screen h-screen font-mono gap-8"
      style={{ background: "#0a0a0a" }}
    >
      {/* Item */}
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
        <p
          className="text-6xl font-bold tracking-wide"
          style={{ color: "rgb(234,179,8)" }}
        >
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
    </div>
  );
}

// ── Active Auction ────────────────────────────────────────────────────────────

function ActiveAuction({ state }: { state: AuctionPublicState }) {
  const currentBid = state.currentBid ?? state.startingBid;
  const nextBidMin = currentBid + 100;

  // Unique recent bidders (last 6, newest first)
  const paddleBidders = state.recentBids
    .reduce<RecentBid[]>((acc, b) => {
      if (!acc.find((x) => x.displayName === b.displayName)) acc.push(b);
      return acc;
    }, [])
    .slice(0, 6);

  return (
    <div
      className="flex flex-col w-screen h-screen font-mono overflow-hidden"
      style={{ background: "#0a0a0a" }}
    >
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
          {/* Item visual */}
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

          {/* Current bid */}
          <div className="text-center">
            <p
              className="text-xs tracking-widest mb-2"
              style={{ color: "rgba(255,255,255,0.35)" }}
            >
              CURRENT BID
            </p>
            <p
              className="font-bold leading-none"
              style={{ fontSize: "5rem", color: "rgba(255,255,255,0.95)" }}
            >
              {currentBid}
              <span
                className="text-3xl ml-3 font-bold"
                style={{ color: "rgb(234,179,8)" }}
              >
                XP
              </span>
            </p>
            {state.currentBidder && (
              <p
                className="text-sm tracking-wide mt-2"
                style={{ color: "rgba(255,255,255,0.45)" }}
              >
                {state.currentBidder}
              </p>
            )}

            {/* Next minimum bid hint */}
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
          {([100, 200, 300] as const).map((inc) => (
            <div
              key={inc}
              className="border px-4 py-3 text-center"
              style={{ borderColor: "rgba(255,255,255,0.12)" }}
            >
              <p className="text-xs tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>
                +{inc}
              </p>
              <p
                className="text-lg font-bold"
                style={{ color: "rgba(255,255,255,0.7)" }}
              >
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
          <p className="text-xs tracking-widest mr-2 flex-shrink-0" style={{ color: "rgba(255,255,255,0.3)" }}>
            BIDDERS
          </p>
          {paddleBidders.map((b, i) => {
            const color = paddleColor(b.displayName);
            return (
              <div
                key={i}
                className="flex items-center gap-2 border px-3 py-1.5 flex-shrink-0"
                style={{
                  borderColor: color,
                  background: `${color}18`,
                }}
              >
                <div
                  className="w-5 h-5 rounded-full flex-shrink-0"
                  style={{ background: color }}
                />
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
