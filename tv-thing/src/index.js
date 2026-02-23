import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { AllProfanity } from "allprofanity";

const app = express();
const server = createServer(app);
const io = new Server(server);

let color = "black";

const bannedEmojis = new Set(["💩", "🖕", "👎", "🔞", "🚫"]);

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
    if (bannedEmojis.has(emoji)) {
      socket.emit("emojiBlocked", { emoji, reason: "banned" });
      return;
    }
    socket.broadcast.emit("emoji", emoji);
  });

  socket.on("color", (selectedColor) => {
    color = selectedColor;
    socket.broadcast.emit("color", selectedColor);
  });

  socket.on("message", (message) => {
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
