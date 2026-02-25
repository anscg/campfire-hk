import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function ensurePlayer(ctx: any) {
  const existing = await ctx.db
    .query("musicPlayer")
    .withIndex("by_singleton", (q: any) => q.eq("singleton", "player"))
    .first();
  if (existing) return existing;
  const id = await ctx.db.insert("musicPlayer", {
    singleton: "player",
    isPlaying: false,
    elapsedSeconds: 0,
  });
  return ctx.db.get(id);
}

async function nextPosition(ctx: any): Promise<number> {
  const last = await ctx.db
    .query("musicQueue")
    .withIndex("by_position")
    .order("desc")
    .first();
  return (last?.position ?? 0) + 1000;
}

// ── Queries ───────────────────────────────────────────────────────────────────

// Full queue (queued + playing), ordered by position asc
export const getQueue = query({
  handler: async (ctx) => {
    const items = await ctx.db
      .query("musicQueue")
      .withIndex("by_status")
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "queued"),
          q.eq(q.field("status"), "playing"),
        )
      )
      .collect();
    // Sort by position
    items.sort((a, b) => a.position - b.position);
    return items;
  },
});

// Current player state
export const getPlayer = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("musicPlayer")
      .withIndex("by_singleton", (q) => q.eq("singleton", "player"))
      .first();
  },
});

// History: last 20 played songs
export const getHistory = query({
  handler: async (ctx) => {
    const items = await ctx.db
      .query("musicQueue")
      .withIndex("by_status", (q) => q.eq("status", "played"))
      .order("desc")
      .take(20);
    return items;
  },
});

// ── Add song to queue ─────────────────────────────────────────────────────────

export const addSong = mutation({
  args: {
    userId: v.id("users"),
    youtubeId: v.string(),
    title: v.string(),
    channelName: v.string(),
    thumbnail: v.string(),
    durationSeconds: v.number(),
  },
  handler: async (ctx, args) => {
    // Check for duplicate (same youtubeId already queued or playing)
    const duplicate = await ctx.db
      .query("musicQueue")
      .filter((q) =>
        q.and(
          q.eq(q.field("youtubeId"), args.youtubeId),
          q.or(
            q.eq(q.field("status"), "queued"),
            q.eq(q.field("status"), "playing"),
          ),
        )
      )
      .first();
    if (duplicate) throw new Error("Song is already in the queue");

    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    const position = await nextPosition(ctx);

    const id = await ctx.db.insert("musicQueue", {
      youtubeId: args.youtubeId,
      title: args.title,
      channelName: args.channelName,
      thumbnail: args.thumbnail,
      durationSeconds: args.durationSeconds,
      addedBy: args.userId,
      addedByName: user.displayName,
      position,
      boostCount: 0,
      boostedBy: [],
      status: "queued",
      addedAt: Date.now(),
    });

    return id;
  },
});

// ── Boost a song ─────────────────────────────────────────────────────────────
// Rules:
//   - If not in top 10: move to position 10 (or top if < 10 queued songs)
//   - If already in top 10: move up 5 positions (swap with the song 5 ahead)
//   - One boost per user per song

export const boostSong = mutation({
  args: {
    userId: v.id("users"),
    songId: v.id("musicQueue"),
  },
  handler: async (ctx, args) => {
    const song = await ctx.db.get(args.songId);
    if (!song) throw new Error("Song not found");
    if (song.status !== "queued") throw new Error("Can only boost queued songs");
    if (song.boostedBy.includes(args.userId)) throw new Error("Already boosted this song");

    // Mark boost
    await ctx.db.patch(args.songId, {
      boostCount: song.boostCount + 1,
      boostedBy: [...song.boostedBy, args.userId],
    });

    // Get current queue (queued only, sorted by position)
    const queue = await ctx.db
      .query("musicQueue")
      .withIndex("by_status", (q) => q.eq("status", "queued"))
      .collect();
    queue.sort((a, b) => a.position - b.position);

    // Find current index of boosted song
    const idx = queue.findIndex((s) => s._id === args.songId);
    if (idx <= 0) return; // already at top or not found

    // Determine target index
    const targetIdx = idx <= 10
      ? Math.max(0, idx - 5)         // in top 10: move up 5
      : Math.max(0, queue.length - Math.min(queue.length, 10)); // outside top 10: move into position 10

    if (targetIdx >= idx) return; // nothing to do

    // Swap positions with the song currently at targetIdx
    const targetSong = queue[targetIdx];
    const myPos = song.position;
    const theirPos = targetSong.position;

    await ctx.db.patch(args.songId, { position: theirPos });
    await ctx.db.patch(targetSong._id, { position: myPos });
  },
});

// ── Player controls (admin only — trust enforced at server layer) ─────────────

export const play = mutation({
  handler: async (ctx) => {
    const player = await ensurePlayer(ctx);

    // If nothing is playing, load the first queued song
    if (!player.currentId) {
      const first = await ctx.db
        .query("musicQueue")
        .withIndex("by_status", (q) => q.eq("status", "queued"))
        .order("asc")
        .first();
      // Pick the one with lowest position
      const queued = await ctx.db
        .query("musicQueue")
        .withIndex("by_status", (q) => q.eq("status", "queued"))
        .collect();
      queued.sort((a, b) => a.position - b.position);
      const next = queued[0] ?? first;
      if (!next) return; // queue is empty

      await ctx.db.patch(next._id, { status: "playing" });
      await ctx.db.patch(player._id, {
        currentId: next._id,
        isPlaying: true,
        startedAt: Date.now(),
        pausedAt: undefined,
        elapsedSeconds: 0,
      });
      return;
    }

    // Resume from pause
    if (!player.isPlaying) {
      const now = Date.now();
      await ctx.db.patch(player._id, {
        isPlaying: true,
        startedAt: now,
        pausedAt: undefined,
      });
    }
  },
});

export const pause = mutation({
  handler: async (ctx) => {
    const player = await ensurePlayer(ctx);
    if (!player.isPlaying) return;
    const now = Date.now();
    const elapsed =
      player.elapsedSeconds +
      (player.startedAt ? (now - player.startedAt) / 1000 : 0);
    await ctx.db.patch(player._id, {
      isPlaying: false,
      pausedAt: now,
      elapsedSeconds: elapsed,
      startedAt: undefined,
    });
  },
});

export const skip = mutation({
  handler: async (ctx) => {
    const player = await ensurePlayer(ctx);
    if (player.currentId) {
      await ctx.db.patch(player.currentId, { status: "played" });
    }

    // Find next queued song (lowest position)
    const queued = await ctx.db
      .query("musicQueue")
      .withIndex("by_status", (q) => q.eq("status", "queued"))
      .collect();
    queued.sort((a, b) => a.position - b.position);
    const next = queued[0];

    if (next) {
      await ctx.db.patch(next._id, { status: "playing" });
      await ctx.db.patch(player._id, {
        currentId: next._id,
        isPlaying: true,
        startedAt: Date.now(),
        pausedAt: undefined,
        elapsedSeconds: 0,
      });
    } else {
      // Queue exhausted
      await ctx.db.patch(player._id, {
        currentId: undefined,
        isPlaying: false,
        startedAt: undefined,
        pausedAt: undefined,
        elapsedSeconds: 0,
      });
    }
  },
});

// Mark current song as done and advance (called by the player page when video ends)
export const songEnded = mutation({
  handler: async (ctx) => {
    const player = await ensurePlayer(ctx);
    if (player.currentId) {
      await ctx.db.patch(player.currentId, { status: "played" });
    }

    const queued = await ctx.db
      .query("musicQueue")
      .withIndex("by_status", (q) => q.eq("status", "queued"))
      .collect();
    queued.sort((a, b) => a.position - b.position);
    const next = queued[0];

    if (next) {
      await ctx.db.patch(next._id, { status: "playing" });
      await ctx.db.patch(player._id, {
        currentId: next._id,
        isPlaying: true,
        startedAt: Date.now(),
        pausedAt: undefined,
        elapsedSeconds: 0,
      });
    } else {
      await ctx.db.patch(player._id, {
        currentId: undefined,
        isPlaying: false,
        startedAt: undefined,
        pausedAt: undefined,
        elapsedSeconds: 0,
      });
    }
  },
});

export const removeSong = mutation({
  args: { songId: v.id("musicQueue") },
  handler: async (ctx, args) => {
    const song = await ctx.db.get(args.songId);
    if (!song) throw new Error("Song not found");

    if (song.status === "playing") {
      // If removing currently playing, skip to next
      await ctx.db.patch(args.songId, { status: "removed" });
      const player = await ctx.db
        .query("musicPlayer")
        .withIndex("by_singleton", (q) => q.eq("singleton", "player"))
        .first();

      const queued = await ctx.db
        .query("musicQueue")
        .withIndex("by_status", (q) => q.eq("status", "queued"))
        .collect();
      queued.sort((a, b) => a.position - b.position);
      const next = queued[0];

      if (player) {
        if (next) {
          await ctx.db.patch(next._id, { status: "playing" });
          await ctx.db.patch(player._id, {
            currentId: next._id,
            isPlaying: player.isPlaying,
            startedAt: player.isPlaying ? Date.now() : undefined,
            pausedAt: undefined,
            elapsedSeconds: 0,
          });
        } else {
          await ctx.db.patch(player._id, {
            currentId: undefined,
            isPlaying: false,
            startedAt: undefined,
            pausedAt: undefined,
            elapsedSeconds: 0,
          });
        }
      }
    } else {
      await ctx.db.patch(args.songId, { status: "removed" });
    }
  },
});

export const clearQueue = mutation({
  handler: async (ctx) => {
    const queued = await ctx.db
      .query("musicQueue")
      .withIndex("by_status", (q) => q.eq("status", "queued"))
      .collect();
    for (const s of queued) {
      await ctx.db.patch(s._id, { status: "removed" });
    }
  },
});

// Seek to an arbitrary position (admin only — enforced at the server layer)
export const seek = mutation({
  args: { seconds: v.number() },
  handler: async (ctx, { seconds }) => {
    const player = await ensurePlayer(ctx);
    if (!player.currentId) return;
    const clamped = Math.max(0, seconds);
    await ctx.db.patch(player._id, {
      elapsedSeconds: clamped,
      startedAt: player.isPlaying ? Date.now() : undefined,
      pausedAt: player.isPlaying ? undefined : player.pausedAt,
    });
  },
});
