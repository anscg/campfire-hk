import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Generate OTP code
export const generate = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    // Invalidate old codes
    const oldCodes = await ctx.db
      .query("otpCodes")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .collect();

    for (const code of oldCodes) {
      await ctx.db.patch(code._id, { used: true });
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    await ctx.db.insert("otpCodes", {
      email: args.email,
      code,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
      used: false,
    });

    return code;
  },
});

// Verify OTP code
export const verify = mutation({
  args: { email: v.string(), code: v.string() },
  handler: async (ctx, args) => {
    const otpRecords = await ctx.db
      .query("otpCodes")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .collect();

    const validOTP = otpRecords.find(
      (otp) =>
        otp.code === args.code && !otp.used && otp.expiresAt > Date.now()
    );

    if (!validOTP) {
      return { success: false, error: "Invalid or expired code" };
    }

    // Mark as used
    await ctx.db.patch(validOTP._id, { used: true });

    return { success: true };
  },
});
