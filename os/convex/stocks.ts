import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ── Hardcoded stock definitions (source of truth also mirrored in server) ─────

export const STOCK_DEFS = [
  { ticker: "CAMPF",  name: "Campfire Inc.",      icon: "🔥", startPrice: 100 },
  { ticker: "HACKC",  name: "Hack Club",           icon: "🏴‍☠️", startPrice: 80  },
  { ticker: "BOBA",   name: "Boba Corp.",           icon: "🧋", startPrice: 50  },
  { ticker: "SLEEPZ", name: "SleepZ Holdings",     icon: "😴", startPrice: 30  },
  { ticker: "CRUNCH", name: "CrunchTime Ltd.",     icon: "💻", startPrice: 60  },
  { ticker: "MEMER",  name: "Meme Exchange",       icon: "🐸", startPrice: 40  },
  { ticker: "BAGEL",  name: "Bagel Finance",       icon: "🥯", startPrice: 70  },
  { ticker: "VIBE",   name: "VibeCheck Capital",   icon: "✨", startPrice: 90  },
] as const;

const MAX_HISTORY = 60;

// ── Queries ───────────────────────────────────────────────────────────────────

export const getPrices = query({
  handler: async (ctx) => {
    return await ctx.db.query("stockPrices").collect();
  },
});

export const getHoldings = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("stockHoldings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

// All holdings for a specific ticker (used by tick to count total holders)
export const getTickerHoldings = query({
  args: { ticker: v.string() },
  handler: async (ctx, { ticker }) => {
    return await ctx.db
      .query("stockHoldings")
      .withIndex("by_ticker", (q) => q.eq("ticker", ticker))
      .collect();
  },
});

// ── Ensure a stock row exists ─────────────────────────────────────────────────

async function ensureStock(ctx: any, ticker: string) {
  const existing = await ctx.db
    .query("stockPrices")
    .withIndex("by_ticker", (q: any) => q.eq("ticker", ticker))
    .first();
  if (existing) return existing;
  const def = (STOCK_DEFS as readonly any[]).find((d) => d.ticker === ticker);
  const startPrice = def?.startPrice ?? 50;
  const id = await ctx.db.insert("stockPrices", {
    ticker,
    price: startPrice,
    history: [startPrice],
    updatedAt: Date.now(),
  });
  return ctx.db.get(id);
}

// ── Seed all stocks (idempotent) ──────────────────────────────────────────────

export const seedStocks = mutation({
  handler: async (ctx) => {
    for (const def of STOCK_DEFS) {
      await ensureStock(ctx, def.ticker);
    }
  },
});

// ── Reset all stock prices (wipe history, restore to start price) ─────────────

export const resetStocks = mutation({
  handler: async (ctx) => {
    // Delete all existing stockPrices rows
    const all = await ctx.db.query("stockPrices").collect();
    for (const row of all) {
      await ctx.db.delete(row._id);
    }
    // Re-insert fresh rows at start prices
    for (const def of STOCK_DEFS) {
      await ctx.db.insert("stockPrices", {
        ticker: def.ticker,
        price: def.startPrice,
        history: [def.startPrice],
        updatedAt: Date.now(),
        pressure: 0,
      });
    }
  },
});

// ── Pure-random tickers (ignore hold state entirely) ─────────────────────────
const RANDOM_TICKERS = new Set(["MEMER", "SLEEPZ"]);

// ── Tick: advance prices for all stocks ──────────────────────────────────────
// Called from the server on a setInterval.
//
// Design goals:
//  • No hard ceiling — mean-reversion pressure increases as price climbs above
//    the start price, creating a natural ceiling without a wall.
//  • Disguised hold-penalty — instead of a direct 90% drop chance, a "pressure"
//    variable accumulates per ticker on the Convex row and gradually nudges the
//    price down. Combined with noise, it's not obvious the buying caused the dip.
//  • Half magnitudes — all move amounts are ~half the original.
//  • MEMER / SLEEPZ are purely random (no hold influence).
//
// `pressure` is stored as an extra field on the stockPrices row (optional number,
//  defaults to 0). It accumulates when shares are held and decays each tick.

export const tick = mutation({
  args: {
    // Array of { ticker, totalShares } pre-computed by the server
    // so we don't do heavy queries inside the mutation.
    holdings: v.array(v.object({ ticker: v.string(), totalShares: v.number() })),
  },
  handler: async (ctx, { holdings }) => {
    const holdingsMap = new Map(holdings.map((h) => [h.ticker, h.totalShares]));

    for (const def of STOCK_DEFS) {
      const stock = await ensureStock(ctx, def.ticker);
      if (!stock) continue;

      const startPrice = def.startPrice;
      const floor = Math.max(5, startPrice * 0.1);
      const totalShares = holdingsMap.get(def.ticker) ?? 0;
      const isHeld = totalShares > 0;

      // Retrieve existing pressure (0–1 scale)
      const prevPressure: number = (stock as any).pressure ?? 0;

      let pressure = prevPressure;
      let newPrice: number;

      if (RANDOM_TICKERS.has(def.ticker)) {
        // ── Purely random ──────────────────────────────────────────────────
        // Symmetric random walk, small magnitude
        const move = (Math.random() - 0.5) * 2;          // –1 … +1
        const magnitude = 0.02 + Math.random() * 0.04;   // 2–6% (half of original 5–8%)
        newPrice = stock.price * (1 + move * magnitude);
        pressure = 0; // no pressure for random tickers

      } else {
        // ── Normal tickers ─────────────────────────────────────────────────

        // 1. Accumulate / decay pressure
        if (isHeld) {
          // Gradually build pressure (capped at 0.9)
          pressure = Math.min(0.9, prevPressure + 0.12);
        } else {
          // Decay pressure over time
          pressure = Math.max(0, prevPressure - 0.08);
        }

        // 2. Base random move (±)
        //    Bias: slightly bullish when no pressure, pulled down when pressure is high.
        const noise = (Math.random() - 0.5) * 2;                    // –1 … +1
        const bullBias = 0.15 * (1 - pressure);                     // 0–0.15 bullish push
        const bearBias = pressure * 0.55;                            // 0–0.495 downward pull
        const rawMove = noise * (0.025 + Math.random() * 0.025)      // ±2.5–5% noise
                        + bullBias * 0.04                             // small upward nudge
                        - bearBias * 0.04;                           // downward pull

        // 3. Mean-reversion: the further above startPrice, the stronger the pull back
        const ratio = stock.price / startPrice;
        // Reversion grows quadratically above 1× start price; negligible below it
        const reversion = ratio > 1
          ? -0.01 * (ratio - 1) * (ratio - 1)   // gentle pull back at high prices
          : 0.005 * (1 - ratio);                  // mild support below start price

        newPrice = stock.price * (1 + rawMove + reversion);
      }

      // Floor (no hard ceiling — mean-reversion handles the top naturally)
      newPrice = Math.max(floor, newPrice);
      newPrice = Math.round(newPrice * 100) / 100;

      const history = [...stock.history, newPrice].slice(-MAX_HISTORY);

      await ctx.db.patch(stock._id, {
        price: newPrice,
        history,
        updatedAt: Date.now(),
        pressure,
      } as any);
    }
  },
});

// ── Buy ───────────────────────────────────────────────────────────────────────

export const buyStock = mutation({
  args: {
    userId: v.id("users"),
    ticker: v.string(),
    shares: v.number(),
    pricePerShare: v.number(),   // price at time of order, validated server-side
  },
  handler: async (ctx, { userId, ticker, shares, pricePerShare }) => {
    const stock = await ctx.db
      .query("stockPrices")
      .withIndex("by_ticker", (q) => q.eq("ticker", ticker))
      .first();
    if (!stock) throw new Error("Unknown ticker");

    // Upsert holding
    const existing = await ctx.db
      .query("stockHoldings")
      .withIndex("by_user_ticker", (q) => q.eq("userId", userId).eq("ticker", ticker))
      .first();

    if (existing) {
      const totalShares = existing.shares + shares;
      const avgBuyPrice =
        (existing.avgBuyPrice * existing.shares + pricePerShare * shares) / totalShares;
      await ctx.db.patch(existing._id, { shares: totalShares, avgBuyPrice });
    } else {
      await ctx.db.insert("stockHoldings", {
        userId,
        ticker,
        shares,
        avgBuyPrice: pricePerShare,
      });
    }
  },
});

// ── Sell ──────────────────────────────────────────────────────────────────────

export const sellStock = mutation({
  args: {
    userId: v.id("users"),
    ticker: v.string(),
    shares: v.number(),
  },
  handler: async (ctx, { userId, ticker, shares }) => {
    const holding = await ctx.db
      .query("stockHoldings")
      .withIndex("by_user_ticker", (q) => q.eq("userId", userId).eq("ticker", ticker))
      .first();
    if (!holding || holding.shares < shares) throw new Error("Insufficient shares");

    const remaining = holding.shares - shares;
    if (remaining === 0) {
      await ctx.db.delete(holding._id);
    } else {
      await ctx.db.patch(holding._id, { shares: remaining });
    }
  },
});

// ── forceSetPrices ────────────────────────────────────────────────────────────
// Admin-only: instantly set every stock to specified prices.
// Used by server-side market-event sequences (e.g. Great Depression).
export const forceSetPrices = internalMutation({
  args: {
    // Array of { ticker, price } — any tickers not listed are left unchanged.
    prices: v.array(v.object({ ticker: v.string(), price: v.number() })),
  },
  handler: async (ctx, { prices }) => {
    for (const { ticker, price } of prices) {
      const row = await ctx.db
        .query("stockPrices")
        .withIndex("by_ticker", (q) => q.eq("ticker", ticker))
        .first();
      if (!row) continue;
      const newPrice = Math.round(price * 100) / 100;
      const history = [...row.history, newPrice].slice(-MAX_HISTORY);
      await ctx.db.patch(row._id, {
        price: newPrice,
        history,
        updatedAt: Date.now(),
        pressure: 0,
      } as any);
    }
  },
});
