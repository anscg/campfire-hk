"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/stores/authStore";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ShopOrder {
  _id: string;
  userId: string;
  itemId: string;
  itemName: string;
  itemIcon: string;
  price: number;
  status: "pending" | "fulfilled" | "cancelled";
  fulfilledBy?: string;
  fulfilledAt?: number;
  note?: string;
  createdAt: number;
  userName: string;
  userEmail: string;
  fulfilledByName?: string | null;
}

type FilterTab = "all" | "pending" | "fulfilled" | "cancelled";

function formatDate(ts: number) {
  return new Date(ts).toLocaleString("en-HK", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ShopcampfyWindow() {
  const { token, user } = useAuthStore();
  const isAdmin = (user as any)?.isAdmin === true;

  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<FilterTab>("pending");
  const [actionOrder, setActionOrder] = useState<ShopOrder | null>(null);
  const [actionType, setActionType] = useState<"fulfil" | "cancel" | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setOrders(await res.json());
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full bg-zinc-900 font-mono">
        <p className="text-xs text-zinc-500 tracking-widest">LOADING...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-zinc-900 font-mono gap-3">
        <p className="text-4xl">🚫</p>
        <p className="text-red-400 text-sm font-bold tracking-widest">ACCESS DENIED</p>
        <p className="text-xs text-zinc-500">Admin privileges required</p>
      </div>
    );
  }

  const counts = {
    all: orders.length,
    pending: orders.filter((o) => o.status === "pending").length,
    fulfilled: orders.filter((o) => o.status === "fulfilled").length,
    cancelled: orders.filter((o) => o.status === "cancelled").length,
  };

  const filtered =
    tab === "all" ? orders : orders.filter((o) => o.status === tab);

  const handleAction = async () => {
    if (!actionOrder || !actionType) return;
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch(
        `${API_URL}/api/admin/orders/${actionOrder._id}/${actionType}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ note: note || undefined }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setResult({
        ok: true,
        msg:
          actionType === "fulfil"
            ? `Order fulfilled for ${actionOrder.userName}`
            : `Order cancelled — ${actionOrder.price} XP refunded to ${actionOrder.userName}`,
      });
      await load();
      setTimeout(() => {
        setActionOrder(null);
        setActionType(null);
        setNote("");
        setResult(null);
      }, 1800);
    } catch (e: any) {
      setResult({ ok: false, msg: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Action confirmation panel ──
  if (actionOrder && actionType) {
    const isFulfil = actionType === "fulfil";
    return (
      <div className="flex flex-col h-full bg-zinc-900 font-mono">
        <div className="flex items-center gap-3 border-b border-zinc-700 px-4 py-3">
          <button
            onClick={() => {
              setActionOrder(null);
              setActionType(null);
              setNote("");
              setResult(null);
            }}
            className="text-xs text-zinc-500 tracking-widest border border-zinc-700 px-2 py-1 hover:text-white"
          >
            ← BACK
          </button>
          <p className="text-xs text-zinc-400 tracking-widest">
            {isFulfil ? "FULFIL ORDER" : "CANCEL ORDER"}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {/* Order summary */}
          <div className="border border-zinc-700 bg-zinc-800 p-3">
            <p className="text-xs text-zinc-500 tracking-widest mb-2">ORDER</p>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{actionOrder.itemIcon}</span>
              <div>
                <p className="text-white font-bold text-sm">{actionOrder.itemName}</p>
                <p className="text-xs text-zinc-500">{actionOrder.price} XP</p>
              </div>
            </div>
          </div>

          {/* Buyer */}
          <div className="border border-zinc-700 bg-zinc-800 p-3">
            <p className="text-xs text-zinc-500 tracking-widest mb-1">BUYER</p>
            <p className="text-white font-bold">{actionOrder.userName}</p>
            <p className="text-xs text-zinc-500">{actionOrder.userEmail}</p>
          </div>

          {/* Refund notice */}
          {!isFulfil && (
            <div className="border border-yellow-700 bg-yellow-950 px-3 py-2">
              <p className="text-xs text-yellow-400 tracking-widest">
                ⚠ {actionOrder.price} XP WILL BE REFUNDED
              </p>
            </div>
          )}

          {/* Note */}
          <div>
            <p className="text-xs text-zinc-500 tracking-widest mb-1">NOTE (OPTIONAL)</p>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={isFulfil ? "e.g. Handed out at booth #3" : "e.g. Out of stock"}
              className="w-full bg-zinc-800 border border-zinc-700 px-3 py-2 text-xs text-white placeholder-zinc-600 outline-none"
            />
          </div>

          {result && (
            <div
              className={`border px-3 py-2 text-xs ${
                result.ok
                  ? "border-green-700 bg-green-950 text-green-400"
                  : "border-red-700 bg-red-950 text-red-400"
              }`}
            >
              {result.ok ? "✓ " : "✗ "}
              {result.msg}
            </div>
          )}

          <button
            onClick={handleAction}
            disabled={submitting}
            className="mt-auto w-full py-3 text-xs font-bold tracking-widest border"
            style={{
              background: isFulfil ? "rgb(234,179,8)" : "rgb(239,68,68)",
              borderColor: isFulfil ? "rgb(234,179,8)" : "rgb(239,68,68)",
              color: "#000",
              cursor: submitting ? "not-allowed" : "pointer",
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting
              ? isFulfil
                ? "FULFILLING..."
                : "CANCELLING..."
              : isFulfil
              ? "CONFIRM FULFIL"
              : "CONFIRM CANCEL + REFUND"}
          </button>
        </div>
      </div>
    );
  }

  // ── Main order list ──
  const TABS: FilterTab[] = ["pending", "fulfilled", "cancelled", "all"];

  return (
    <div className="flex flex-col h-full bg-zinc-900 font-mono">
      {/* Tab bar */}
      <div className="flex border-b border-zinc-700">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 py-2 text-xs tracking-widest transition-colors flex items-center justify-center gap-1"
            style={{
              background: tab === t ? "rgb(234,179,8)" : "transparent",
              color: tab === t ? "#000" : "rgba(255,255,255,0.5)",
              fontWeight: tab === t ? "700" : "400",
              borderRight: "1px solid rgb(63,63,70)",
            }}
          >
            {t.toUpperCase()}
            {counts[t] > 0 && (
              <span
                className="text-xs px-1 leading-none"
                style={{
                  background: tab === t ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.12)",
                  color: tab === t ? "#000" : "rgba(255,255,255,0.6)",
                }}
              >
                {counts[t]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
        <span className="text-xs text-zinc-500 tracking-widest">
          {filtered.length} ORDER{filtered.length !== 1 ? "S" : ""}
        </span>
        <button
          onClick={load}
          className="text-xs text-zinc-500 hover:text-white tracking-widest"
        >
          ↺ REFRESH
        </button>
      </div>

      {/* Order list */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center h-20 text-zinc-500 text-xs">
            LOADING...
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex items-center justify-center h-32 text-zinc-600 text-xs tracking-widest">
            NO {tab === "all" ? "" : tab.toUpperCase() + " "}ORDERS
          </div>
        )}

        {!loading &&
          filtered.map((order) => (
            <OrderRow
              key={order._id}
              order={order}
              onFulfil={() => {
                setActionOrder(order);
                setActionType("fulfil");
                setNote("");
                setResult(null);
              }}
              onCancel={() => {
                setActionOrder(order);
                setActionType("cancel");
                setNote("");
                setResult(null);
              }}
            />
          ))}
      </div>
    </div>
  );
}

// ── Order row ─────────────────────────────────────────────────────────────────

function OrderRow({
  order,
  onFulfil,
  onCancel,
}: {
  order: ShopOrder;
  onFulfil: () => void;
  onCancel: () => void;
}) {
  const statusColor =
    order.status === "pending"
      ? "rgb(234,179,8)"
      : order.status === "fulfilled"
      ? "rgb(34,197,94)"
      : "rgb(113,113,122)";

  return (
    <div className="border-b border-zinc-800 px-4 py-3">
      <div className="flex items-start gap-3">
        {/* Icon */}
        <span className="text-xl w-7 text-center mt-0.5 flex-shrink-0">
          {order.itemIcon}
        </span>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-white">{order.itemName}</p>
            <span
              className="text-xs tracking-widest px-1 flex-shrink-0"
              style={{
                border: `1px solid ${statusColor}`,
                color: statusColor,
              }}
            >
              {order.status.toUpperCase()}
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            {order.userName}
            <span className="text-zinc-600"> · {order.userEmail}</span>
          </p>
          <p className="text-xs text-zinc-600 mt-0.5">
            {order.price} XP · {formatDate(order.createdAt)}
          </p>
          {order.note && (
            <p className="text-xs text-zinc-500 italic mt-0.5">"{order.note}"</p>
          )}
          {order.fulfilledByName && order.fulfilledAt && (
            <p className="text-xs text-zinc-600 mt-0.5">
              {order.status === "cancelled" ? "Cancelled" : "Fulfilled"} by{" "}
              {order.fulfilledByName} · {formatDate(order.fulfilledAt)}
            </p>
          )}
        </div>
      </div>

      {/* Action buttons for pending orders */}
      {order.status === "pending" && (
        <div className="flex gap-2 mt-2 ml-10">
          <button
            onClick={onFulfil}
            className="px-3 py-1 text-xs font-bold tracking-widest border"
            style={{
              background: "rgb(234,179,8)",
              borderColor: "rgb(234,179,8)",
              color: "#000",
            }}
          >
            FULFIL
          </button>
          <button
            onClick={onCancel}
            className="px-3 py-1 text-xs font-bold tracking-widest border"
            style={{
              background: "transparent",
              borderColor: "rgb(239,68,68)",
              color: "rgb(239,68,68)",
            }}
          >
            CANCEL
          </button>
        </div>
      )}
    </div>
  );
}
