import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Get transactions for a user
export const getByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("transactions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

// Get XP events for a user
export const getXPEvents = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("xpEvents")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

// Record a transaction (used by server routes for hardcoded-item purchases)
export const record = internalMutation({
  args: {
    userId: v.id("users"),
    type: v.union(
      v.literal("purchase"),
      v.literal("earn"),
      v.literal("refund"),
      v.literal("send"),
    ),
    amount: v.number(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("transactions", {
      userId: args.userId,
      type: args.type,
      amount: args.amount,
      description: args.description,
      createdAt: Date.now(),
    });
  },
});
