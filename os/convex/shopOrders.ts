import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Count non-cancelled orders for a given user + itemId (for per-user purchase limits)
export const countByUserAndItem = query({
  args: {
    userId: v.id("users"),
    itemId: v.string(),
  },
  handler: async (ctx, args) => {
    const orders = await ctx.db
      .query("shopOrders")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("itemId"), args.itemId))
      .collect();
    return orders.filter((o) => o.status !== "cancelled").length;
  },
});


export const create = mutation({
  args: {
    userId: v.id("users"),
    itemId: v.string(),
    itemName: v.string(),
    itemIcon: v.string(),
    price: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("shopOrders", {
      userId: args.userId,
      itemId: args.itemId,
      itemName: args.itemName,
      itemIcon: args.itemIcon,
      price: args.price,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

// List all orders (admin), newest first, with buyer display name joined
export const listAll = query({
  handler: async (ctx) => {
    const orders = await ctx.db
      .query("shopOrders")
      .order("desc")
      .collect();

    return await Promise.all(
      orders.map(async (o) => {
        const user = await ctx.db.get(o.userId);
        const fulfilledByUser = o.fulfilledBy ? await ctx.db.get(o.fulfilledBy) : null;
        return {
          ...o,
          userName: user?.displayName ?? "Unknown",
          userEmail: user?.email ?? "",
          fulfilledByName: fulfilledByUser?.displayName ?? null,
        };
      })
    );
  },
});

// Fulfil an order
export const fulfil = mutation({
  args: {
    orderId: v.id("shopOrders"),
    adminId: v.id("users"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found");
    if (order.status !== "pending") throw new Error("Order is not pending");

    await ctx.db.patch(args.orderId, {
      status: "fulfilled",
      fulfilledBy: args.adminId,
      fulfilledAt: Date.now(),
      note: args.note,
    });
  },
});

// Cancel an order and refund XP
export const cancel = mutation({
  args: {
    orderId: v.id("shopOrders"),
    adminId: v.id("users"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found");
    if (order.status === "cancelled") throw new Error("Already cancelled");

    // Refund XP if the order was pending (not already fulfilled)
    if (order.status === "pending") {
      const user = await ctx.db.get(order.userId);
      if (user) {
        const newXP = user.xp + order.price;
        await ctx.db.patch(order.userId, { xp: newXP });
        // Record refund transaction
        await ctx.db.insert("transactions", {
          userId: order.userId,
          type: "refund",
          amount: order.price,
          description: `Refund: ${order.itemName}`,
          createdAt: Date.now(),
        });
      }
    }

    await ctx.db.patch(args.orderId, {
      status: "cancelled",
      fulfilledBy: args.adminId,
      fulfilledAt: Date.now(),
      note: args.note,
    });
  },
});
