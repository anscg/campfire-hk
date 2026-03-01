"use client";

import { useState, useEffect, useRef } from "react";
import { useAuthStore } from "@/stores/authStore";

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
  goingPhase: null | "once" | "twice" | "sold";
  goingPhaseAt: number | null;
  winnerId: string | null;
  winnerName: string | null;
  winnerAmount: number | null;
}

// ── AuctionWindow ──────────────────────────────────────────────────────────────

export default function AuctionWindow() {
  const { token, user } = useAuthStore();
  const [state, setState] = useState<AuctionPublicState | null>(null);
  const [loading, setLoading] = useState(true);
  const [bidding, setBidding] = useState(false);
  const [bidResult, setBidResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const userId = (user as any)?._id ?? null;
  const userXP: number = (user as any)?.xp ?? 0;

  // Connect SSE — reconnects whenever token changes
  useEffect(() => {
    if (!token) return;
    const url = `${API_URL}/api/auction/events?token=${encodeURIComponent(token)}`;
    const connect = () => {
      const es = new EventSource(url);
      esRef.current = es;
      es.onmessage = (e) => {
        try {
          setState(JSON.parse(e.data));
          setLoading(false);
        } catch { /* ignore */ }
      };
      es.onerror = () => {
        es.close();
        // Reconnect after 2s on error
        setTimeout(connect, 2000);
      };
    };
    connect();
    return () => {
      esRef.current?.close();
      esRef.current = null;
    };
  }, [token]);

  const placeBid = async (increment: 50 | 100 | 150) => {
    if (!token) return;
    setBidding(true);
    setBidResult(null);
    try {
      const res = await fetch(`${API_URL}/api/auction/bid`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ increment }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBidResult({ ok: false, msg: data.error ?? "Bid failed" });
      } else {
        setBidResult({ ok: true, msg: `Bid placed: ${data.yourBid} XP` });
        // SSE will push the updated state automatically — no manual poll needed
      }
    } catch {
      setBidResult({ ok: false, msg: "Network error" });
    } finally {
      setBidding(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-zinc-900 font-mono text-zinc-500 text-xs tracking-widest">
        LOADING...
      </div>
    );
  }

  // ── Winner screen ──
  if (state && !state.active && state.winnerId) {
    const youWon = state.winnerId === userId;
    return (
      <div className="flex flex-col items-center justify-center h-full bg-zinc-900 font-mono gap-4 p-6 text-center">
        <p className="text-4xl">{state.itemIcon ?? "🏆"}</p>
        <p className="text-xs text-zinc-500 tracking-widest">AUCTION CLOSED</p>
        <p className="text-white font-bold text-lg">{state.itemName}</p>
        {youWon ? (
          <>
            <div className="border border-yellow-500 bg-yellow-950 px-4 py-3 w-full">
              <p className="text-yellow-400 font-bold tracking-widest text-sm">YOU WON!</p>
              <p className="text-yellow-300 text-xs mt-1">{state.winnerAmount} XP deducted</p>
            </div>
          </>
        ) : (
          <div className="border border-zinc-700 bg-zinc-800 px-4 py-3 w-full">
            <p className="text-zinc-400 text-xs tracking-widest">WINNER</p>
            <p className="text-white font-bold">{state.winnerName}</p>
            <p className="text-zinc-500 text-xs">{state.winnerAmount} XP</p>
          </div>
        )}
      </div>
    );
  }

  // ── Idle screen ──
  if (!state || !state.active) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-zinc-900 font-mono gap-3 text-center">
        <p className="text-4xl">🔨</p>
        <p className="text-sm font-bold text-white tracking-widest">CAMPFIRE AUCTION</p>
        <p className="text-xs text-zinc-500">No auction in progress</p>
        <p className="text-xs text-zinc-600">Check back when an item is announced</p>
      </div>
    );
  }

  // ── Active auction ──
  const currentBid = state.currentBid ?? state.startingBid;
  const isTopBidder = state.currentBidderId === userId;

  const canAfford = (increment: number) => userXP >= currentBid + increment;

  const goingPhase = state.goingPhase;
  const goingConfig = goingPhase
    ? { once: { label: "GOING ONCE — BID NOW!", color: "rgb(234,179,8)", bg: "rgba(234,179,8,0.1)", border: "rgb(234,179,8)" },
        twice: { label: "GOING TWICE — LAST CHANCE!", color: "rgb(249,115,22)", bg: "rgba(249,115,22,0.1)", border: "rgb(249,115,22)" },
        sold:  { label: "SOLD!", color: "rgb(239,68,68)", bg: "rgba(239,68,68,0.1)", border: "rgb(239,68,68)" },
      }[goingPhase]
    : null;

  return (
    <div className="flex flex-col h-full bg-zinc-900 font-mono">
      {/* Header */}
      <div className="border-b border-zinc-700 px-4 py-3 flex items-center gap-3">
        <span className="text-2xl">{state.itemIcon ?? "📦"}</span>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm truncate">{state.itemName}</p>
          <p className="text-zinc-500 text-xs truncate">{state.itemDescription}</p>
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="text-xs text-zinc-500 tracking-widest">YOUR XP</p>
          <p className="text-yellow-400 font-bold text-sm">{userXP}</p>
        </div>
      </div>

      {/* Going-once banner */}
      {goingConfig && (
        <div
          className="px-4 py-2 text-xs font-bold tracking-widest text-center border-b"
          style={{ background: goingConfig.bg, color: goingConfig.color, borderColor: goingConfig.border }}
        >
          {goingConfig.label}
        </div>
      )}

      {/* Current bid display */}
      <div className="border-b border-zinc-700 px-4 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-zinc-500 tracking-widest mb-1">CURRENT BID</p>
          <p className="text-3xl font-bold text-white">{currentBid} <span className="text-lg text-yellow-400">XP</span></p>
          {state.currentBidder ? (
            <p className="text-xs mt-1" style={{ color: isTopBidder ? "rgb(234,179,8)" : "rgb(113,113,122)" }}>
              {isTopBidder ? "★ YOU ARE LEADING" : `Leading: ${state.currentBidder}`}
            </p>
          ) : (
            <p className="text-xs text-zinc-600 mt-1">Starting bid — be the first!</p>
          )}
        </div>
        {state.itemImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={state.itemImageUrl} alt={state.itemName ?? ""} className="w-16 h-16 object-cover border border-zinc-700" />
        )}
      </div>

      {/* Bid buttons */}
      <div className="px-4 py-4 border-b border-zinc-700">
        <p className="text-xs text-zinc-500 tracking-widest mb-3">PLACE BID</p>
        <div className="flex gap-2">
          {([50, 100, 150] as const).map((inc) => {
            const bidAmount = currentBid + inc;
            const disabled = bidding || isTopBidder || !canAfford(inc);
            return (
              <button
                key={inc}
                onClick={() => placeBid(inc)}
                disabled={disabled}
                className="flex-1 py-3 text-xs font-bold tracking-widest border transition-colors"
                style={{
                  background: disabled ? "transparent" : "rgb(234,179,8)",
                  borderColor: disabled ? "rgb(63,63,70)" : "rgb(234,179,8)",
                  color: disabled ? "rgba(255,255,255,0.25)" : "#000",
                  cursor: disabled ? "not-allowed" : "pointer",
                }}
              >
                <span className="block text-sm">+{inc}</span>
                <span className="block text-xs opacity-70">{bidAmount} XP</span>
              </button>
            );
          })}
        </div>
        {isTopBidder && (
          <p className="text-xs text-yellow-500 mt-2 tracking-widest text-center">
            ★ You are already the top bidder
          </p>
        )}
        {bidResult && (
          <div
            className={`mt-2 border px-3 py-2 text-xs ${
              bidResult.ok
                ? "border-green-700 bg-green-950 text-green-400"
                : "border-red-700 bg-red-950 text-red-400"
            }`}
          >
            {bidResult.ok ? "✓ " : "✗ "}{bidResult.msg}
          </div>
        )}
      </div>

      {/* Recent bids */}
      <div className="flex-1 overflow-y-auto">
        <p className="px-4 py-2 text-xs text-zinc-600 tracking-widest border-b border-zinc-800">
          RECENT BIDS ({state.recentBids.length})
        </p>
        {state.recentBids.length === 0 && (
          <div className="flex items-center justify-center h-16 text-zinc-600 text-xs">
            No bids yet
          </div>
        )}
        {state.recentBids.map((b, i) => (
          <div key={i} className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
            <span className="text-xs text-zinc-300">{b.displayName}</span>
            <span className="text-xs font-bold text-yellow-400">{b.amount} XP</span>
          </div>
        ))}
      </div>
    </div>
  );
}
