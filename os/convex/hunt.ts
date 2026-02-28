import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";

// XP tiers: 1st = 250, 2nd = 100, 3rd = 30, 4th+ = 0
const XP_TIERS = [250, 100, 30];

// ── redeemHunt ────────────────────────────────────────────────
// Called by the server when an authenticated user hits /api/hunt/:huntId.
// Returns { xpAwarded, rank, alreadyRedeemed, groupBlocked } so the
// server can relay the outcome to the client.
export const redeemHunt = internalMutation({
  args: {
    huntId: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // 1. Has this user already redeemed this hunt?
    const existing = await ctx.db
      .query("huntRedemptions")
      .withIndex("by_hunt_user", (q) =>
        q.eq("huntId", args.huntId).eq("userId", args.userId)
      )
      .first();
    if (existing) {
      return {
        alreadyRedeemed: true,
        groupBlocked: false,
        xpAwarded: existing.xpAwarded,
        rank: 0,
      };
    }

    // 2. Find which group this user belongs to (if any)
    const allGroups = await ctx.db.query("groups").collect();
    const userGroup = allGroups.find((g) => g.memberIds.includes(args.userId));
    const groupId = userGroup ? userGroup._id.toString() : null;

    // 3. If user is in a group, check if anyone from that group already redeemed
    if (groupId) {
      const groupRedemption = await ctx.db
        .query("huntRedemptions")
        .withIndex("by_hunt_group", (q) =>
          q.eq("huntId", args.huntId).eq("groupId", groupId)
        )
        .first();
      if (groupRedemption) {
        return {
          alreadyRedeemed: false,
          groupBlocked: true,
          xpAwarded: 0,
          rank: 0,
        };
      }
    }

    // 4. Count existing redemptions to determine tier
    const redemptions = await ctx.db
      .query("huntRedemptions")
      .withIndex("by_hunt", (q) => q.eq("huntId", args.huntId))
      .collect();

    const rank = redemptions.length + 1; // 1-based
    const xpAwarded = XP_TIERS[rank - 1] ?? 0;

    // 5. Record the redemption
    await ctx.db.insert("huntRedemptions", {
      huntId: args.huntId,
      userId: args.userId,
      groupId: groupId ?? undefined,
      xpAwarded,
      redeemedAt: Date.now(),
    });

    // 6. Award XP (if any)
    if (xpAwarded > 0) {
      const user = await ctx.db.get(args.userId);
      if (!user) throw new Error("User not found");
      const newXP = user.xp + xpAwarded;
      const newLevel = Math.floor(newXP / 100) + 1;
      await ctx.db.patch(args.userId, { xp: newXP, level: newLevel });
      await ctx.db.insert("xpEvents", {
        userId: args.userId,
        amount: xpAwarded,
        reason: `Hunt find: ${args.huntId} (rank #${rank})`,
        createdAt: Date.now(),
      });
      await ctx.db.insert("transactions", {
        userId: args.userId,
        type: "earn",
        amount: xpAwarded,
        description: `🔍 Hunt find #${rank}: ${args.huntId} (+${xpAwarded} XP)`,
        createdAt: Date.now(),
      });
    }

    return { alreadyRedeemed: false, groupBlocked: false, xpAwarded, rank };
  },
});

// ── getRedemptions ────────────────────────────────────────────
// Admin view: all redemptions for a given hunt.
export const getRedemptions = query({
  args: { huntId: v.string() },
  handler: async (ctx, args) => {
    const redemptions = await ctx.db
      .query("huntRedemptions")
      .withIndex("by_hunt", (q) => q.eq("huntId", args.huntId))
      .collect();

    return await Promise.all(
      redemptions.map(async (r) => {
        const user = await ctx.db.get(r.userId);
        return {
          _id: r._id,
          huntId: r.huntId,
          userId: r.userId,
          displayName: user?.displayName ?? "Unknown",
          groupId: r.groupId,
          xpAwarded: r.xpAwarded,
          redeemedAt: r.redeemedAt,
        };
      })
    );
  },
});
