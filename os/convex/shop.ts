import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// List all available shop items
export const list = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("shopItems")
      .collect();
  },
});

// Get a single shop item
export const get = query({
  args: { id: v.id("shopItems") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Purchase an item
export const purchase = mutation({
  args: {
    userId: v.id("users"),
    itemId: v.id("shopItems"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    const item = await ctx.db.get(args.itemId);
    if (!item) throw new Error("Item not found");
    if (!item.available) throw new Error("Item not available");

    // Check if already purchased
    const existing = await ctx.db
      .query("purchases")
      .withIndex("by_user_item", (q) =>
        q.eq("userId", args.userId).eq("itemId", args.itemId)
      )
      .first();

    if (existing) throw new Error("Already purchased");

    // Check XP
    if (user.xp < item.price) throw new Error("Insufficient XP");

    // Deduct XP
    const newXP = user.xp - item.price;
    const newLevel = Math.floor(newXP / 100) + 1;
    await ctx.db.patch(args.userId, { xp: newXP, level: newLevel });

    // Record purchase
    await ctx.db.insert("purchases", {
      userId: args.userId,
      itemId: args.itemId,
      purchasedAt: Date.now(),
    });

    // Record transaction
    await ctx.db.insert("transactions", {
      userId: args.userId,
      type: "purchase",
      amount: item.price,
      itemId: args.itemId,
      description: `Purchased ${item.name}`,
      createdAt: Date.now(),
    });

    return { success: true, newXP, newLevel };
  },
});

// Get user's purchases
export const getUserPurchases = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("purchases")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

// Seed shop items (admin use)
export const seed = mutation({
  handler: async (ctx) => {
    const items = [
      {
        name: "Custom Avatar Frame",
        description: "A unique frame for your profile avatar",
        price: 50,
        category: "cosmetic",
        icon: "🖼️",
        available: true,
      },
      {
        name: "Team Name Color",
        description: "Change your team name color",
        price: 75,
        category: "cosmetic",
        icon: "🎨",
        available: true,
      },
      {
        name: "Priority Queue",
        description: "Get priority in event queues",
        price: 150,
        category: "utility",
        icon: "⚡",
        available: true,
      },
      {
        name: "Extra Submission Slot",
        description: "Submit one additional project",
        price: 200,
        category: "utility",
        icon: "📦",
        available: true,
      },
      {
        name: "Campfire Sticker Pack",
        description: "Exclusive digital sticker collection",
        price: 30,
        category: "collectible",
        icon: "🔥",
        available: true,
      },
      {
        name: "Judge's Pick Badge",
        description: "Display a special badge on your profile",
        price: 100,
        category: "cosmetic",
        icon: "🏅",
        available: true,
      },
    ];

    for (const item of items) {
      await ctx.db.insert("shopItems", item);
    }

    return { inserted: items.length };
  },
});
