"use client";

import { useState, useRef, useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";

// ============================================================
// Terminal Window - Interactive terminal emulator
// ============================================================

interface TerminalLine {
  type: "input" | "output" | "error" | "system";
  text: string;
}

const HELP_TEXT = `Available commands:
  help          - Show this help message
  whoami        - Display current user info
  xp            - Show XP
  clear         - Clear terminal
  date          - Show current date/time
  uptime        - Show session uptime
  echo <text>   - Echo text back
  campfire      - About Campfire HK
  neofetch      - System information`;

export default function TerminalWindow() {
  const { user } = useAuthStore();
  const [lines, setLines] = useState<TerminalLine[]>([
    { type: "system", text: "Campfire OS Terminal v1.0.0" },
    { type: "system", text: 'Type "help" for available commands.' },
    { type: "output", text: "" },
  ]);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const startTime = useRef(Date.now());

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  const addOutput = (text: string, type: TerminalLine["type"] = "output") => {
    setLines((prev) => [...prev, { type, text }]);
  };

  const processCommand = (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    addOutput(`$ ${trimmed}`, "input");
    setHistory((prev) => [...prev, trimmed]);
    setHistoryIndex(-1);

    const [command, ...args] = trimmed.split(" ");

    switch (command.toLowerCase()) {
      case "help":
        addOutput(HELP_TEXT);
        break;
      case "whoami":
        if (user) {
          addOutput(`${user.displayName} <${user.email}>`);
        } else {
          addOutput("Not logged in", "error");
        }
        break;
      case "xp":
        if (user) {
          addOutput(`XP: ${user.xp}`);
        } else {
          addOutput("Not logged in", "error");
        }
        break;
      case "clear":
        setLines([]);
        break;
      case "date":
        addOutput(new Date().toString());
        break;
      case "uptime":
        const elapsed = Math.floor((Date.now() - startTime.current) / 1000);
        const mins = Math.floor(elapsed / 60);
        const secs = elapsed % 60;
        addOutput(`Session uptime: ${mins}m ${secs}s`);
        break;
      case "echo":
        addOutput(args.join(" ") || "");
        break;
      case "campfire":
        addOutput("Campfire HK - Game Jam");
        addOutput("Build something awesome in 48 hours!");
        addOutput("https://campfire.hk");
        break;
      case "neofetch":
        addOutput("  ___ ___  ___   ");
        addOutput(" / __/ _ \\/ __|  Campfire OS v1.0.0");
        addOutput("| (_|  __/\\__ \\  Runtime: Next.js + Convex");
        addOutput(" \\___\\___||___/  Platform: Web");
        addOutput("                 Theme: Dark");
        if (user) {
          addOutput(`                 User: ${user.displayName}`);
        }
        break;
      default:
        addOutput(`command not found: ${command}`, "error");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processCommand(input);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length > 0) {
        const newIndex =
          historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setInput(history[newIndex]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex !== -1) {
        const newIndex = historyIndex + 1;
        if (newIndex >= history.length) {
          setHistoryIndex(-1);
          setInput("");
        } else {
          setHistoryIndex(newIndex);
          setInput(history[newIndex]);
        }
      }
    }
  };

  return (
    <div
      className="h-full bg-black p-3 font-mono text-sm overflow-auto cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      {/* Output */}
      {lines.map((line, i) => (
        <div
          key={i}
          className={`whitespace-pre-wrap leading-relaxed ${
            line.type === "input"
              ? "text-green-400"
              : line.type === "error"
                ? "text-red-400"
                : line.type === "system"
                  ? "text-zinc-500"
                  : "text-zinc-300"
          }`}
        >
          {line.text}
        </div>
      ))}

      {/* Input Line */}
      <form onSubmit={handleSubmit} className="flex items-center gap-1 mt-1">
        <span className="text-green-400 shrink-0">$</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent text-green-400 outline-none caret-green-400"
          autoFocus
          autoComplete="off"
          spellCheck={false}
        />
      </form>
      <div ref={bottomRef} />
    </div>
  );
}
