import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.SERVER_PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || "campfire-os-dev-secret-change-me";
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL || "";

const convex = new ConvexHttpClient(CONVEX_URL);

const resend = new Resend(process.env.RESEND_API_KEY || "");
const RESEND_FROM = process.env.RESEND_FROM || "Campfire OS <noreply@campfire.hk>";

// ============================================================
// Cockpit participant allowlist
// ============================================================

const COCKPIT_API_KEY = process.env.COCKPIT_API_KEY || "";
const COCKPIT_EVENT_ID = process.env.COCKPIT_EVENT_ID || "rec246l5jVyPUVoL3";
const COCKPIT_BASE = "https://cockpit.hackclub.com/api/v1";

interface CockpitParticipant {
  displayName: string;
  email: string;
  checkinCompleted: boolean;
}

// In-memory cache — refreshed at most once every 5 minutes
let participantCache: Map<string, CockpitParticipant> | null = null;
let participantCacheAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getParticipants(): Promise<Map<string, CockpitParticipant>> {
  const now = Date.now();
  if (participantCache && now - participantCacheAt < CACHE_TTL_MS) {
    return participantCache;
  }

  if (!COCKPIT_API_KEY) {
    // No API key configured — return empty map (allowlist disabled in dev)
    console.warn("[Cockpit] COCKPIT_API_KEY not set — allowlist disabled");
    return new Map();
  }

  try {
    const resp = await fetch(
      `${COCKPIT_BASE}/events/${COCKPIT_EVENT_ID}/participants`,
      { headers: { "X-API-Key": COCKPIT_API_KEY, accept: "*/*" } }
    );
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = (await resp.json()) as { participants: CockpitParticipant[] };
    const map = new Map<string, CockpitParticipant>();
    for (const p of data.participants) {
      map.set(p.email.toLowerCase().trim(), p);
    }
    participantCache = map;
    participantCacheAt = now;
    console.log(`[Cockpit] Loaded ${map.size} participants`);
    return map;
  } catch (err) {
    console.error("[Cockpit] Failed to fetch participants:", err);
    // On fetch failure, fall back to the stale cache if available
    if (participantCache) return participantCache;
    // If no cache at all, fail open with empty map (so the event isn't locked out)
    return new Map();
  }
}

// Force-refresh the cache (used by an admin route)
async function refreshParticipants(): Promise<Map<string, CockpitParticipant>> {
  participantCache = null;
  participantCacheAt = 0;
  return getParticipants();
}

// ============================================================
// Email Templates
// ============================================================

function otpEmailHtml(code: string, email: string): string {
  const digits = code.split("").map((d) =>
    `<span style="
      display:inline-block;
      width:48px;height:60px;line-height:60px;
      text-align:center;
      font-size:28px;font-weight:700;
      background:#18181b;
      border:1px solid #3f3f46;
      color:#ffffff;
      margin:0 4px;
      font-family:'Courier New',Courier,monospace;
    ">${d}</span>`
  ).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#000000;font-family:'Courier New',Courier,monospace;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#000000;padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#09090b;border:1px solid #3f3f46;max-width:480px;width:100%;">

        <!-- Header bar -->
        <tr>
          <td style="background:#ea580c;padding:10px 24px;">
            <span style="color:#000;font-size:11px;font-weight:700;letter-spacing:4px;text-transform:uppercase;">CAMPFIRE OS</span>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 32px 28px;">
            <p style="margin:0 0 6px;color:#71717a;font-size:10px;letter-spacing:3px;text-transform:uppercase;">Login code for</p>
            <p style="margin:0 0 28px;color:#a1a1aa;font-size:13px;">${email}</p>

            <!-- Digit boxes -->
            <div style="text-align:center;margin-bottom:28px;">
              ${digits}
            </div>

            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="border-top:1px solid #27272a;padding-top:20px;">
                  <p style="margin:0 0 4px;color:#52525b;font-size:10px;letter-spacing:2px;text-transform:uppercase;">This code expires in 10 minutes.</p>
                  <p style="margin:0;color:#52525b;font-size:10px;">If you didn&apos;t request this, you can safely ignore this email.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="border-top:1px solid #27272a;padding:12px 24px;">
            <span style="color:#3f3f46;font-size:10px;letter-spacing:2px;">CAMPFIRE HK · os.campfire.hk</span>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:3000" }));
app.use(express.json());

// ============================================================
// Middleware: JWT Auth
// ============================================================
interface AuthRequest extends express.Request {
  userId?: string;
  userEmail?: string;
}

function authMiddleware(
  req: AuthRequest,
  res: express.Response,
  next: express.NextFunction
): void {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    res.status(401).json({ error: "No token provided" });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      email: string;
    };
    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

// ============================================================
// Auth Routes
// ============================================================

// Request OTP
app.post("/api/auth/request-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== "string") {
      res.status(400).json({ error: "Email required" });
      return;
    }

    const normalised = email.toLowerCase().trim();

    // ── Allowlist check ──────────────────────────────────────────────────────
    if (COCKPIT_API_KEY) {
      const participants = await getParticipants();
      if (!participants.has(normalised)) {
      res.status(403).json({
          error: "This email isn't on the Campfire Hong Kong participant list. Make sure you're using the email you signed up with.",
          code: "not_registered",
        });
        return;
      }
    }

    // Generate OTP via Convex
    const code = await convex.mutation(api.otp.generate, { email: normalised });

    // Send email via Resend
    if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== "re_placeholder_replace_me") {
      const { error: sendError } = await resend.emails.send({
        from: RESEND_FROM,
        to: normalised,
        subject: `${code} — your Campfire OS login code`,
        html: otpEmailHtml(code, normalised),
      });
      if (sendError) {
        console.error("[Resend] Failed to send OTP email:", sendError);
        res.status(500).json({ error: "Failed to send email" });
        return;
      }
    } else {
      // Dev fallback — log the code
      console.log(`[OTP] Code for ${normalised}: ${code}`);
    }

    res.json({ success: true, message: "OTP sent" });
  } catch (error) {
    console.error("OTP request error:", error);
    res.status(500).json({ error: "Failed to generate OTP" });
  }
});

// Verify OTP
app.post("/api/auth/verify-otp", async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      res.status(400).json({ error: "Email and code required" });
      return;
    }

    const normalised = (email as string).toLowerCase().trim();

    // Verify OTP via Convex
    const result = await convex.mutation(api.otp.verify, { email: normalised, code });

    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }

    // Look up display name from Cockpit
    let displayName: string | undefined;
    if (COCKPIT_API_KEY) {
      const participants = await getParticipants();
      const participant = participants.get(normalised);
      if (participant?.displayName) {
        displayName = participant.displayName;
      }
    }

    // Create/update user — pass Cockpit display name for new accounts
    const userId = await convex.mutation(api.users.upsertUser, {
      email: normalised,
      displayName,
    });

    // Generate JWT
    const token = jwt.sign({ userId: userId.toString(), email: normalised }, JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({ success: true, token, userId: userId.toString() });
  } catch (error) {
    console.error("OTP verify error:", error);
    res.status(500).json({ error: "Verification failed" });
  }
});

// ============================================================
// User Routes
// ============================================================

app.get("/api/user/me", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.userEmail) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const user = await convex.query(api.users.getByEmail, {
      email: req.userEmail,
    });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(user);
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Failed to get user" });
  }
});

// ============================================================
// XP Routes
// ============================================================

app.post("/api/xp/award", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { amount, reason } = req.body;
    if (!amount || !reason) {
      res.status(400).json({ error: "Amount and reason required" });
      return;
    }
    if (!req.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const result = await convex.mutation(api.users.addXP, {
      id: req.userId as any, // Convex ID type
      amount,
      reason,
    });

    res.json(result);
  } catch (error) {
    console.error("XP award error:", error);
    res.status(500).json({ error: "Failed to award XP" });
  }
});

// ============================================================
// Shop Routes
// ============================================================

// Mirror of src/lib/shopItems.ts — keyed by id for server-side validation
const HARDCODED_SHOP_ITEMS: Record<string, { name: string; price: number; icon: string; maxPerUser: number | null }> = {
  // Merch
  "shop-sticker":        { name: "1x Sticker",                  price: 100,  icon: "🎁", maxPerUser: null },
  "shop-keychain":       { name: "Keychain",                    price: 500,  icon: "🔑", maxPerUser: null },
  "shop-sticker-bundle": { name: "Sticker Bundle",              price: 500,  icon: "📦", maxPerUser: null },
  // Physical items
  "shop-rubber-duck":    { name: "Rubber Duck",                 price: 150,  icon: "🦆", maxPerUser: null },
  "shop-banana":         { name: "Banana",                      price: 400,  icon: "🍌", maxPerUser: null },
  // Food
  "shop-sweet-potato":   { name: "Sweet Potato Stick from Muji", price: 0,  icon: "🍠", maxPerUser: null },
  "shop-donut":          { name: "Donut",                       price: 880,  icon: "🍩", maxPerUser: null },
  "shop-boba":           { name: "Boba",                        price: 1000, icon: "🧋", maxPerUser: null },
  // Experiences
  "shop-handshake":      { name: "Handshake with Anson Chung",  price: 1700, icon: "🤝", maxPerUser: 1    },
  // Plushies / prizes
  "shop-small-otter":    { name: "Small Otter",                 price: 1870, icon: "🦦", maxPerUser: null },
  "shop-small-blahaj":   { name: "Small Blahaj",                price: 2000, icon: "🦈", maxPerUser: null },
  "shop-raspberry-pi":   { name: "Raspberry Pi",                price: 2300, icon: "🖥️", maxPerUser: null },
  "shop-large-otter":    { name: "Large Otter",                 price: 2900, icon: "🦦", maxPerUser: null },
  "shop-power-bank":     { name: "Power Bank",                  price: 2900, icon: "🔋", maxPerUser: null },
  "shop-large-blahaj":   { name: "Large Blahaj",                price: 3400, icon: "🦈", maxPerUser: null },
  "shop-large-octopus":  { name: "Large Octopus",               price: 3600, icon: "🐙", maxPerUser: null },
  // Perks
  "shop-jane-street":    { name: "Jane Street Swag",            price: 600,  icon: "💼", maxPerUser: 1    },
  "shop-xyz-domain":     { name: "Free .xyz Domain",            price: 1500, icon: "🌐", maxPerUser: 1    },
};

app.post(
  "/api/shop/purchase",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      if (!req.userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { itemId } = req.body;
      if (!itemId) {
        res.status(400).json({ error: "itemId required" });
        return;
      }

      const item = HARDCODED_SHOP_ITEMS[itemId];
      if (!item) {
        res.status(404).json({ error: "Item not found" });
        return;
      }

      // Load user and check XP
      const user = await convex.query(api.users.getById, { id: req.userId as any });
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      if (user.xp < item.price) {
        res.status(400).json({ error: "Insufficient XP" });
        return;
      }

      // Enforce per-user purchase limit
      if (item.maxPerUser !== null) {
        const alreadyBought = await convex.query(api.shopOrders.countByUserAndItem, {
          userId: req.userId as any,
          itemId,
        });
        if (alreadyBought >= item.maxPerUser) {
          res.status(400).json({ error: `You can only buy "${item.name}" ${item.maxPerUser === 1 ? "once" : `${item.maxPerUser} times`}` });
          return;
        }
      }

      // Deduct XP
      const result = await convex.mutation(api.users.deductXP, {
        id: req.userId as any,
        amount: item.price,
        reason: `Purchased ${item.name}`,
      });

      // Record transaction
      await convex.mutation(api.transactions.record, {
        userId: req.userId as any,
        type: "purchase",
        amount: item.price,
        description: `Purchased ${item.name}`,
      });

      // Create pending order for admin fulfilment
      await convex.mutation(api.shopOrders.create, {
        userId: req.userId as any,
        itemId: itemId,
        itemName: item.name,
        itemIcon: item.icon,
        price: item.price,
      });

      res.json({ success: true, newXP: result.xp });
    } catch (error: any) {
      console.error("Purchase error:", error);
      res.status(400).json({ error: error?.message || "Purchase failed" });
    }
  }
);

// ============================================================
// Transaction Routes
// ============================================================

app.get(
  "/api/transactions",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      if (!req.userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const transactions = await convex.query(api.transactions.getByUser, {
        userId: req.userId as any,
      });
      res.json(transactions);
    } catch (error) {
      console.error("Transactions error:", error);
      res.status(500).json({ error: "Failed to get transactions" });
    }
  }
);

// ============================================================
// Group Routes
// ============================================================

// List all groups (public)
app.get("/api/groups", async (_req, res) => {
  try {
    const groups = await convex.query(api.groups.list);
    res.json(groups);
  } catch (error) {
    console.error("Groups list error:", error);
    res.status(500).json({ error: "Failed to list groups" });
  }
});

// Get current user's group
app.get("/api/groups/me", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const group = await convex.query(api.groups.getByUser, {
      userId: req.userId as any,
    });
    res.json(group);
  } catch (error) {
    console.error("Get user group error:", error);
    res.status(500).json({ error: "Failed to get group" });
  }
});

// Create a new group
app.post("/api/groups/create", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== "string" || !name.trim()) {
      res.status(400).json({ error: "Group name required" });
      return;
    }
    if (!req.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const result = await convex.mutation(api.groups.create, {
      name: name.trim(),
      userId: req.userId as any,
    });
    res.json(result);
  } catch (error: any) {
    console.error("Create group error:", error);
    res.status(400).json({ error: error?.message || "Failed to create group" });
  }
});

// Join a group via invite code
app.post("/api/groups/join", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { inviteCode } = req.body;
    if (!inviteCode || typeof inviteCode !== "string") {
      res.status(400).json({ error: "Invite code required" });
      return;
    }
    if (!req.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const result = await convex.mutation(api.groups.join, {
      inviteCode: inviteCode.trim(),
      userId: req.userId as any,
    });
    res.json(result);
  } catch (error: any) {
    console.error("Join group error:", error);
    res.status(400).json({ error: error?.message || "Failed to join group" });
  }
});

// Leave a group
app.post("/api/groups/leave", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    await convex.mutation(api.groups.leave, {
      userId: req.userId as any,
    });
    res.json({ success: true });
  } catch (error: any) {
    console.error("Leave group error:", error);
    res.status(400).json({ error: error?.message || "Failed to leave group" });
  }
});

// ============================================================
// CampPay Routes
// ============================================================

// In-memory QR payment requests (5-min TTL)
interface QRPaymentRequest {
  token: string;
  requesterId: string;
  requesterName: string;
  amount: number;
  note: string;
  createdAt: number;
  paid: boolean;
  paidBy?: string;
}
const qrRequests = new Map<string, QRPaymentRequest>();

function cleanExpiredQRRequests() {
  const now = Date.now();
  for (const [token, req] of qrRequests.entries()) {
    if (now - req.createdAt > 5 * 60 * 1000) qrRequests.delete(token);
  }
}

// List all users for recipient picker
app.get("/api/pay/users", authMiddleware, async (_req, res) => {
  try {
    const users = await convex.query(api.users.listUsers);
    res.json(users);
  } catch (error) {
    console.error("Pay users error:", error);
    res.status(500).json({ error: "Failed to list users" });
  }
});

// Direct transfer (send XP to another user)
app.post("/api/pay/send", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { toUserId, amount, note } = req.body;
    if (!toUserId || !amount) {
      res.status(400).json({ error: "toUserId and amount required" });
      return;
    }
    if (typeof amount !== "number" || amount <= 0 || !Number.isInteger(amount)) {
      res.status(400).json({ error: "Amount must be a positive integer" });
      return;
    }
    if (!req.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const result = await convex.mutation(api.users.transferXP, {
      fromId: req.userId as any,
      toId: toUserId as any,
      amount,
      note: note || undefined,
    });
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error("Pay send error:", error);
    res.status(400).json({ error: error?.message || "Transfer failed" });
  }
});

// Create a QR payment request
app.post("/api/pay/qr/create", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { amount, note } = req.body;
    if (!amount || typeof amount !== "number" || amount <= 0 || !Number.isInteger(amount)) {
      res.status(400).json({ error: "Amount must be a positive integer" });
      return;
    }
    if (!req.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Look up requester name
    const requester = await convex.query(api.users.getById, { id: req.userId as any });
    if (!requester) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    cleanExpiredQRRequests();

    const token = randomBytes(5).toString("hex").toUpperCase();
    const clientUrl = process.env.NEXT_PUBLIC_CLIENT_URL || "http://localhost:3000";
    const payUrl = `${clientUrl}/#camppay?pay=${token}`;

    qrRequests.set(token, {
      token,
      requesterId: req.userId,
      requesterName: requester.displayName,
      amount,
      note: note || "",
      createdAt: Date.now(),
      paid: false,
    });

    res.json({ token, url: payUrl });
  } catch (error: any) {
    console.error("QR create error:", error);
    res.status(500).json({ error: "Failed to create QR request" });
  }
});

// Get QR payment request details (public — sender needs this to confirm)
app.get("/api/pay/qr/:token", (req, res) => {
  cleanExpiredQRRequests();
  const tokenParam = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
  const entry = qrRequests.get(tokenParam);
  if (!entry) {
    res.status(404).json({ error: "Payment request not found or expired" });
    return;
  }
  res.json({
    token: entry.token,
    requesterName: entry.requesterName,
    amount: entry.amount,
    note: entry.note,
    paid: entry.paid,
  });
});

// Pay a QR request
app.post("/api/pay/qr/:token/pay", authMiddleware, async (req: AuthRequest, res) => {
  try {
    cleanExpiredQRRequests();
    const tokenParam = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
    const entry = qrRequests.get(tokenParam);
    if (!entry) {
      res.status(404).json({ error: "Payment request not found or expired" });
      return;
    }
    if (entry.paid) {
      res.status(400).json({ error: "Already paid" });
      return;
    }
    if (!req.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (entry.requesterId === req.userId) {
      res.status(400).json({ error: "Cannot pay your own request" });
      return;
    }

    const result = await convex.mutation(api.users.transferXP, {
      fromId: req.userId as any,
      toId: entry.requesterId as any,
      amount: entry.amount,
      note: entry.note || undefined,
    });

    entry.paid = true;
    entry.paidBy = req.userId;

    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error("QR pay error:", error);
    res.status(400).json({ error: error?.message || "Payment failed" });
  }
});

// ============================================================
// Quest Routes
// ============================================================

// Middleware: must be admin
function adminMiddleware(
  req: AuthRequest,
  res: express.Response,
  next: express.NextFunction
): void {
  // adminMiddleware must be chained after authMiddleware
  // Re-fetch isAdmin from Convex is async — we attach it lazily via a helper.
  // Instead, we mark the request in authMiddleware via the JWT payload.
  // For simplicity, the isAdmin check happens inside each admin handler.
  next();
}

// GET /api/quests — participant: list active quests with my completion status
app.get("/api/quests", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const quests = await convex.query(api.quests.listForUser, {
      userId: req.userId as any,
    });
    res.json(quests);
  } catch (error) {
    console.error("Quest list error:", error);
    res.status(500).json({ error: "Failed to list quests" });
  }
});

// GET /api/admin/quests — admin: list all quests with completions
app.get("/api/admin/quests", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const user = await convex.query(api.users.getById, { id: req.userId as any });
    if (!user?.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }
    const quests = await convex.query(api.quests.listAll);
    res.json(quests);
  } catch (error) {
    console.error("Admin quest list error:", error);
    res.status(500).json({ error: "Failed to list quests" });
  }
});

// POST /api/admin/quests — admin: create a quest
app.post("/api/admin/quests", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const user = await convex.query(api.users.getById, { id: req.userId as any });
    if (!user?.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }
    const { title, description, xpReward, maxCompletions, icon } = req.body;
    if (!title || !description || !xpReward) {
      res.status(400).json({ error: "title, description, xpReward required" });
      return;
    }
    const result = await convex.mutation(api.quests.create, {
      title,
      description,
      xpReward: Number(xpReward),
      maxCompletions: maxCompletions ? Number(maxCompletions) : undefined,
      icon: icon || undefined,
      createdBy: req.userId as any,
    });
    res.json(result);
  } catch (error: any) {
    console.error("Create quest error:", error);
    res.status(400).json({ error: error?.message || "Failed to create quest" });
  }
});

// PATCH /api/admin/quests/:id — admin: update quest fields or toggle active
app.patch("/api/admin/quests/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const user = await convex.query(api.users.getById, { id: req.userId as any });
    if (!user?.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }
    const { id } = req.params;
    const { active, title, description, xpReward, maxCompletions, icon } = req.body;

    if (active !== undefined) {
      await convex.mutation(api.quests.setActive, { questId: id as any, active: !!active });
    }
    if (title !== undefined || description !== undefined || xpReward !== undefined || maxCompletions !== undefined || icon !== undefined) {
      await convex.mutation(api.quests.update, {
        questId: id as any,
        title: title ?? undefined,
        description: description ?? undefined,
        xpReward: xpReward !== undefined ? Number(xpReward) : undefined,
        maxCompletions: maxCompletions !== undefined ? Number(maxCompletions) : undefined,
        icon: icon ?? undefined,
      });
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error("Update quest error:", error);
    res.status(400).json({ error: error?.message || "Failed to update quest" });
  }
});

// POST /api/admin/quests/:id/verify — admin: verify a participant's quest completion
app.post("/api/admin/quests/:id/verify", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const user = await convex.query(api.users.getById, { id: req.userId as any });
    if (!user?.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }
    const { id: questId } = req.params;
    const { userId, note } = req.body;
    if (!userId) { res.status(400).json({ error: "userId required" }); return; }
    const result = await convex.mutation(api.quests.verify, {
      questId: questId as any,
      userId: userId as any,
      adminId: req.userId as any,
      note: note || undefined,
    });
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error("Verify quest error:", error);
    res.status(400).json({ error: error?.message || "Failed to verify quest" });
  }
});

// DELETE /api/admin/quests/:questId/completions/:userId — admin: revoke a completion
app.delete(
  "/api/admin/quests/:questId/completions/:userId",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      if (!req.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
      const user = await convex.query(api.users.getById, { id: req.userId as any });
      if (!user?.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }
      const { questId, userId } = req.params;
      await convex.mutation(api.quests.revokeCompletion, {
        questId: questId as any,
        userId: userId as any,
        adminId: req.userId as any,
      });
      res.json({ success: true });
    } catch (error: any) {
      console.error("Revoke completion error:", error);
      res.status(400).json({ error: error?.message || "Failed to revoke completion" });
    }
  }
);

// DELETE /api/admin/quests/:id — admin: permanently delete a quest
app.delete("/api/admin/quests/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const user = await convex.query(api.users.getById, { id: req.userId as any });
    if (!user?.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }
    const { id } = req.params;
    await convex.mutation(api.quests.deleteQuest, { questId: id as any });
    res.json({ success: true });
  } catch (error: any) {
    console.error("Delete quest error:", error);
    res.status(400).json({ error: error?.message || "Failed to delete quest" });
  }
});

// POST /api/admin/quests/seed — admin: bulk-seed the real quest list
const SEED_QUESTS: Array<{
  title: string; description: string; xpReward: number;
  maxCompletions?: number; icon?: string;
  category: "main" | "side" | "hidden";
  teaserDescription?: string;
}> = [
  // ── MAIN: everyone can obtain ──────────────────────────────────────────────
  // Day 1
  { category: "main", title: "Check In (Day 1)", description: "Check in at the event on Day 1.", xpReward: 100, icon: "📋" },
  { category: "main", title: "Stand for an Hour", description: "Stand up for at least an hour during Day 1.", xpReward: 400, icon: "🧍" },
  { category: "main", title: "Water Quest (Day 1)", description: "Stay hydrated — complete the water quest on Day 1.", xpReward: 600, icon: "💧" },
  { category: "main", title: "Clean Desk After Lunch (Day 1)", description: "Clean your desk after lunch on Day 1.", xpReward: 300, icon: "🧹" },
  { category: "main", title: "Workshop 1", description: "Attend and participate in Workshop 1.", xpReward: 350, icon: "🎓" },
  { category: "main", title: "Demo 1", description: "Present at Demo 1.", xpReward: 450, icon: "🎤" },
  { category: "main", title: "Ask Questions in Music Talk", description: "Ask at least one question during the music talk.", xpReward: 250, icon: "🎵" },
  // Day 2
  { category: "main", title: "Check In Before 9:15 (Day 2)", description: "Check in before 9:15 AM on Day 2.", xpReward: 150, icon: "⏰" },
  { category: "main", title: "Water Quest (Day 2)", description: "Stay hydrated — complete the water quest on Day 2.", xpReward: 600, icon: "💧" },
  { category: "main", title: "Clean Desk (Day 2)", description: "Clean your desk on Day 2.", xpReward: 200, icon: "🧹" },
  { category: "main", title: "Workshop 2", description: "Attend and participate in Workshop 2.", xpReward: 300, icon: "🎓" },
  { category: "main", title: "Demo 2", description: "Present at Demo 2.", xpReward: 450, icon: "🎤" },
  // Side activities
  { category: "main", title: "Introduce Game to Orgs", description: "Introduce your game to an organisation.", xpReward: 200, icon: "🤝" },
  { category: "main", title: "Participate in Minigame", description: "Participate in a minigame.", xpReward: 300, icon: "🎮" },
  // Game jam — everyone gets participation
  { category: "main", title: "Game Jam: Participant", description: "Participate in the game jam and present your work.", xpReward: 500, icon: "🎮" },

  // ── SIDE: mutually exclusive / competitive ─────────────────────────────────
  { category: "side", title: "Game Jam: 1st Place", description: "Win 1st place in the game jam.", xpReward: 1500, maxCompletions: 1, icon: "🥇" },
  { category: "side", title: "Game Jam: 2nd Place", description: "Win 2nd place in the game jam.", xpReward: 1250, maxCompletions: 1, icon: "🥈" },
  { category: "side", title: "Game Jam: 3rd Place", description: "Win 3rd place in the game jam.", xpReward: 1000, maxCompletions: 1, icon: "🥉" },
  { category: "side", title: "Game Jam: Special Award", description: "Win a special award at the game jam.", xpReward: 750, icon: "⭐" },
  { category: "side", title: "Minigame: 1st Place", description: "Win 1st place in a minigame.", xpReward: 1000, icon: "🏅" },
  { category: "side", title: "Minigame: 2nd Place", description: "Win 2nd place in a minigame.", xpReward: 750, icon: "🥈" },
  { category: "side", title: "Minigame: 3rd Place", description: "Win 3rd place in a minigame.", xpReward: 550, icon: "🥉" },
  { category: "side", title: "Minigame: Last Place", description: "Come last in a minigame — participation award.", xpReward: 300, icon: "🐢" },

  // ── HIDDEN: secret achievements — objective & reward obfuscated from participants ─
  {
    category: "hidden",
    title: "Code Hunters",
    teaserDescription: "Secrets are hidden in plain sight.",
    description: "Find the secret code hidden somewhere at the event. Show it to a staff member to claim.",
    xpReward: 1000, maxCompletions: 3, icon: "🔍",
  },
  {
    category: "hidden",
    title: "Smartest Person on Earth",
    teaserDescription: "Only the truly enlightened can claim this.",
    description: "Buy \"Handshake With Anson Chung\" from the shop. Only one person can ever hold this title.",
    xpReward: 1700, maxCompletions: 1, icon: "🧠",
  },
  {
    category: "hidden",
    title: "The Monkey",
    teaserDescription: "Go bananas.",
    description: "Purchase \"A Bunch of Bananas\" from the shop. Quota: 2 groups.",
    xpReward: 1400, maxCompletions: 2, icon: "🐒",
  },
  {
    category: "hidden",
    title: "Quest Hunter",
    teaserDescription: "Leave nothing on the table.",
    description: "Complete 90% or more of the main quests. Unlimited slots.",
    xpReward: 1600, icon: "🏹",
  },
  {
    category: "hidden",
    title: "Very Broke",
    teaserDescription: "Sometimes less is more.",
    description: "Be the poorest participant by the end of Day 1 (must have more than 10 XP remaining). Can tie. Quota: 1.",
    xpReward: 1000, maxCompletions: 1, icon: "💸",
  },
  {
    category: "hidden",
    title: "Literally Bill Gates",
    teaserDescription: "Money is just a number.",
    description: "Be the richest participant by the end of Day 1. Can tie. Quota: 1.",
    xpReward: 200, maxCompletions: 1, icon: "💰",
  },
  {
    category: "hidden",
    title: "Boba Addict",
    teaserDescription: "You can never have just one.",
    description: "Buy \"Boba\" from the shop more than once.",
    xpReward: 1000, icon: "🧋",
  },
  {
    category: "hidden",
    title: "Shameless Advertising",
    teaserDescription: "Spread the word.",
    description: "Tell more than 2 groups or organisations about your game. Unlimited slots.",
    xpReward: 670, icon: "📣",
  },
  {
    category: "hidden",
    title: "Gimme That Shiz",
    teaserDescription: "First come, first served.",
    description: "Be the first person to transfer XP to another participant. Quota: 1.",
    xpReward: 800, maxCompletions: 1, icon: "🛍️",
  },
  {
    category: "hidden",
    title: "Lowkey Brainrotted",
    teaserDescription: "Some things can't be unseen.",
    description: "Do the 67 hands to any orgs. Quota: 1.",
    xpReward: 400, maxCompletions: 1, icon: "🤡",
  },
  {
    category: "hidden",
    title: "Minigame Master",
    teaserDescription: "Consistent excellence.",
    description: "Podium in more than one minigame. Unlimited slots.",
    xpReward: 800, icon: "🏆",
  },
];

app.post("/api/admin/quests/seed", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const user = await convex.query(api.users.getById, { id: req.userId as any });
    if (!user?.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }
    const result = await convex.mutation(api.quests.seedQuests, {
      quests: SEED_QUESTS,
      createdBy: req.userId as any,
    });
    res.json(result);
  } catch (error: any) {
    console.error("Seed quests error:", error);
    res.status(500).json({ error: error?.message || "Failed to seed quests" });
  }
});

// GET /api/admin/users/search?q=... — admin: search users for verification
app.get("/api/admin/users/search", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const user = await convex.query(api.users.getById, { id: req.userId as any });
    if (!user?.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }
    const q = (req.query.q as string) || "";
    const results = await convex.query(api.quests.searchUsers, { query: q });
    res.json(results);
  } catch (error) {
    console.error("User search error:", error);
    res.status(500).json({ error: "Failed to search users" });
  }
});

// POST /api/admin/participants/refresh — admin: force-refresh the Cockpit participant cache
app.post("/api/admin/participants/refresh", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const user = await convex.query(api.users.getById, { id: req.userId as any });
    if (!user?.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }
    const map = await refreshParticipants();
    res.json({ success: true, count: map.size });
  } catch (error: any) {
    console.error("Participant refresh error:", error);
    res.status(500).json({ error: error?.message || "Failed to refresh participants" });
  }
});

// POST /api/admin/xp — admin: add or subtract XP from any user
app.post("/api/admin/xp", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const admin = await convex.query(api.users.getById, { id: req.userId as any });
    if (!admin?.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }

    const { userId, amount, reason } = req.body;
    if (!userId || typeof amount !== "number" || !reason?.trim()) {
      res.status(400).json({ error: "userId, amount (number), and reason are required" });
      return;
    }

    const target = await convex.query(api.users.getById, { id: userId as any });
    if (!target) { res.status(404).json({ error: "User not found" }); return; }

    let result: { xp: number; level: number };
    if (amount > 0) {
      result = await convex.mutation(api.users.addXP, {
        id: userId as any,
        amount,
        reason: `[Admin] ${reason.trim()}`,
      });
      await convex.mutation(api.transactions.record, {
        userId: userId as any,
        type: "earn",
        amount,
        description: `[Admin] ${reason.trim()}`,
      });
    } else if (amount < 0) {
      // Clamp deduction to available XP
      const deduct = Math.min(Math.abs(amount), target.xp);
      if (deduct === 0) {
        res.status(400).json({ error: "User has 0 XP, nothing to deduct" });
        return;
      }
      result = await convex.mutation(api.users.deductXP, {
        id: userId as any,
        amount: deduct,
        reason: `[Admin] ${reason.trim()}`,
      });
      await convex.mutation(api.transactions.record, {
        userId: userId as any,
        type: "purchase",
        amount: deduct,
        description: `[Admin deduction] ${reason.trim()}`,
      });
    } else {
      res.status(400).json({ error: "Amount cannot be zero" });
      return;
    }

    res.json({ success: true, newXP: result.xp, newLevel: result.level });
  } catch (error: any) {
    console.error("Admin XP error:", error);
    res.status(400).json({ error: error?.message || "Failed to adjust XP" });
  }
});

// ============================================================
// Shop Order Admin Routes
// ============================================================

// GET /api/admin/orders — list all shop orders (admin only)
app.get("/api/admin/orders", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const admin = await convex.query(api.users.getById, { id: req.userId as any });
    if (!admin?.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }
    const orders = await convex.query(api.shopOrders.listAll);
    res.json(orders);
  } catch (error: any) {
    console.error("List orders error:", error);
    res.status(500).json({ error: "Failed to list orders" });
  }
});

// POST /api/admin/orders/:id/fulfil — fulfil a pending order
app.post("/api/admin/orders/:id/fulfil", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const admin = await convex.query(api.users.getById, { id: req.userId as any });
    if (!admin?.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }
    const { id } = req.params;
    const { note } = req.body;
    await convex.mutation(api.shopOrders.fulfil, {
      orderId: id as any,
      adminId: req.userId as any,
      note: note || undefined,
    });
    res.json({ success: true });
  } catch (error: any) {
    console.error("Fulfil order error:", error);
    res.status(400).json({ error: error?.message || "Failed to fulfil order" });
  }
});

// POST /api/admin/orders/:id/cancel — cancel a pending order and refund XP
app.post("/api/admin/orders/:id/cancel", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const admin = await convex.query(api.users.getById, { id: req.userId as any });
    if (!admin?.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }
    const { id } = req.params;
    const { note } = req.body;
    await convex.mutation(api.shopOrders.cancel, {
      orderId: id as any,
      adminId: req.userId as any,
      note: note || undefined,
    });
    res.json({ success: true });
  } catch (error: any) {
    console.error("Cancel order error:", error);
    res.status(400).json({ error: error?.message || "Failed to cancel order" });
  }
});

// POST /api/admin/set-admin — promote/demote a user (requires ADMIN_SECRET header)
app.post("/api/admin/set-admin", async (req, res) => {
  try {
    const secret = req.headers["x-admin-secret"];
    const ADMIN_SECRET = process.env.ADMIN_SECRET || "campfire-admin-secret";
    if (secret !== ADMIN_SECRET) {
      res.status(403).json({ error: "Invalid admin secret" });
      return;
    }
    const { email, isAdmin } = req.body;
    if (!email) { res.status(400).json({ error: "email required" }); return; }
    const user = await convex.query(api.users.getByEmail, { email });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    await convex.mutation(api.users.setAdmin, { id: user._id, isAdmin: !!isAdmin });
    res.json({ success: true, userId: user._id, isAdmin: !!isAdmin });
  } catch (error: any) {
    console.error("Set admin error:", error);
    res.status(500).json({ error: "Failed to set admin" });
  }
});

// ============================================================
// Leaderboard Routes
// ============================================================

app.get("/api/leaderboard", async (_req, res) => {
  try {
    const leaderboard = await convex.query(api.users.getLeaderboard);
    res.json(leaderboard);
  } catch (error) {
    console.error("Leaderboard error:", error);
    res.status(500).json({ error: "Failed to get leaderboard" });
  }
});

// ============================================================
// Health check
// ============================================================
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

// ============================================================
// Music Queue Routes
// ============================================================

// GET /api/music/queue — public, returns active queue + player state
app.get("/api/music/queue", async (_req, res) => {
  try {
    const [queue, player] = await Promise.all([
      convex.query(api.music.getQueue),
      convex.query(api.music.getPlayer),
    ]);
    res.json({ queue, player });
  } catch (error) {
    console.error("Music queue error:", error);
    res.status(500).json({ error: "Failed to get queue" });
  }
});

// GET /api/music/history — public, last 20 played songs
app.get("/api/music/history", async (_req, res) => {
  try {
    const history = await convex.query(api.music.getHistory);
    res.json(history);
  } catch (error) {
    console.error("Music history error:", error);
    res.status(500).json({ error: "Failed to get history" });
  }
});

// POST /api/music/add — authenticated: add a song to the queue (costs 10 XP)
const ADD_XP_COST = 10;
app.post("/api/music/add", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const user = await convex.query(api.users.getById, { id: req.userId as any });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    // Admins add for free
    if (!user.isAdmin && user.xp < ADD_XP_COST) {
      res.status(400).json({ error: `Insufficient XP (need ${ADD_XP_COST})` });
      return;
    }
    const { youtubeId, title, channelName, thumbnail, durationSeconds } = req.body;
    if (!youtubeId || !title) {
      res.status(400).json({ error: "youtubeId and title are required" });
      return;
    }
    const id = await convex.mutation(api.music.addSong, {
      userId: req.userId as any,
      youtubeId,
      title,
      channelName: channelName || "",
      thumbnail: thumbnail || `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`,
      durationSeconds: durationSeconds || 0,
    });
    if (!user.isAdmin) {
      await convex.mutation(api.users.deductXP, {
        id: req.userId as any,
        amount: ADD_XP_COST,
        reason: "Added a song to the music queue",
      });
      await convex.mutation(api.transactions.record, {
        userId: req.userId as any,
        type: "purchase",
        amount: ADD_XP_COST,
        description: `Added song to queue: ${title}`,
      });
    }
    res.json({ success: true, id });
  } catch (error: any) {
    console.error("Music add error:", error);
    res.status(400).json({ error: error?.message || "Failed to add song" });
  }
});

// POST /api/music/boost/:id — authenticated: boost a song (costs 25 XP)
const BOOST_XP_COST = 25;
app.post("/api/music/boost/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const user = await convex.query(api.users.getById, { id: req.userId as any });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    if (user.xp < BOOST_XP_COST) { res.status(400).json({ error: `Insufficient XP (need ${BOOST_XP_COST})` }); return; }
    await convex.mutation(api.music.boostSong, {
      userId: req.userId as any,
      songId: req.params.id as any,
    });
    const result = await convex.mutation(api.users.deductXP, {
      id: req.userId as any,
      amount: BOOST_XP_COST,
      reason: "Boosted a song in the music queue",
    });
    await convex.mutation(api.transactions.record, {
      userId: req.userId as any,
      type: "purchase",
      amount: BOOST_XP_COST,
      description: "Boosted a song in the music queue",
    });
    res.json({ success: true, newXP: result.xp });
  } catch (error: any) {
    console.error("Music boost error:", error);
    res.status(400).json({ error: error?.message || "Failed to boost song" });
  }
});

// POST /api/music/seek — admin only: seek to a position in the current song
app.post("/api/music/seek", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const user = await convex.query(api.users.getById, { id: req.userId as any });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    if (!user.isAdmin) { res.status(403).json({ error: "Admin only" }); return; }
    const seconds = Number(req.body.seconds);
    if (isNaN(seconds) || seconds < 0) {
      res.status(400).json({ error: "Invalid seconds" });
      return;
    }
    await convex.mutation(api.music.seek, { seconds });
    res.json({ success: true });
  } catch (error: any) {
    console.error("Music seek error:", error);
    res.status(400).json({ error: error?.message || "Failed to seek" });
  }
});

// POST /api/music/participant-stop — authenticated participant: stop current song (costs 150 XP)
const STOP_XP_COST = 150;
app.post("/api/music/participant-stop", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const user = await convex.query(api.users.getById, { id: req.userId as any });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    if (user.xp < STOP_XP_COST) { res.status(400).json({ error: `Insufficient XP (need ${STOP_XP_COST})` }); return; }
    await convex.mutation(api.music.pause);
    const result = await convex.mutation(api.users.deductXP, {
      id: req.userId as any,
      amount: STOP_XP_COST,
      reason: "Stopped the music",
    });
    await convex.mutation(api.transactions.record, {
      userId: req.userId as any,
      type: "purchase",
      amount: STOP_XP_COST,
      description: "Stopped the music",
    });
    res.json({ success: true, newXP: result.xp });
  } catch (error: any) {
    console.error("Music participant-stop error:", error);
    res.status(400).json({ error: error?.message || "Failed to stop music" });
  }
});

// POST /api/music/participant-skip — authenticated participant: skip current song (costs 350 XP)
const SKIP_XP_COST = 350;
app.post("/api/music/participant-skip", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const user = await convex.query(api.users.getById, { id: req.userId as any });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    if (user.xp < SKIP_XP_COST) { res.status(400).json({ error: `Insufficient XP (need ${SKIP_XP_COST})` }); return; }
    await convex.mutation(api.music.skip);
    const result = await convex.mutation(api.users.deductXP, {
      id: req.userId as any,
      amount: SKIP_XP_COST,
      reason: "Skipped a song in the music queue",
    });
    await convex.mutation(api.transactions.record, {
      userId: req.userId as any,
      type: "purchase",
      amount: SKIP_XP_COST,
      description: "Skipped a song in the music queue",
    });
    res.json({ success: true, newXP: result.xp });
  } catch (error: any) {
    console.error("Music participant-skip error:", error);
    res.status(400).json({ error: error?.message || "Failed to skip song" });
  }
});

// POST /api/music/play — admin only
app.post("/api/music/play", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const admin = await convex.query(api.users.getById, { id: req.userId as any });
    if (!admin?.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }
    await convex.mutation(api.music.play);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Music play error:", error);
    res.status(400).json({ error: error?.message || "Failed" });
  }
});

// POST /api/music/pause — admin only
app.post("/api/music/pause", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const admin = await convex.query(api.users.getById, { id: req.userId as any });
    if (!admin?.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }
    await convex.mutation(api.music.pause);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Music pause error:", error);
    res.status(400).json({ error: error?.message || "Failed" });
  }
});

// POST /api/music/skip — admin only
app.post("/api/music/skip", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const admin = await convex.query(api.users.getById, { id: req.userId as any });
    if (!admin?.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }
    await convex.mutation(api.music.skip);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Music skip error:", error);
    res.status(400).json({ error: error?.message || "Failed" });
  }
});

// POST /api/music/song-ended — called by player page when a video finishes naturally
app.post("/api/music/song-ended", async (_req, res) => {
  try {
    await convex.mutation(api.music.songEnded);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Music song-ended error:", error);
    res.status(400).json({ error: error?.message || "Failed" });
  }
});

// DELETE /api/music/remove/:id — admin only
app.delete("/api/music/remove/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const admin = await convex.query(api.users.getById, { id: req.userId as any });
    if (!admin?.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }
    await convex.mutation(api.music.removeSong, { songId: req.params.id as any });
    res.json({ success: true });
  } catch (error: any) {
    console.error("Music remove error:", error);
    res.status(400).json({ error: error?.message || "Failed to remove song" });
  }
});

// DELETE /api/music/clear — admin only
app.delete("/api/music/clear", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const admin = await convex.query(api.users.getById, { id: req.userId as any });
    if (!admin?.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }
    await convex.mutation(api.music.clearQueue);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Music clear error:", error);
    res.status(400).json({ error: error?.message || "Failed to clear queue" });
  }
});

// ============================================================
// Stocks
// ============================================================

const STOCK_DEFS = [
  { ticker: "CAMPF",  name: "Campfire Inc.",     icon: "🔥", startPrice: 100 },
  { ticker: "HACKC",  name: "Hack Club",          icon: "🏴‍☠️", startPrice: 80  },
  { ticker: "BOBA",   name: "Boba Corp.",          icon: "🧋", startPrice: 50  },
  { ticker: "SLEEPZ", name: "SleepZ Holdings",    icon: "😴", startPrice: 30  },
  { ticker: "CRUNCH", name: "CrunchTime Ltd.",    icon: "💻", startPrice: 60  },
  { ticker: "MEMER",  name: "Meme Exchange",      icon: "🐸", startPrice: 40  },
  { ticker: "BAGEL",  name: "Bagel Finance",      icon: "🥯", startPrice: 70  },
  { ticker: "VIBE",   name: "VibeCheck Capital",  icon: "✨", startPrice: 90  },
];

// Seed + start the price tick loop once on startup
(async () => {
  try {
    await convex.mutation(api.stocks.resetStocks);
    console.log("[Stocks] Reset stock prices to start values");
  } catch (e) {
    console.error("[Stocks] Reset error:", e);
  }

  // Tick every 4 seconds
  setInterval(async () => {
    try {
      // Gather total shares per ticker from Convex
      const holdings: { ticker: string; totalShares: number }[] = [];
      for (const def of STOCK_DEFS) {
        const rows = await convex.query(api.stocks.getTickerHoldings, { ticker: def.ticker });
        const total = rows.reduce((sum: number, r: any) => sum + r.shares, 0);
        holdings.push({ ticker: def.ticker, totalShares: total });
      }
      await convex.mutation(api.stocks.tick, { holdings });
    } catch (e) {
      // silent — don't crash the server on a failed tick
    }
  }, 2000);
})();

// GET /api/stocks/prices — public
app.get("/api/stocks/prices", async (_req, res) => {
  try {
    const prices = await convex.query(api.stocks.getPrices);
    // Enrich with static metadata
    const enriched = STOCK_DEFS.map((def) => {
      const row = prices.find((p: any) => p.ticker === def.ticker);
      return {
        ticker: def.ticker,
        name: def.name,
        icon: def.icon,
        startPrice: def.startPrice,
        price: row?.price ?? def.startPrice,
        history: row?.history ?? [def.startPrice],
        updatedAt: row?.updatedAt ?? Date.now(),
      };
    });
    res.json(enriched);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed" });
  }
});

// GET /api/stocks/portfolio — authenticated
app.get("/api/stocks/portfolio", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const holdings = await convex.query(api.stocks.getHoldings, { userId: req.userId as any });
    res.json(holdings);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed" });
  }
});

// POST /api/stocks/buy
app.post("/api/stocks/buy", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const { ticker, shares } = req.body;
    if (!ticker || !shares || shares < 1) {
      res.status(400).json({ error: "ticker and shares (>=1) required" }); return;
    }
    const def = STOCK_DEFS.find((d) => d.ticker === ticker);
    if (!def) { res.status(400).json({ error: "Unknown ticker" }); return; }

    // Get current price
    const prices = await convex.query(api.stocks.getPrices);
    const row = prices.find((p: any) => p.ticker === ticker);
    const price: number = row?.price ?? def.startPrice;
    const totalCost = Math.round(price * shares);

    // Check XP
    const user = await convex.query(api.users.getById, { id: req.userId as any });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    if (user.xp < totalCost) {
      res.status(400).json({ error: `Insufficient XP (need ${totalCost}, have ${user.xp})` }); return;
    }

    // Deduct XP
    await convex.mutation(api.users.deductXP, {
      id: req.userId as any,
      amount: totalCost,
      reason: `Bought ${shares}x ${ticker} @ ${price} XP/share`,
    });

    // Record holding
    await convex.mutation(api.stocks.buyStock, {
      userId: req.userId as any,
      ticker,
      shares,
      pricePerShare: price,
    });

    // Log transaction for Receipts
    await convex.mutation(api.transactions.record, {
      userId: req.userId as any,
      type: "purchase",
      amount: totalCost,
      description: `Bought ${shares}x ${ticker} @ ${price.toFixed(2)} XP/share`,
    });

    const updated = await convex.query(api.users.getById, { id: req.userId as any });
    res.json({ success: true, spent: totalCost, pricePerShare: price, newXP: updated?.xp });
  } catch (error: any) {
    console.error("Stocks buy error:", error);
    res.status(400).json({ error: error?.message || "Failed to buy" });
  }
});

// POST /api/stocks/sell
app.post("/api/stocks/sell", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const { ticker, shares } = req.body;
    if (!ticker || !shares || shares < 1) {
      res.status(400).json({ error: "ticker and shares (>=1) required" }); return;
    }
    const def = STOCK_DEFS.find((d) => d.ticker === ticker);
    if (!def) { res.status(400).json({ error: "Unknown ticker" }); return; }

    // Get current price
    const prices = await convex.query(api.stocks.getPrices);
    const row = prices.find((p: any) => p.ticker === ticker);
    const price: number = row?.price ?? def.startPrice;
    const totalGain = Math.round(price * shares);

    // Sell (removes shares from holding)
    await convex.mutation(api.stocks.sellStock, {
      userId: req.userId as any,
      ticker,
      shares,
    });

    // Award XP
    await convex.mutation(api.users.addXP, {
      id: req.userId as any,
      amount: totalGain,
      reason: `Sold ${shares}x ${ticker} @ ${price} XP/share`,
    });

    // Log transaction for Receipts
    await convex.mutation(api.transactions.record, {
      userId: req.userId as any,
      type: "earn",
      amount: totalGain,
      description: `Sold ${shares}x ${ticker} @ ${price.toFixed(2)} XP/share`,
    });

    const updated = await convex.query(api.users.getById, { id: req.userId as any });
    res.json({ success: true, gained: totalGain, pricePerShare: price, newXP: updated?.xp });
  } catch (error: any) {
    console.error("Stocks sell error:", error);
    res.status(400).json({ error: error?.message || "Failed to sell" });
  }
});

// ============================================================
// Hunt / QR Code Routes
// ============================================================

// Short codes that are valid one-time-use "carry links" for participants
// who scan a QR code on a device that isn't logged in. Each code maps to
// a hunt ID so the secret page can redirect them to /hunt/<huntId> after
// they log in on their own device.
// Format: secretCode → huntId
const HUNT_SECRET_CODES: Record<string, string> = {
  "y0ufn": "alpha",
  "lmafoo": "beta",
  "n0lmao": "gamma",
};

// POST /api/hunt/:huntId — authenticated; attempts to redeem the hunt
app.post("/api/hunt/:huntId", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const huntId = req.params.huntId as string;
    if (!huntId || !/^[a-zA-Z0-9_-]+$/.test(huntId)) {
      res.status(400).json({ error: "Invalid hunt ID" });
      return;
    }

    const result = await convex.mutation(api.hunt.redeemHunt, {
      huntId,
      userId: req.userId as any,
    });

    res.json(result);
  } catch (error: any) {
    console.error("Hunt redeem error:", error);
    res.status(500).json({ error: error?.message || "Failed to redeem hunt" });
  }
});

// GET /api/hunt/secret/:code — public; resolves a short code to its hunt ID
// Used by /secret/[code] page so it can display the right hunt ID.
app.get("/api/hunt/secret/:code", (req, res) => {
  const { code } = req.params;
  const huntId = HUNT_SECRET_CODES[code];
  if (!huntId) {
    res.status(404).json({ error: "Invalid code" });
    return;
  }
  res.json({ huntId });
});

app.listen(PORT, () => {
  console.log(`[Campfire OS Server] Running on port ${PORT}`);
});

export default app;
