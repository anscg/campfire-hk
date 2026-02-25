"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/stores/authStore";

// ============================================================
// Receipts Window — full transaction ledger for the current user
// ============================================================

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface Transaction {
  _id: string;
  type: "purchase" | "earn" | "refund" | "send";
  amount: number;
  description: string;
  createdAt: number;
  itemId?: string;
}

type FilterKey = "all" | "purchase" | "earn" | "refund" | "send";

const TYPE_LABEL: Record<Transaction["type"], string> = {
  purchase: "PURCHASE",
  earn:     "EARNED",
  refund:   "REFUND",
  send:     "SENT",
};

const TYPE_COLOR: Record<Transaction["type"], string> = {
  purchase: "rgb(251,191,36)",   // yellow-400 — spent
  earn:     "rgb(34,197,94)",    // green-500  — gained
  refund:   "rgb(99,102,241)",   // indigo-500 — refunded
  send:     "rgb(251,191,36)",   // yellow-400 — sent out
};

// positive delta from user's perspective
function delta(tx: Transaction): number {
  if (tx.type === "earn" || tx.type === "refund") return +tx.amount;
  return -tx.amount;
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleString("en-HK", {
    month: "short",
    day:   "numeric",
    hour:  "2-digit",
    minute:"2-digit",
  });
}

export default function ReceiptsWindow() {
  const { token } = useAuthStore();
  const [txs, setTxs]         = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [filter, setFilter]   = useState<FilterKey>("all");

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/transactions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load");
      const data: Transaction[] = await res.json();
      setTxs(data);
    } catch (e: any) {
      setError(e.message || "Failed to load transactions");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const visible = filter === "all" ? txs : txs.filter((t) => t.type === filter);

  // Tallies
  const totalSpent  = txs.filter((t) => t.type === "purchase" || t.type === "send").reduce((s, t) => s + t.amount, 0);
  const totalEarned = txs.filter((t) => t.type === "earn"     || t.type === "refund").reduce((s, t) => s + t.amount, 0);

  const FILTERS: { key: FilterKey; label: string }[] = [
    { key: "all",      label: "ALL"      },
    { key: "earn",     label: "EARNED"   },
    { key: "purchase", label: "PURCHASE" },
    { key: "send",     label: "SENT"     },
    { key: "refund",   label: "REFUND"   },
  ];

  return (
    <div className="h-full bg-zinc-900 flex flex-col font-mono">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700">
        <span className="text-xs text-zinc-500 tracking-widest">RECEIPTS</span>
        <button
          onClick={load}
          className="text-[10px] tracking-widest text-zinc-500 hover:text-white border border-zinc-700 px-2 py-1 transition-colors"
        >
          ↺ REFRESH
        </button>
      </div>

      {/* ── Summary bar ── */}
      <div className="grid grid-cols-2 border-b border-zinc-700">
        <div className="px-4 py-3 border-r border-zinc-700">
          <p className="text-[10px] text-zinc-500 tracking-widest mb-0.5">TOTAL EARNED</p>
          <p className="text-lg font-bold text-green-400">+{totalEarned} XP</p>
        </div>
        <div className="px-4 py-3">
          <p className="text-[10px] text-zinc-500 tracking-widest mb-0.5">TOTAL SPENT</p>
          <p className="text-lg font-bold text-yellow-400">-{totalSpent} XP</p>
        </div>
      </div>

      {/* ── Filter tab bar ── */}
      <div className="flex border-b border-zinc-700 overflow-x-auto">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className="flex-1 py-2 text-[10px] tracking-widest transition-colors shrink-0"
            style={{
              background:  filter === key ? "rgb(234,179,8)" : "transparent",
              color:       filter === key ? "#000" : "rgba(255,255,255,0.4)",
              fontWeight:  filter === key ? "700" : "400",
              borderRight: "1px solid rgb(63,63,70)",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── List ── */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center h-32 text-zinc-500 text-xs tracking-widest">
            LOADING...
          </div>
        )}

        {!loading && error && (
          <div className="m-4 border border-red-700 bg-red-950 px-3 py-2 text-xs text-red-400">
            ✗ {error}
          </div>
        )}

        {!loading && !error && visible.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-zinc-600 text-xs tracking-widest text-center px-4">
            <span style={{ fontSize: 28 }}>🧾</span>
            NO TRANSACTIONS
          </div>
        )}

        {!loading && !error && visible.map((tx, i) => {
          const d = delta(tx);
          const isPositive = d > 0;

          return (
            <div
              key={tx._id}
              className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 hover:bg-zinc-800/40 transition-colors"
            >
              {/* Type badge */}
              <div
                className="shrink-0 text-[9px] font-bold tracking-widest px-1.5 py-0.5 border"
                style={{
                  borderColor: TYPE_COLOR[tx.type],
                  color:       TYPE_COLOR[tx.type],
                }}
              >
                {TYPE_LABEL[tx.type]}
              </div>

              {/* Description + date */}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white font-bold truncate">{tx.description}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">{formatDate(tx.createdAt)}</p>
              </div>

              {/* Delta */}
              <span
                className="shrink-0 text-sm font-bold tabular-nums"
                style={{ color: isPositive ? "rgb(34,197,94)" : "rgb(251,191,36)" }}
              >
                {isPositive ? "+" : ""}{d} XP
              </span>
            </div>
          );
        })}

        {/* Running total footer when filtered */}
        {!loading && !error && filter !== "all" && visible.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-700 bg-zinc-800">
            <span className="text-[10px] text-zinc-500 tracking-widest">{visible.length} TRANSACTION{visible.length !== 1 ? "S" : ""}</span>
            <span className="text-xs font-bold text-zinc-300 tabular-nums">
              {(() => {
                const sum = visible.reduce((s, t) => s + delta(t), 0);
                return `${sum >= 0 ? "+" : ""}${sum} XP`;
              })()}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
