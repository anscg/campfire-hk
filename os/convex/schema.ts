import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    email: v.string(),
    displayName: v.string(),
    xp: v.number(),
    level: v.number(),
    isAdmin: v.optional(v.boolean()),
    createdAt: v.number(),
    lastLogin: v.number(),
  }).index("by_email", ["email"]),

  otpCodes: defineTable({
    email: v.string(),
    code: v.string(),
    expiresAt: v.number(),
    used: v.boolean(),
  }).index("by_email", ["email"]),

  shopItems: defineTable({
    name: v.string(),
    description: v.string(),
    price: v.number(),
    category: v.string(),
    icon: v.string(),
    available: v.boolean(),
  }),

  transactions: defineTable({
    userId: v.id("users"),
    type: v.union(
      v.literal("purchase"),
      v.literal("earn"),
      v.literal("refund"),
      v.literal("send")
    ),
    amount: v.number(),
    itemId: v.optional(v.id("shopItems")),
    description: v.string(),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  xpEvents: defineTable({
    userId: v.id("users"),
    amount: v.number(),
    reason: v.string(),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  purchases: defineTable({
    userId: v.id("users"),
    itemId: v.id("shopItems"),
    purchasedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_item", ["userId", "itemId"]),

  groups: defineTable({
    name: v.string(),
    inviteCode: v.string(),
    memberIds: v.array(v.id("users")),
    createdBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_invite_code", ["inviteCode"])
    .index("by_creator", ["createdBy"]),

  // ── Quests ────────────────────────────────────────────────
  quests: defineTable({
    title: v.string(),
    description: v.string(),
    xpReward: v.number(),
    // Optional cap: how many times total this quest can be completed (null = unlimited)
    maxCompletions: v.optional(v.number()),
    // Whether the quest is currently active / visible to participants
    active: v.boolean(),
    // Emoji or icon label shown in the UI
    icon: v.optional(v.string()),
    createdBy: v.id("users"),
    createdAt: v.number(),
  }),

  // ── Shop Orders ───────────────────────────────────────────
  // Created when a participant purchases a hardcoded shop item.
  // Admins fulfil or cancel orders via Shopcampfy.
  shopOrders: defineTable({
    userId: v.id("users"),
    itemId: v.string(),          // matches SHOP_ITEMS id e.g. "shop-1"
    itemName: v.string(),
    itemIcon: v.string(),
    price: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("fulfilled"),
      v.literal("cancelled"),
    ),
    fulfilledBy: v.optional(v.id("users")),
    fulfilledAt: v.optional(v.number()),
    note: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"]),

  // ── Music Queue ───────────────────────────────────────────
  // Each row is a song in the queue. Sorted by position ascending.
  // `boostedBy` tracks who has boosted (one boost per user per song).
  musicQueue: defineTable({
    youtubeId: v.string(),
    title: v.string(),
    channelName: v.string(),
    thumbnail: v.string(),         // YouTube maxresdefault URL
    durationSeconds: v.number(),
    addedBy: v.id("users"),
    addedByName: v.string(),
    position: v.number(),          // sort key; lower = plays sooner
    boostCount: v.number(),        // total boosts received
    boostedBy: v.array(v.id("users")), // users who have boosted this song
    status: v.union(
      v.literal("queued"),
      v.literal("playing"),
      v.literal("played"),
      v.literal("removed"),
    ),
    addedAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_position", ["position"]),

  // Singleton row (id = "player") holding playback state for the venue screen.
  musicPlayer: defineTable({
    singleton: v.literal("player"),  // always "player" — ensures one row
    currentId: v.optional(v.id("musicQueue")),
    isPlaying: v.boolean(),
    startedAt: v.optional(v.number()),  // epoch ms when current song started
    pausedAt: v.optional(v.number()),   // epoch ms when paused (null = not paused)
    elapsedSeconds: v.number(),         // seconds elapsed before current play/pause
  }).index("by_singleton", ["singleton"]),

  // One row per user×song boost (prevents double-boosting)
  // One row per user×song boost — stored inline in musicQueue.boostedBy,
  // but we keep a lookup table for O(1) "has user boosted this?" queries.
  musicBoosts: defineTable({
    userId: v.id("users"),
    songId: v.id("musicQueue"),
    createdAt: v.number(),
  })
    .index("by_user_song", ["userId", "songId"])
    .index("by_song", ["songId"]),

  // One row per user×queue addition (prevents spamming multiple songs per user)
  // We track currently-queued song per user. Only one active queued/playing song at a time.

  // One row per user×song completion (admins verify at the booth)
  questCompletions: defineTable({
    questId: v.id("quests"),
    userId: v.id("users"),
    // The admin who verified and approved this completion
    verifiedBy: v.id("users"),
    // Note added by admin during verification (optional)
    note: v.optional(v.string()),
    completedAt: v.number(),
  })
    .index("by_quest", ["questId"])
    .index("by_user", ["userId"])
    .index("by_quest_user", ["questId", "userId"]),
});
