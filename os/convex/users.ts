import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Get user by email
export const getByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
  },
});

// Get user by ID
export const getById = query({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Create or update user on login
export const upsertUser = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { lastLogin: Date.now() });
      return existing._id;
    }

    // Create new user
    const userId = await ctx.db.insert("users", {
      email: args.email,
      displayName: args.email.split("@")[0],
      xp: 0,
      level: 1,
      createdAt: Date.now(),
      lastLogin: Date.now(),
    });

    return userId;
  },
});

// Update display name
export const updateDisplayName = mutation({
  args: { id: v.id("users"), displayName: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { displayName: args.displayName });
  },
});

// Add XP to user
export const addXP = mutation({
  args: {
    id: v.id("users"),
    amount: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.id);
    if (!user) throw new Error("User not found");

    const newXP = user.xp + args.amount;
    const newLevel = Math.floor(newXP / 100) + 1;

    await ctx.db.patch(args.id, { xp: newXP, level: newLevel });

    // Record XP event
    await ctx.db.insert("xpEvents", {
      userId: args.id,
      amount: args.amount,
      reason: args.reason,
      createdAt: Date.now(),
    });

    return { xp: newXP, level: newLevel };
  },
});

// Deduct XP (for purchases)
export const deductXP = mutation({
  args: {
    id: v.id("users"),
    amount: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.id);
    if (!user) throw new Error("User not found");
    if (user.xp < args.amount) throw new Error("Insufficient XP");

    const newXP = user.xp - args.amount;
    const newLevel = Math.floor(newXP / 100) + 1;

    await ctx.db.patch(args.id, { xp: newXP, level: newLevel });

    return { xp: newXP, level: newLevel };
  },
});

// Get all users sorted by XP (descending) for leaderboard — admins excluded
export const getLeaderboard = query({
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users
      .filter((u) => !u.isAdmin)
      .sort((a, b) => b.xp - a.xp)
      .map((user) => ({
        _id: user._id,
        displayName: user.displayName,
        xp: user.xp,
      }));
  },
});

// Promote or demote a user to admin (callable by server-side only via secret)
export const setAdmin = mutation({
  args: { id: v.id("users"), isAdmin: v.boolean() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { isAdmin: args.isAdmin });
  },
});

// Transfer XP between two users (atomic)
export const transferXP = mutation({
  args: {
    fromId: v.id("users"),
    toId: v.id("users"),
    amount: v.number(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.amount <= 0) throw new Error("Amount must be positive");
    if (args.fromId === args.toId) throw new Error("Cannot transfer to yourself");

    const sender = await ctx.db.get(args.fromId);
    const recipient = await ctx.db.get(args.toId);
    if (!sender) throw new Error("Sender not found");
    if (!recipient) throw new Error("Recipient not found");
    if (sender.xp < args.amount) throw new Error("Insufficient XP");

    const note = args.note || `Transfer to ${recipient.displayName}`;

    await ctx.db.patch(args.fromId, { xp: sender.xp - args.amount });
    await ctx.db.patch(args.toId, { xp: recipient.xp + args.amount });

    // Record both sides as transactions
    await ctx.db.insert("transactions", {
      userId: args.fromId,
      type: "send",
      amount: args.amount,
      description: `CampPay: sent ${args.amount} XP to ${recipient.displayName}${args.note ? ` · ${args.note}` : ""}`,
      createdAt: Date.now(),
    });
    await ctx.db.insert("transactions", {
      userId: args.toId,
      type: "earn",
      amount: args.amount,
      description: `CampPay: received ${args.amount} XP from ${sender.displayName}${args.note ? ` · ${args.note}` : ""}`,
      createdAt: Date.now(),
    });

    return {
      senderXP: sender.xp - args.amount,
      recipientXP: recipient.xp + args.amount,
    };
  },
});

// Get all users (name + id) for recipient search
export const listUsers = query({
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users.map((u) => ({ _id: u._id, displayName: u.displayName, xp: u.xp }));
  },
});
