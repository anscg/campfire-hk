import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const MAX_MEMBERS = 3;

// Generate a random 6-character alphanumeric invite code
function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid confusion
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// List all groups with member details resolved
export const list = query({
  handler: async (ctx) => {
    const groups = await ctx.db.query("groups").collect();
    return await Promise.all(
      groups.map(async (group) => {
        const members = await Promise.all(
          group.memberIds.map(async (id) => {
            const user = await ctx.db.get(id);
            return user
              ? { _id: user._id, displayName: user.displayName, xp: user.xp, level: user.level }
              : null;
          })
        );
        return {
          _id: group._id,
          name: group.name,
          inviteCode: group.inviteCode,
          createdBy: group.createdBy,
          createdAt: group.createdAt,
          members: members.filter(Boolean),
        };
      })
    );
  },
});

// Get the group a specific user belongs to (if any)
export const getByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const groups = await ctx.db.query("groups").collect();
    const group = groups.find((g) => g.memberIds.includes(args.userId));
    if (!group) return null;

    const members = await Promise.all(
      group.memberIds.map(async (id) => {
        const user = await ctx.db.get(id);
        return user
          ? { _id: user._id, displayName: user.displayName, xp: user.xp, level: user.level }
          : null;
      })
    );

    return {
      _id: group._id,
      name: group.name,
      inviteCode: group.inviteCode,
      createdBy: group.createdBy,
      createdAt: group.createdAt,
      members: members.filter(Boolean),
    };
  },
});

// Create a new group
export const create = mutation({
  args: {
    name: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // User can't already be in a group
    const groups = await ctx.db.query("groups").collect();
    const alreadyInGroup = groups.find((g) => g.memberIds.includes(args.userId));
    if (alreadyInGroup) throw new Error("Already in a group");

    // Generate unique invite code
    let inviteCode = generateInviteCode();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await ctx.db
        .query("groups")
        .withIndex("by_invite_code", (q) => q.eq("inviteCode", inviteCode))
        .first();
      if (!existing) break;
      inviteCode = generateInviteCode();
      attempts++;
    }

    const groupId = await ctx.db.insert("groups", {
      name: args.name,
      inviteCode,
      memberIds: [args.userId],
      createdBy: args.userId,
      createdAt: Date.now(),
    });

    return { groupId, inviteCode };
  },
});

// Join an existing group via invite code
export const join = mutation({
  args: {
    inviteCode: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // User can't already be in a group
    const groups = await ctx.db.query("groups").collect();
    const alreadyInGroup = groups.find((g) => g.memberIds.includes(args.userId));
    if (alreadyInGroup) throw new Error("Already in a group");

    const group = await ctx.db
      .query("groups")
      .withIndex("by_invite_code", (q) => q.eq("inviteCode", args.inviteCode.toUpperCase()))
      .first();

    if (!group) throw new Error("Invalid invite code");
    if (group.memberIds.length >= MAX_MEMBERS) throw new Error("Group is full");

    await ctx.db.patch(group._id, {
      memberIds: [...group.memberIds, args.userId],
    });

    return { groupId: group._id, name: group.name };
  },
});

// Leave a group
export const leave = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const groups = await ctx.db.query("groups").collect();
    const group = groups.find((g) => g.memberIds.includes(args.userId));
    if (!group) throw new Error("Not in a group");

    const remaining = group.memberIds.filter((id) => id !== args.userId);

    if (remaining.length === 0) {
      // Last member — delete the group entirely
      await ctx.db.delete(group._id);
    } else {
      // Reassign creator if needed
      const newCreator = group.createdBy === args.userId ? remaining[0] : group.createdBy;
      await ctx.db.patch(group._id, { memberIds: remaining, createdBy: newCreator });
    }
  },
});
