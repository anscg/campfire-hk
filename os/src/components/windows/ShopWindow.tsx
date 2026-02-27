"use client";

import { useState, useRef, useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";
import { SHOP_ITEMS, AUCTION_ITEMS, type ShopItem, type AuctionItem } from "@/lib/shopItems";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

// ============================================================
// Shop Window
// ============================================================

type SortKey = "default" | "price-asc" | "price-desc" | "name-asc";

const SORT_LABELS: Record<SortKey, string> = {
  "default":    "Default",
  "price-asc":  "Price: Low → High",
  "price-desc": "Price: High → Low",
  "name-asc":   "Name: A → Z",
};

function sortItems(items: ShopItem[], sort: SortKey): ShopItem[] {
  const copy = [...items];
  if (sort === "price-asc")  return copy.sort((a, b) => a.price - b.price);
  if (sort === "price-desc") return copy.sort((a, b) => b.price - a.price);
  if (sort === "name-asc")   return copy.sort((a, b) => a.name.localeCompare(b.name));
  return copy;
}

export default function ShopWindow() {
  const { user, token, fetchUser } = useAuthStore();
  const [sort, setSort] = useState<SortKey>("default");
  const [sortOpen, setSortOpen] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [confirmItem, setConfirmItem] = useState<ShopItem | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const msgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showMessage = (msg: { type: "success" | "error"; text: string }) => {
    if (msgTimerRef.current) clearTimeout(msgTimerRef.current);
    setMessage(msg);
    msgTimerRef.current = setTimeout(() => setMessage(null), 3000);
  };

  const executePurchase = async (item: ShopItem) => {
    setPurchasing(item.id);
    setMessage(null);
    try {
      const res = await fetch(`${API_URL}/api/shop/purchase`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ itemId: item.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Purchase failed");
      showMessage({ type: "success", text: `Purchased ${item.name}!` });
      await fetchUser();
    } catch (e: any) {
      showMessage({ type: "error", text: e.message || "Purchase failed" });
    } finally {
      setPurchasing(null);
    }
  };

  const handleBuyClick = (item: ShopItem) => {
    if (!user || user.xp < item.price || item.tag === "TBC") return;
    setConfirmItem(item);
  };

  const handleConfirm = async () => {
    if (!confirmItem) return;
    const item = confirmItem;
    setConfirmItem(null);
    await executePurchase(item);
  };

  const displayItems = sortItems(SHOP_ITEMS, sort);

  // Group items by category when using default sort
  const grouped: { category: string; items: ShopItem[] }[] = [];
  if (sort === "default") {
    const seen = new Map<string, ShopItem[]>();
    for (const item of displayItems) {
      if (!seen.has(item.category)) seen.set(item.category, []);
      seen.get(item.category)!.push(item);
    }
    seen.forEach((items, category) => grouped.push({ category, items }));
  }

  return (
    <div className="h-full bg-zinc-900 flex flex-col font-mono relative">

      {/* Confirmation modal overlay */}
      {confirmItem && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.8)" }}
        >
          <div
            className="flex flex-col gap-4 p-5 w-72"
            style={{
              background: "#111113",
              border: "1px solid #3f3f46",
            }}
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl">{confirmItem.icon}</span>
              <div>
                <p className="text-xs font-bold tracking-widest text-white">{confirmItem.name}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">{confirmItem.description}</p>
              </div>
            </div>
            <div className="border border-zinc-800 px-3 py-2 flex items-center justify-between">
              <span className="text-[10px] text-zinc-500 tracking-widest">COST</span>
              <span className="text-sm font-bold text-yellow-400">{confirmItem.price} XP</span>
            </div>
            <div className="border border-zinc-800 px-3 py-2 flex items-center justify-between">
              <span className="text-[10px] text-zinc-500 tracking-widest">BALANCE AFTER</span>
              <span
                className="text-sm font-bold"
                style={{ color: (user?.xp ?? 0) - confirmItem.price < 0 ? "rgb(239,68,68)" : "rgba(255,255,255,0.7)" }}
              >
                {(user?.xp ?? 0) - confirmItem.price} XP
              </span>
            </div>
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => setConfirmItem(null)}
                className="flex-1 py-2 text-xs font-bold tracking-widest border"
                style={{ border: "1px solid #3f3f46", color: "#71717a", background: "transparent" }}
              >
                CANCEL
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 py-2 text-xs font-bold tracking-widest"
                style={{ background: "rgb(234,179,8)", color: "#000", border: "1px solid rgb(234,179,8)" }}
              >
                CONFIRM
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700">
        <span className="text-xs text-zinc-500 tracking-widest">SHOP</span>
        <div className="flex items-center gap-4">
          {user && (
            <span className="text-xs text-yellow-400 font-bold">{user.xp} XP</span>
          )}

          {/* Sort dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setSortOpen((o) => !o)}
              className="flex items-center gap-1.5 text-[10px] tracking-widest border border-zinc-700 px-2 py-1 text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors"
            >
              SORT
              <span style={{ fontSize: 8, lineHeight: 1 }}>{sortOpen ? "▲" : "▼"}</span>
            </button>

            {sortOpen && (
              <div className="absolute right-0 top-full mt-px z-50 bg-zinc-800 border border-zinc-600 min-w-[160px]">
                {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => { setSort(key); setSortOpen(false); }}
                    className="w-full text-left px-3 py-2 text-[10px] tracking-widest border-b border-zinc-700 last:border-b-0 hover:bg-zinc-700 transition-colors"
                    style={{
                      color: sort === key ? "rgb(234,179,8)" : "rgba(255,255,255,0.6)",
                      background: sort === key ? "rgba(234,179,8,0.08)" : "transparent",
                    }}
                  >
                    {sort === key && "✓ "}{SORT_LABELS[key].toUpperCase()}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Message banner */}
      {message && (
        <div
          className={`mx-4 mt-3 px-3 py-2 text-xs border ${
            message.type === "success"
              ? "border-green-700 bg-green-950 text-green-400"
              : "border-red-700 bg-red-950 text-red-400"
          }`}
        >
          {message.type === "success" ? "✓ " : "✗ "}{message.text}
        </div>
      )}

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto">

        {/* Regular items */}
        {sort === "default" ? (
          grouped.map(({ category, items }) => (
            <div key={category}>
              <div className="flex items-center gap-3 px-4 py-1.5 border-b border-zinc-800 bg-zinc-800/40">
                <span className="text-[10px] tracking-widest text-zinc-500 font-bold">{category.toUpperCase()}</span>
                <div className="flex-1 border-t border-zinc-700" />
              </div>
              {items.map((item) => (
                <ShopRow
                  key={item.id}
                  item={item}
                  userXp={user?.xp ?? 0}
                  purchasing={purchasing}
                  onBuy={handleBuyClick}
                />
              ))}
            </div>
          ))
        ) : (
          displayItems.map((item) => (
            <ShopRow
              key={item.id}
              item={item}
              userXp={user?.xp ?? 0}
              purchasing={purchasing}
              onBuy={handleBuyClick}
            />
          ))
        )}

        {/* Auction divider */}
        <div className="flex items-center gap-3 px-4 py-2 border-t border-b border-zinc-700 bg-zinc-800">
          <span className="text-[10px] tracking-widest text-zinc-400 font-bold">AUCTION</span>
          <div className="flex-1 border-t border-zinc-600" />
          <span className="text-[10px] text-zinc-500 tracking-widest">BID TO WIN</span>
        </div>

        {/* Auction items */}
        {AUCTION_ITEMS.map((item) => (
          <AuctionRow key={item.id} item={item} />
        ))}

      </div>
    </div>
  );
}

// ── Regular shop row ────────────────────────────────────────────────────────────

function ShopRow({
  item,
  userXp,
  purchasing,
  onBuy,
}: {
  item: ShopItem;
  userXp: number;
  purchasing: string | null;
  onBuy: (item: ShopItem) => void;
}) {
  const isTBC = item.tag === "TBC";
  const canAfford = !isTBC && userXp >= item.price;
  const isBuying = purchasing === item.id;
  const isLimited = item.stock !== null;

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors">
      <span className="text-xl w-7 text-center shrink-0">{item.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-bold text-white truncate">{item.name}</p>
          {item.tag && (
            <span
              className="text-[9px] font-bold tracking-widest px-1.5 py-0.5 border flex-shrink-0"
              style={{
                borderColor: item.tag === "TBC" ? "rgb(161,161,170)" : item.tag === "?" ? "rgb(113,113,122)" : "rgb(96,165,250)",
                color:       item.tag === "TBC" ? "rgb(161,161,170)" : item.tag === "?" ? "rgb(113,113,122)" : "rgb(96,165,250)",
              }}
            >
              {item.tag}
            </span>
          )}
        </div>
        <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">{item.description}</p>
      </div>
      <div className="shrink-0 flex flex-col items-end gap-1.5">
        <span className="text-xs font-bold text-yellow-400">
          {isTBC ? "TBC" : `${item.price} XP`}
        </span>
        {isLimited && (
          <span className="text-[9px] text-zinc-500 tracking-widest">
            x{item.stock} left
          </span>
        )}
        <button
          onClick={() => onBuy(item)}
          disabled={isBuying || !canAfford}
          className="px-3 py-1 text-[10px] font-bold tracking-widest border transition-colors"
          style={{
            background:    canAfford && !isBuying ? "rgb(234,179,8)" : "transparent",
            borderColor:   canAfford && !isBuying ? "rgb(234,179,8)" : "rgb(63,63,70)",
            color:         canAfford && !isBuying ? "#000" : "rgba(255,255,255,0.25)",
            cursor:        !canAfford || isBuying  ? "not-allowed" : "pointer",
          }}
        >
          {isBuying ? "..." : isTBC ? "TBC" : canAfford ? "BUY" : "N/A"}
        </button>
      </div>
    </div>
  );
}

// ── Auction row ─────────────────────────────────────────────────────────────────

function AuctionRow({ item }: { item: AuctionItem }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
      <span className="text-xl w-7 text-center shrink-0">{item.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white truncate">{item.name}</p>
        <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">{item.description}</p>
      </div>
      <div className="shrink-0 flex flex-col items-end gap-1.5">
        <span className="text-xs font-bold text-zinc-400 tracking-widest">??? XP</span>
        <span className="px-2 py-1 text-[10px] font-bold tracking-widest border border-zinc-600 text-zinc-500">
          AUCTION
        </span>
      </div>
    </div>
  );
}
