"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useAuthStore } from "@/stores/authStore";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

// ── Types ─────────────────────────────────────────────────────────────────────

interface StockPrice {
  ticker: string;
  name: string;
  icon: string;
  startPrice: number;
  price: number;
  history: number[];
  updatedAt: number;
}

interface Holding {
  ticker: string;
  shares: number;
  avgBuyPrice: number;
}

// ── Sparkline (used in stock list rows) ──────────────────────────────────────

function Sparkline({
  history,
  width = 80,
  height = 28,
}: {
  history: number[];
  width?: number;
  height?: number;
}) {
  if (history.length < 2) return <div style={{ width, height }} />;

  const min = Math.min(...history);
  const max = Math.max(...history);
  const range = max - min || 1;

  const pts = history.map((v, i) => {
    const x = (i / (history.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const first = history[0];
  const last = history[history.length - 1];
  const up = last >= first;
  const color = up ? "#22c55e" : "#ef4444";

  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ── Full trading chart (used in selected stock detail panel) ──────────────────

function TradingChart({ history }: { history: number[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<{ x: number; y: number; price: number; idx: number } | null>(null);

  const W = 360;
  const H = 120;
  const PAD_LEFT = 44;
  const PAD_RIGHT = 8;
  const PAD_TOP = 8;
  const PAD_BOTTOM = 28; // room for volume bars + x axis labels
  const VOL_H = 18;      // height reserved for volume bars at bottom
  const CHART_H = H - PAD_TOP - PAD_BOTTOM;
  const CHART_W = W - PAD_LEFT - PAD_RIGHT;

  const data = history.length >= 2 ? history : history.length === 1 ? [history[0], history[0]] : [0, 0];

  const minP = Math.min(...data);
  const maxP = Math.max(...data);
  const range = maxP - minP || Math.max(1, minP * 0.05);
  const paddedMin = minP - range * 0.08;
  const paddedMax = maxP + range * 0.08;
  const pRange = paddedMax - paddedMin;

  const toX = (i: number) => PAD_LEFT + (i / (data.length - 1)) * CHART_W;
  const toY = (p: number) => PAD_TOP + CHART_H - ((p - paddedMin) / pRange) * CHART_H;

  // Polyline points
  const pts = data.map((p, i) => `${toX(i).toFixed(1)},${toY(p).toFixed(1)}`).join(" ");

  // Fill path (area under line)
  const firstX = toX(0);
  const lastX = toX(data.length - 1);
  const baseY = PAD_TOP + CHART_H;
  const fillPath = `M${firstX.toFixed(1)},${baseY.toFixed(1)} ` +
    data.map((p, i) => `L${toX(i).toFixed(1)},${toY(p).toFixed(1)}`).join(" ") +
    ` L${lastX.toFixed(1)},${baseY.toFixed(1)} Z`;

  const isUp = data[data.length - 1] >= data[0];
  const lineColor = isUp ? "#22c55e" : "#ef4444";
  const fillColor = isUp ? "rgba(34,197,94,0.07)" : "rgba(239,68,68,0.07)";

  // Grid lines (4 horizontal price levels)
  const gridLevels = useMemo(() => {
    const levels = [];
    for (let i = 0; i <= 3; i++) {
      const p = paddedMin + (pRange * i) / 3;
      levels.push({ price: p, y: toY(p) });
    }
    return levels;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paddedMin, pRange, PAD_TOP, CHART_H]);

  // Volume-like bars (proxy: |price change| → bar height)
  const volBars = useMemo(() => {
    if (data.length < 2) return [];
    const diffs = data.slice(1).map((p, i) => Math.abs(p - data[i]));
    const maxDiff = Math.max(...diffs, 0.01);
    return diffs.map((d, i) => ({
      x: toX(i + 1),
      h: (d / maxDiff) * (VOL_H - 2),
      up: data[i + 1] >= data[i],
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // OHLC derived from history
  const open = data[0];
  const close = data[data.length - 1];
  const high = Math.max(...data);
  const low = Math.min(...data);

  // X-axis tick labels (show ~4 ticks)
  const xTicks = useMemo(() => {
    const ticks = [];
    const step = Math.max(1, Math.floor((data.length - 1) / 3));
    for (let i = 0; i < data.length; i += step) {
      ticks.push({ i, x: toX(i), label: `-${data.length - 1 - i}` });
    }
    return ticks;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.length]);

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * W;
    // clamp to chart area
    const cx = Math.max(PAD_LEFT, Math.min(PAD_LEFT + CHART_W, mx));
    const frac = (cx - PAD_LEFT) / CHART_W;
    const rawIdx = frac * (data.length - 1);
    const idx = Math.round(rawIdx);
    const clampedIdx = Math.max(0, Math.min(data.length - 1, idx));
    const price = data[clampedIdx];
    setHover({ x: toX(clampedIdx), y: toY(price), price, idx: clampedIdx });
  }

  return (
    <div className="flex flex-col gap-1.5">
      {/* OHLC stats row */}
      <div className="flex gap-3 text-xs font-mono px-0.5">
        {[
          { label: "O", val: open, color: "#a1a1aa" },
          { label: "H", val: high, color: "#22c55e" },
          { label: "L", val: low, color: "#ef4444" },
          { label: "C", val: close, color: isUp ? "#22c55e" : "#ef4444" },
        ].map(({ label, val, color }) => (
          <span key={label} className="text-zinc-500">
            {label}<span className="ml-0.5" style={{ color }}>{val.toFixed(2)}</span>
          </span>
        ))}
        {hover && (
          <span className="ml-auto text-zinc-400">
            #{hover.idx + 1} <span style={{ color: lineColor }}>{hover.price.toFixed(2)}</span>
          </span>
        )}
      </div>

      {/* SVG chart */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ display: "block", cursor: "crosshair" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
      >
        {/* Horizontal grid lines */}
        {gridLevels.map(({ price, y }, gi) => (
          <g key={gi}>
            <line
              x1={PAD_LEFT} y1={y.toFixed(1)}
              x2={PAD_LEFT + CHART_W} y2={y.toFixed(1)}
              stroke="#27272a" strokeWidth="1"
            />
            <text
              x={(PAD_LEFT - 3).toFixed(1)} y={(y + 3.5).toFixed(1)}
              textAnchor="end" fontSize="7" fill="#52525b" fontFamily="monospace"
            >
              {price.toFixed(0)}
            </text>
          </g>
        ))}

        {/* Area fill */}
        <path d={fillPath} fill={fillColor} />

        {/* Price line */}
        <polyline
          points={pts}
          fill="none"
          stroke={lineColor}
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Volume bars at bottom */}
        {volBars.map((b, i) => {
          const barW = Math.max(1, CHART_W / data.length - 1);
          const by = H - PAD_BOTTOM + (VOL_H - 2 - b.h);
          return (
            <rect
              key={i}
              x={(b.x - barW / 2).toFixed(1)}
              y={by.toFixed(1)}
              width={Math.max(1, barW - 1).toFixed(1)}
              height={Math.max(1, b.h).toFixed(1)}
              fill={b.up ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.35)"}
            />
          );
        })}

        {/* X-axis tick labels */}
        {xTicks.map(({ x, label }) => (
          <text
            key={label}
            x={x.toFixed(1)}
            y={(H - 2).toFixed(1)}
            textAnchor="middle"
            fontSize="7"
            fill="#3f3f46"
            fontFamily="monospace"
          >
            {label}
          </text>
        ))}

        {/* Hover crosshair */}
        {hover && (
          <>
            {/* Vertical line */}
            <line
              x1={hover.x.toFixed(1)} y1={PAD_TOP.toFixed(1)}
              x2={hover.x.toFixed(1)} y2={(PAD_TOP + CHART_H).toFixed(1)}
              stroke="#52525b" strokeWidth="1" strokeDasharray="3 2"
            />
            {/* Horizontal line */}
            <line
              x1={PAD_LEFT.toFixed(1)} y1={hover.y.toFixed(1)}
              x2={(PAD_LEFT + CHART_W).toFixed(1)} y2={hover.y.toFixed(1)}
              stroke="#52525b" strokeWidth="1" strokeDasharray="3 2"
            />
            {/* Price label on left axis */}
            <rect
              x="0" y={(hover.y - 6).toFixed(1)}
              width={PAD_LEFT - 1} height="12"
              fill="#18181b"
            />
            <text
              x={(PAD_LEFT - 3).toFixed(1)} y={(hover.y + 3.5).toFixed(1)}
              textAnchor="end" fontSize="7.5"
              fill={lineColor} fontFamily="monospace" fontWeight="bold"
            >
              {hover.price.toFixed(2)}
            </text>
            {/* Dot at hover point */}
            <circle
              cx={hover.x.toFixed(1)} cy={hover.y.toFixed(1)}
              r="3" fill={lineColor} stroke="#18181b" strokeWidth="1"
            />
          </>
        )}
      </svg>
    </div>
  );
}

// ── Sell Confirmation Modal ───────────────────────────────────────────────────

function SellConfirmModal({
  stock,
  shares,
  proceeds,
  onConfirm,
  onCancel,
  loading,
}: {
  stock: StockPrice;
  shares: number;
  proceeds: number;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.75)" }}
    >
      <div
        className="bg-zinc-900 border border-zinc-600 font-mono text-white"
        style={{ width: 280 }}
      >
        {/* Title bar */}
        <div className="flex items-center justify-between border-b border-zinc-700 px-3 py-2 bg-zinc-800">
          <span className="text-xs tracking-widest text-zinc-300">CONFIRM SELL</span>
          <button
            onClick={onCancel}
            disabled={loading}
            className="text-zinc-500 hover:text-white text-xs w-5 h-5 flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">{stock.icon}</span>
            <div>
              <div className="text-xs font-bold tracking-widest">{stock.ticker}</div>
              <div className="text-xs text-zinc-500">{stock.name}</div>
            </div>
          </div>

          <div className="border border-zinc-800 px-3 py-2 flex flex-col gap-1 text-xs">
            <div className="flex justify-between">
              <span className="text-zinc-500">SHARES</span>
              <span className="text-white font-bold">{shares}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">PRICE</span>
              <span className="text-white">{stock.price.toFixed(2)} XP</span>
            </div>
            <div className="flex justify-between border-t border-zinc-800 pt-1 mt-0.5">
              <span className="text-zinc-400">YOU RECEIVE</span>
              <span className="text-green-400 font-bold">+{proceeds} XP</span>
            </div>
          </div>

          <p className="text-xs text-zinc-500 leading-relaxed">
            Sell orders take ~2 seconds to process. Price may change slightly before execution.
          </p>

          <div className="flex gap-2">
            <button
              onClick={onCancel}
              disabled={loading}
              className="flex-1 h-8 text-xs tracking-widest border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500"
              style={{ background: "transparent" }}
            >
              CANCEL
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className="flex-1 h-8 text-xs font-bold tracking-widest border flex items-center justify-center gap-1.5"
              style={{
                background: loading ? "transparent" : "#ef4444",
                borderColor: loading ? "#3f3f46" : "#ef4444",
                color: loading ? "#52525b" : "#fff",
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? (
                <>
                  <span
                    className="inline-block w-3 h-3 border border-zinc-600 border-t-zinc-400 animate-spin"
                    style={{ borderRadius: 0 }}
                  />
                  SELLING…
                </>
              ) : (
                "SELL NOW"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── No Buyers Modal ───────────────────────────────────────────────────────────

function NoBuyersModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.75)" }}
    >
      <div
        className="bg-zinc-900 border border-zinc-600 font-mono text-white"
        style={{ width: 280 }}
      >
        {/* Title bar */}
        <div className="flex items-center justify-between border-b border-zinc-700 px-3 py-2 bg-zinc-800">
          <span className="text-xs tracking-widest text-red-400">SELL FAILED</span>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white text-xs w-5 h-5 flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-5 flex flex-col gap-4 items-center text-center">
          <span className="text-3xl">📉</span>
          <p className="text-sm font-bold text-white tracking-wide leading-snug">
            No one is buying this stock at this moment
          </p>
          <p className="text-xs text-zinc-500 leading-relaxed">
            The market has no active buyers. Try again later.
          </p>
          <button
            onClick={onClose}
            className="w-full h-9 text-xs font-bold tracking-widest border border-zinc-600 text-zinc-300 hover:text-white hover:border-zinc-400"
            style={{ background: "transparent" }}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

function PctChange({ history }: { history: number[] }) {
  if (history.length < 2) return null;
  const prev = history[history.length - 2];
  const curr = history[history.length - 1];
  const pct = ((curr - prev) / prev) * 100;
  const up = pct >= 0;
  return (
    <span
      className="text-xs font-bold font-mono"
      style={{ color: up ? "#22c55e" : "#ef4444" }}
    >
      {up ? "+" : ""}
      {pct.toFixed(1)}%
    </span>
  );
}

// ── Main Window ───────────────────────────────────────────────────────────────

type Tab = "MARKET" | "PORTFOLIO";

export default function StocksWindow() {
  const { user, token, setUser } = useAuthStore();
  const [tab, setTab] = useState<Tab>("MARKET");
  const [prices, setPrices] = useState<StockPrice[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [selected, setSelected] = useState<StockPrice | null>(null);
  const [shares, setShares] = useState(1);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [sellConfirm, setSellConfirm] = useState(false);
  const [sellLoading, setSellLoading] = useState(false);
  const [noBuyers, setNoBuyers] = useState(false);
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showMsg = (ok: boolean, text: string) => {
    if (msgTimer.current) clearTimeout(msgTimer.current);
    setMsg({ ok, text });
    msgTimer.current = setTimeout(() => setMsg(null), 3500);
  };

  const fetchPrices = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/stocks/prices`);
      if (!res.ok) return;
      const data: StockPrice[] = await res.json();
      setPrices(data);
      // Keep selected in sync
      setSelected((prev) =>
        prev ? data.find((d) => d.ticker === prev.ticker) ?? prev : null
      );
    } catch {}
  }, []);

  const fetchHoldings = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/stocks/portfolio`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      setHoldings(await res.json());
    } catch {}
  }, [token]);

  // Poll every 2 seconds (matching server tick interval)
  useEffect(() => {
    fetchPrices();
    fetchHoldings();
    const iv = setInterval(() => {
      fetchPrices();
      fetchHoldings();
    }, 2000);
    return () => clearInterval(iv);
  }, [fetchPrices, fetchHoldings]);

  const holding = selected
    ? holdings.find((h) => h.ticker === selected.ticker)
    : null;

  const totalCost = selected ? Math.round(selected.price * shares) : 0;
  const canBuy = !!user && !!selected && user.xp >= totalCost && shares >= 1;
  const canSell = !!holding && holding.shares >= shares && shares >= 1;

  async function handleBuy() {
    if (!selected || !token || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/stocks/buy`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ticker: selected.ticker, shares }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error === "MARKET_CLOSED" ? "Exchange is closed" : data.error);
      if (user && data.newXP !== undefined) setUser({ ...user, xp: data.newXP });
      await fetchHoldings();
      showMsg(true, `Bought ${shares}x ${selected.ticker} for ${data.spent} XP`);
    } catch (e: any) {
      showMsg(false, e.message);
    } finally {
      setBusy(false);
    }
  }

  // Opens the confirmation modal
  function handleSell() {
    if (!selected || !canSell || busy) return;
    setSellConfirm(true);
  }

  // Called when user clicks "SELL NOW" in the modal
  async function handleSellConfirmed() {
    if (!selected || !token) return;
    setSellLoading(true);
    try {
      // 2-second processing delay
      await new Promise((r) => setTimeout(r, 2000));
      const res = await fetch(`${API_URL}/api/stocks/sell`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ticker: selected.ticker, shares }),
      });
      const data = await res.json();

      // MARKET_CLOSED: show immediate error, no theatrical delay
      if (data.error === "MARKET_CLOSED") {
        setSellConfirm(false);
        setSellLoading(false);
        showMsg(false, "Exchange is closed");
        return;
      }

      // NO_BUYERS: fake 10-second loading then show blocked popup
      if (res.status === 503 || data.error === "NO_BUYERS") {
        await new Promise((r) => setTimeout(r, 10000));
        setSellConfirm(false);
        setSellLoading(false);
        setNoBuyers(true);
        return;
      }

      if (!res.ok) throw new Error(data.error);
      if (user && data.newXP !== undefined) setUser({ ...user, xp: data.newXP });
      await fetchHoldings();
      setSellConfirm(false);
      showMsg(true, `Sold ${shares}x ${selected.ticker} for +${data.gained} XP`);
    } catch (e: any) {
      setSellConfirm(false);
      showMsg(false, e.message);
    } finally {
      setSellLoading(false);
    }
  }

  // Portfolio total value
  const portfolioValue = holdings.reduce((sum, h) => {
    const p = prices.find((s) => s.ticker === h.ticker);
    return sum + (p ? p.price * h.shares : 0);
  }, 0);

  const portfolioCost = holdings.reduce(
    (sum, h) => sum + h.avgBuyPrice * h.shares,
    0
  );
  const portfolioPnl = portfolioValue - portfolioCost;

  return (
    <div className="flex flex-col h-full bg-zinc-950 font-mono text-white overflow-hidden relative">
      {/* Sell confirmation modal */}
      {sellConfirm && selected && (
        <SellConfirmModal
          stock={selected}
          shares={shares}
          proceeds={Math.round(selected.price * shares)}
          onConfirm={handleSellConfirmed}
          onCancel={() => { if (!sellLoading) setSellConfirm(false); }}
          loading={sellLoading}
        />
      )}

      {/* No buyers modal */}
      {noBuyers && (
        <NoBuyersModal onClose={() => setNoBuyers(false)} />
      )}

      {/* Header */}
      <div className="border-b border-zinc-800 px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-base">📈</span>
          <span className="text-xs tracking-widest text-zinc-400">CAMPFIRE EXCHANGE</span>
        </div>
        {user && (
          <span className="text-xs text-yellow-400">{user.xp} XP</span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800 shrink-0">
        {(["MARKET", "PORTFOLIO"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 py-2 text-xs tracking-widest border-r border-zinc-800 last:border-r-0"
            style={{
              background: tab === t ? "#ffffff" : "transparent",
              color: tab === t ? "#000000" : "#71717a",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {tab === "MARKET" ? (
          <MarketTab
            prices={prices}
            holdings={holdings}
            selected={selected}
            onSelect={(s) => { setSelected(s); setShares(1); setMsg(null); }}
            shares={shares}
            setShares={setShares}
            totalCost={totalCost}
            canBuy={canBuy}
            canSell={canSell}
            holding={holding ?? null}
            onBuy={handleBuy}
            onSell={handleSell}
            busy={busy}
            msg={msg}
          />
        ) : (
          <PortfolioTab
            holdings={holdings}
            prices={prices}
            portfolioValue={portfolioValue}
            portfolioCost={portfolioCost}
            portfolioPnl={portfolioPnl}
            onSelectTicker={(ticker) => {
              const s = prices.find((p) => p.ticker === ticker);
              if (s) { setSelected(s); setShares(1); setTab("MARKET"); }
            }}
          />
        )}
      </div>
    </div>
  );
}

// ── Market Tab ────────────────────────────────────────────────────────────────

function MarketTab({
  prices,
  holdings,
  selected,
  onSelect,
  shares,
  setShares,
  totalCost,
  canBuy,
  canSell,
  holding,
  onBuy,
  onSell,
  busy,
  msg,
}: {
  prices: StockPrice[];
  holdings: Holding[];
  selected: StockPrice | null;
  onSelect: (s: StockPrice) => void;
  shares: number;
  setShares: (n: number) => void;
  totalCost: number;
  canBuy: boolean;
  canSell: boolean;
  holding: Holding | null;
  onBuy: () => void;
  onSell: () => void;
  busy: boolean;
  msg: { ok: boolean; text: string } | null;
}) {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Stock list */}
      <div className="flex-1 overflow-y-auto border-b border-zinc-800">
        {prices.map((stock) => {
          const h = holdings.find((ho) => ho.ticker === stock.ticker);
          const isSelected = selected?.ticker === stock.ticker;
          const first = stock.history[0] ?? stock.price;
          const allTimeUp = stock.price >= first;
          return (
            <button
              key={stock.ticker}
              onClick={() => onSelect(stock)}
              className="w-full flex items-center gap-3 px-4 py-2.5 border-b border-zinc-800 text-left"
              style={{
                background: isSelected ? "#18181b" : "transparent",
                borderLeft: isSelected ? "2px solid #f97316" : "2px solid transparent",
              }}
            >
              {/* Icon + name */}
              <span className="text-lg shrink-0 w-7 text-center">{stock.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold tracking-wider text-white">{stock.ticker}</span>
                  {h && (
                    <span className="text-xs text-orange-400 tracking-widest">×{h.shares}</span>
                  )}
                </div>
                <div className="text-xs text-zinc-500 truncate">{stock.name}</div>
              </div>
              {/* Sparkline */}
              <Sparkline history={stock.history} width={60} height={22} />
              {/* Price */}
              <div className="text-right shrink-0 w-16">
                <div
                  className="text-xs font-bold"
                  style={{ color: allTimeUp ? "#22c55e" : "#ef4444" }}
                >
                  {stock.price.toFixed(1)} XP
                </div>
                <PctChange history={stock.history} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Trade panel */}
      {selected && (
        <div className="shrink-0 border-t border-zinc-700 bg-zinc-900 p-4">
          {/* Selected stock header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">{selected.icon}</span>
              <div>
                <div className="text-xs font-bold tracking-widest">{selected.ticker}</div>
                <div className="text-xs text-zinc-500">{selected.name}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-white">
                {selected.price.toFixed(2)} XP
              </div>
              <PctChange history={selected.history} />
            </div>
          </div>

          {/* Chart */}
          <div className="mb-3 bg-zinc-950 border border-zinc-800 p-2">
            <TradingChart history={selected.history} />
          </div>

          {/* Holding info */}
          {holding && (
            <div className="mb-3 flex items-center gap-4 text-xs text-zinc-400 border border-zinc-800 px-3 py-2">
              <span>HOLDING: <span className="text-white font-bold">{holding.shares} shares</span></span>
              <span>AVG: <span className="text-white">{holding.avgBuyPrice.toFixed(1)} XP</span></span>
              <span style={{ color: selected.price >= holding.avgBuyPrice ? "#22c55e" : "#ef4444" }}>
                P&amp;L: {((selected.price - holding.avgBuyPrice) * holding.shares).toFixed(0)} XP
              </span>
            </div>
          )}

          {/* Shares input + buttons */}
          <div className="flex items-center gap-2">
            <div className="flex items-center border border-zinc-700 bg-zinc-950">
              <button
                onClick={() => setShares(Math.max(1, shares - 1))}
                className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 text-sm"
              >−</button>
              <input
                type="number"
                min={1}
                value={shares}
                onChange={(e) => setShares(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-14 h-8 bg-transparent text-center text-xs font-bold text-white outline-none"
              />
              <button
                onClick={() => setShares(shares + 1)}
                className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 text-sm"
              >+</button>
            </div>

            <button
              onClick={onBuy}
              disabled={!canBuy || busy}
              className="flex-1 h-8 text-xs font-bold tracking-widest border"
              style={{
                background: canBuy && !busy ? "#22c55e" : "transparent",
                borderColor: canBuy && !busy ? "#22c55e" : "#3f3f46",
                color: canBuy && !busy ? "#000" : "#52525b",
                cursor: canBuy && !busy ? "pointer" : "not-allowed",
              }}
            >
              BUY {totalCost} XP
            </button>

            <button
              onClick={onSell}
              disabled={!canSell || busy}
              className="flex-1 h-8 text-xs font-bold tracking-widest border"
              style={{
                background: canSell && !busy ? "#ef4444" : "transparent",
                borderColor: canSell && !busy ? "#ef4444" : "#3f3f46",
                color: canSell && !busy ? "#fff" : "#52525b",
                cursor: canSell && !busy ? "pointer" : "not-allowed",
              }}
            >
              SELL
            </button>
          </div>

          {/* Message */}
          {msg && (
            <div
              className="mt-2 px-3 py-1.5 text-xs tracking-widest border"
              style={{
                background: msg.ok ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                borderColor: msg.ok ? "#22c55e" : "#ef4444",
                color: msg.ok ? "#22c55e" : "#ef4444",
              }}
            >
              {msg.text}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Portfolio Tab ─────────────────────────────────────────────────────────────

function PortfolioTab({
  holdings,
  prices,
  portfolioValue,
  portfolioCost,
  portfolioPnl,
  onSelectTicker,
}: {
  holdings: Holding[];
  prices: StockPrice[];
  portfolioValue: number;
  portfolioCost: number;
  portfolioPnl: number;
  onSelectTicker: (ticker: string) => void;
}) {
  if (holdings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-2 text-zinc-600">
        <span className="text-3xl">📉</span>
        <p className="text-xs tracking-widest">NO HOLDINGS YET</p>
        <p className="text-xs text-zinc-700">Buy stocks in the MARKET tab</p>
      </div>
    );
  }

  const pnlColor = portfolioPnl >= 0 ? "#22c55e" : "#ef4444";

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Summary */}
      <div className="border-b border-zinc-800 px-4 py-3 grid grid-cols-3 gap-2 text-center shrink-0">
        <div>
          <div className="text-xs text-zinc-500 tracking-widest mb-0.5">VALUE</div>
          <div className="text-sm font-bold text-white">{portfolioValue.toFixed(0)} XP</div>
        </div>
        <div>
          <div className="text-xs text-zinc-500 tracking-widest mb-0.5">COST</div>
          <div className="text-sm font-bold text-zinc-400">{portfolioCost.toFixed(0)} XP</div>
        </div>
        <div>
          <div className="text-xs text-zinc-500 tracking-widest mb-0.5">P&amp;L</div>
          <div className="text-sm font-bold" style={{ color: pnlColor }}>
            {portfolioPnl >= 0 ? "+" : ""}{portfolioPnl.toFixed(0)} XP
          </div>
        </div>
      </div>

      {/* Holdings list */}
      <div className="flex-1 overflow-y-auto">
        {holdings.map((h) => {
          const stock = prices.find((p) => p.ticker === h.ticker);
          if (!stock) return null;
          const value = stock.price * h.shares;
          const cost = h.avgBuyPrice * h.shares;
          const pnl = value - cost;
          const pnlPct = ((stock.price - h.avgBuyPrice) / h.avgBuyPrice) * 100;
          return (
            <button
              key={h.ticker}
              onClick={() => onSelectTicker(h.ticker)}
              className="w-full flex items-center gap-3 px-4 py-3 border-b border-zinc-800 hover:bg-zinc-900 text-left"
            >
              <span className="text-lg shrink-0 w-7 text-center">{stock.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold tracking-wider text-white">{stock.ticker}</span>
                  <span className="text-xs text-zinc-500">×{h.shares}</span>
                </div>
                <div className="text-xs text-zinc-500">
                  avg {h.avgBuyPrice.toFixed(1)} → now {stock.price.toFixed(1)} XP
                </div>
              </div>
              <Sparkline history={stock.history} width={48} height={20} />
              <div className="text-right shrink-0 w-20">
                <div className="text-xs font-bold text-white">{value.toFixed(0)} XP</div>
                <div
                  className="text-xs font-bold"
                  style={{ color: pnl >= 0 ? "#22c55e" : "#ef4444" }}
                >
                  {pnl >= 0 ? "+" : ""}{pnl.toFixed(0)} ({pnlPct.toFixed(1)}%)
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
