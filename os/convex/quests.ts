import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ── Participant queries ────────────────────────────────────────────────────────

// List all active quests with completion counts and whether the current user has done them
export const listForUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const quests = await ctx.db.query("quests").collect();

    const results = await Promise.all(
      quests
        .filter((q) => q.active)
        .map(async (quest) => {
          // Has this user already completed this quest?
          const myCompletion = await ctx.db
            .query("questCompletions")
            .withIndex("by_quest_user", (q) =>
              q.eq("questId", quest._id).eq("userId", args.userId)
            )
            .first();

          // Total completions (for capacity display)
          const completions = await ctx.db
            .query("questCompletions")
            .withIndex("by_quest", (q) => q.eq("questId", quest._id))
            .collect();

          return {
            _id: quest._id,
            title: quest.title,
            description: quest.description,
            xpReward: quest.xpReward,
            maxCompletions: quest.maxCompletions ?? null,
            icon: quest.icon ?? "📋",
            completedByMe: !!myCompletion,
            completedAt: myCompletion?.completedAt ?? null,
            totalCompletions: completions.length,
          };
        })
    );

    return results;
  },
});

// ── Admin queries ──────────────────────────────────────────────────────────────

// List ALL quests (active + inactive) for admin management
export const listAll = query({
  handler: async (ctx) => {
    const quests = await ctx.db.query("quests").collect();

    return Promise.all(
      quests.map(async (quest) => {
        const completions = await ctx.db
          .query("questCompletions")
          .withIndex("by_quest", (q) => q.eq("questId", quest._id))
          .collect();

        // Resolve completion details (user names)
        const completionDetails = await Promise.all(
          completions.map(async (c) => {
            const user = await ctx.db.get(c.userId);
            const admin = await ctx.db.get(c.verifiedBy);
            return {
              _id: c._id,
              userId: c.userId,
              userName: user?.displayName ?? "Unknown",
              verifiedByName: admin?.displayName ?? "Admin",
              note: c.note ?? null,
              completedAt: c.completedAt,
            };
          })
        );

        return {
          _id: quest._id,
          title: quest.title,
          description: quest.description,
          xpReward: quest.xpReward,
          maxCompletions: quest.maxCompletions ?? null,
          active: quest.active,
          icon: quest.icon ?? "📋",
          createdAt: quest.createdAt,
          completions: completionDetails,
          totalCompletions: completions.length,
        };
      })
    );
  },
});

// ── Admin mutations ────────────────────────────────────────────────────────────

// Create a new quest
export const create = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    xpReward: v.number(),
    maxCompletions: v.optional(v.number()),
    icon: v.optional(v.string()),
    createdBy: v.id("users"),
  },
  handler: async (ctx, args) => {
    if (args.xpReward <= 0) throw new Error("XP reward must be positive");
    const id = await ctx.db.insert("quests", {
      title: args.title.trim(),
      description: args.description.trim(),
      xpReward: args.xpReward,
      maxCompletions: args.maxCompletions,
      icon: args.icon ?? "📋",
      active: true,
      createdBy: args.createdBy,
      createdAt: Date.now(),
    });
    return { questId: id };
  },
});

// Toggle quest active/inactive
export const setActive = mutation({
  args: { questId: v.id("quests"), active: v.boolean() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.questId, { active: args.active });
  },
});

// Edit a quest's fields
export const update = mutation({
  args: {
    questId: v.id("quests"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    xpReward: v.optional(v.number()),
    maxCompletions: v.optional(v.number()),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { questId, ...fields } = args;
    const patch: Record<string, unknown> = {};
    if (fields.title !== undefined) patch.title = fields.title.trim();
    if (fields.description !== undefined) patch.description = fields.description.trim();
    if (fields.xpReward !== undefined) {
      if (fields.xpReward <= 0) throw new Error("XP reward must be positive");
      patch.xpReward = fields.xpReward;
    }
    if (fields.maxCompletions !== undefined) patch.maxCompletions = fields.maxCompletions;
    if (fields.icon !== undefined) patch.icon = fields.icon;
    await ctx.db.patch(questId, patch);
  },
});

// Admin verifies a participant completed a quest → awards XP
export const verify = mutation({
  args: {
    questId: v.id("quests"),
    userId: v.id("users"),
    adminId: v.id("users"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const quest = await ctx.db.get(args.questId);
    if (!quest) throw new Error("Quest not found");
    if (!quest.active) throw new Error("Quest is not active");

    const admin = await ctx.db.get(args.adminId);
    if (!admin?.isAdmin) throw new Error("Not an admin");

    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    // Prevent double-completion
    const existing = await ctx.db
      .query("questCompletions")
      .withIndex("by_quest_user", (q) =>
        q.eq("questId", args.questId).eq("userId", args.userId)
      )
      .first();
    if (existing) throw new Error("User already completed this quest");

    // Check capacity
    if (quest.maxCompletions != null) {
      const count = (
        await ctx.db
          .query("questCompletions")
          .withIndex("by_quest", (q) => q.eq("questId", args.questId))
          .collect()
      ).length;
      if (count >= quest.maxCompletions) throw new Error("Quest is full");
    }

    // Record completion
    await ctx.db.insert("questCompletions", {
      questId: args.questId,
      userId: args.userId,
      verifiedBy: args.adminId,
      note: args.note,
      completedAt: Date.now(),
    });

    // Award XP
    const newXP = user.xp + quest.xpReward;
    const newLevel = Math.floor(newXP / 100) + 1;
    await ctx.db.patch(args.userId, { xp: newXP, level: newLevel });

    await ctx.db.insert("xpEvents", {
      userId: args.userId,
      amount: quest.xpReward,
      reason: `Quest: ${quest.title}`,
      createdAt: Date.now(),
    });

    await ctx.db.insert("transactions", {
      userId: args.userId,
      type: "earn",
      amount: quest.xpReward,
      description: `Quest completed: ${quest.title}`,
      createdAt: Date.now(),
    });

    return { newXP, newLevel };
  },
});

// Admin revokes a completion (undo)
export const revokeCompletion = mutation({
  args: {
    questId: v.id("quests"),
    userId: v.id("users"),
    adminId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const admin = await ctx.db.get(args.adminId);
    if (!admin?.isAdmin) throw new Error("Not an admin");

    const quest = await ctx.db.get(args.questId);
    if (!quest) throw new Error("Quest not found");

    const completion = await ctx.db
      .query("questCompletions")
      .withIndex("by_quest_user", (q) =>
        q.eq("questId", args.questId).eq("userId", args.userId)
      )
      .first();
    if (!completion) throw new Error("Completion not found");

    await ctx.db.delete(completion._id);

    // Deduct the XP back
    const user = await ctx.db.get(args.userId);
    if (user) {
      const newXP = Math.max(0, user.xp - quest.xpReward);
      await ctx.db.patch(args.userId, { xp: newXP, level: Math.floor(newXP / 100) + 1 });
    }

    return { success: true };
  },
});

// Lookup a user by display name fragment (for booth search)
export const searchUsers = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    const q = args.query.toLowerCase().trim();
    if (!q) return [];
    const users = await ctx.db.query("users").collect();
    return users
      .filter((u) => !u.isAdmin && u.displayName.toLowerCase().includes(q))
      .slice(0, 10)
      .map((u) => ({ _id: u._id, displayName: u.displayName, xp: u.xp }));
  },
});
