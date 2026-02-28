import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { AllProfanity } from "allprofanity";

const app = express();
const server = createServer(app);
const io = new Server(server);

// ---------------------------------------------------------------------------
// Rate limiter — 50 socket events per IP per minute (in-memory, no extra deps)
// Cloudflare sets CF-Connecting-IP; fall back to socket remote address.
// ---------------------------------------------------------------------------
const RATE_LIMIT = 50;
const RATE_WINDOW_MS = 60_000;
const ipCounters = new Map(); // ip → { count, resetAt }

function getIp(socket) {
  // handshake.headers is populated during the Socket.IO upgrade request
  return (
    socket.handshake.headers["cf-connecting-ip"] ||
    socket.handshake.address
  );
}

function isRateLimited(socket) {
  const ip = getIp(socket);
  const now = Date.now();
  let entry = ipCounters.get(ip);

  if (!entry || now >= entry.resetAt) {
    entry = { count: 1, resetAt: now + RATE_WINDOW_MS };
    ipCounters.set(ip, entry);
    return false;
  }

  entry.count += 1;
  if (entry.count > RATE_LIMIT) {
    return true;
  }
  return false;
}

// Sweep stale entries every minute so the map doesn't grow forever
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of ipCounters) {
    if (now >= entry.resetAt) ipCounters.delete(ip);
  }
}, RATE_WINDOW_MS);

let color = "black";

const bannedEmojis = new Set(["💩", "🖕", "👎", "🔞", "🚫"]);

/**
 * Returns true if the emoji is a flag that should be blocked:
 *   - Country/region flags: pairs of Regional Indicator letters (U+1F1E6–U+1F1FF)
 *   - Special flags via ZWJ: 🏳️‍🌈 (rainbow), 🏳️‍⚧️ (trans), 🏴‍☠️ (pirate), etc.
 *   - Subdivisions flags: 🏴 + tag sequence (England, Scotland, Wales)
 */
function isFlagEmoji(emoji) {
  // Regional Indicator pairs → country flags (🇦🇧 … 🇿🇿)
  const regionalIndicator = /^\p{RI}\p{RI}$/u;
  if (regionalIndicator.test(emoji)) return true;

  // ZWJ-based special flags (rainbow 🏳️‍🌈, trans 🏳️‍⚧️, pirate 🏴‍☠️, etc.)
  // These all start with either 🏳 (U+1F3F3) or 🏴 (U+1F3F4) and contain a ZWJ (U+200D)
  const flagBase = /^[\u{1F3F3}\u{1F3F4}]/u;
  const zwj = "\u200D";
  if (flagBase.test(emoji) && emoji.includes(zwj)) return true;

  // Subdivision flags: 🏴 followed by tag characters (U+E0000 block)
  const subdivisionFlag = /^\u{1F3F4}[\u{E0000}-\u{E007F}]+\u{E007F}$/u;
  if (subdivisionFlag.test(emoji)) return true;

  return false;
}

// Cantonese / Honglish slang that allprofanity won't catch
const extraBlocklist = [
  // diu variants (屌)
  "diu",
  "diiu",
  "d1u",
  "d!u",
  "dIu",
  "DIU",

  // dllm variants (屌你老母)
  "dllm",
  "DLLM",
  "d11m",
  "dl1m",
  "d1lm",
  "dllM",
  "DLlm",
  "dIIm",
  "diim",
  "DIIM",
  "d11m",

  // dlm (屌你老母 short)
  "dlm",
  "DLM",

  // gau (㞗 - penis in Cantonese)
  "gau",
  "GAU",
  "g4u",

  // puk gaai (仆街)
  "pukgaai",
  "puk gaai",
  "puk-gaai",
  "pukg",

  // ham ga chan (冚家鏟)
  "hamgachan",
  "ham ga chan",

  // lan (㞗 shaft)
  "lan jiao",
  "lanjiao",
];

const filter = new AllProfanity({
  algorithm: { matching: "hybrid", useContextAnalysis: false },
  profanityDetection: { enableLeetSpeak: true, caseSensitive: false },
  performance: { enableCaching: true, cacheSize: 2000 },
});

filter.add(extraBlocklist);

/**
 * Returns true if the text contains only printable ASCII characters
 * (i.e., no CJK, Arabic, emoji in the text body, etc.)
 */
function isAllAscii(text) {
  // Allow printable ASCII: 0x20–0x7E, plus common whitespace
  return /^[\x20-\x7E\t\r\n]*$/.test(text);
}

/**
 * Returns true if the message should be auto-approved:
 *   - All ASCII (English / Latin) characters
 *   - No profanity detected by allprofanity (including our extras)
 */
function shouldAutoApprove(message) {
  if (!isAllAscii(message)) return false;
  return !filter.check(message);
}

io.on("connection", (socket) => {
  socket.emit("color", color);

  socket.on("emoji", (emoji) => {
    if (isRateLimited(socket)) return;
    if (bannedEmojis.has(emoji) || isFlagEmoji(emoji)) {
      socket.emit("emojiBlocked", { emoji, reason: "banned" });
      return;
    }
    socket.broadcast.emit("emoji", emoji);
  });

  socket.on("color", (selectedColor) => {
    if (isRateLimited(socket)) return;
    color = selectedColor;
    socket.broadcast.emit("color", selectedColor);
  });

  socket.on("message", (message) => {
    if (isRateLimited(socket)) return;
    if (typeof message !== "string") return;
    const trimmed = message.trim();
    if (!trimmed) return;

    if (shouldAutoApprove(trimmed)) {
      // Clean English, no profanity → broadcast immediately
      io.emit("message", trimmed);
    } else {
      // Non-English or contains profanity → send to admin for review
      io.emit("messageForReview", trimmed);
    }
  });

  socket.on("acceptMessage", (message) => {
    io.emit("message", message);
  });

  socket.on("refresh", () => {
    io.emit("refresh");
  });
});

app.get("/", (req, res) => {
  res.sendFile("index.html", { root: "./views" });
});

app.get("/display", (req, res) => {
  res.sendFile("display.html", { root: "./views" });
});

app.get("/admin", (req, res) => {
  res.sendFile("admin.html", { root: "./views" });
});

server.listen(process.env.PORT || 3000, () => {
  console.log("listening on *:3000");
});
