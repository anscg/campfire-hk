"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/stores/authStore";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

type QuestCategory = "main" | "side" | "hidden";

interface Quest {
  _id: string;
  title: string;
  description: string;
  xpReward: number | null; // null = obfuscated (hidden quest, not yet completed)
  maxCompletions: number | null;
  icon: string;
  category: QuestCategory;
  completedByMe: boolean;
  completedAt: number | null;
  totalCompletions: number;
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleString("en-HK", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Tab = "main" | "side" | "hidden";

const TAB_LABELS: Record<Tab, string> = {
  main: "MAIN",
  side: "SIDE",
  hidden: "???",
};

const TAB_DESCRIPTIONS: Record<Tab, string> = {
  main: "Complete IRL · Visit the booth to verify",
  side: "Competitive — not everyone can win the same prize",
  hidden: "Secret achievements · Objectives and rewards are hidden",
};

export default function QuestsWindow() {
  const { token } = useAuthStore();
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("main");
  const [selected, setSelected] = useState<Quest | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/quests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      const data: Quest[] = await res.json();
      setQuests(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const tabQuests = quests.filter((q) => q.category === tab);
  const completedInTab = tabQuests.filter((q) => q.completedByMe);
  const pendingInTab = tabQuests.filter((q) => !q.completedByMe);

  // Main tab stats
  const mainQuests = quests.filter((q) => q.category === "main");
  const mainCompleted = mainQuests.filter((q) => q.completedByMe);
  const mainXPEarned = mainCompleted.reduce((s, q) => s + (q.xpReward ?? 0), 0);
  const mainXPAvail = mainQuests.filter((q) => !q.completedByMe).reduce((s, q) => s + (q.xpReward ?? 0), 0);

  if (selected) {
    return <QuestDetail quest={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="flex flex-col h-full bg-zinc-900 font-mono">
      {/* Header — stats for main tab only */}
      <div className="border-b border-zinc-700 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-zinc-500 tracking-widest">QUESTS</p>
          <p className="text-white text-sm font-bold">
            {mainCompleted.length}/{mainQuests.length} main completed
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-zinc-500 tracking-widest">EARNED</p>
          <p className="text-yellow-400 text-sm font-bold">{mainXPEarned} XP</p>
        </div>
      </div>

      {/* Main quest progress bar */}
      {mainQuests.length > 0 && (
        <div className="px-4 py-2 border-b border-zinc-800">
          <div className="flex justify-between text-xs text-zinc-500 mb-1">
            <span>MAIN PROGRESS</span>
            <span>+{mainXPAvail} XP available</span>
          </div>
          <div className="h-2 bg-zinc-800 border border-zinc-700">
            <div
              className="h-full bg-yellow-400"
              style={{
                width: `${(mainCompleted.length / mainQuests.length) * 100}%`,
                transition: "width 0.4s ease",
              }}
            />
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex border-b border-zinc-700">
        {(["main", "side", "hidden"] as Tab[]).map((t) => {
          const count = quests.filter((q) => q.category === t).length;
          const done = quests.filter((q) => q.category === t && q.completedByMe).length;
          const isActive = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 py-2 flex flex-col items-center gap-0.5 transition-colors"
              style={{
                background: isActive ? "rgba(234,179,8,0.1)" : "transparent",
                borderBottom: isActive ? "2px solid rgb(234,179,8)" : "2px solid transparent",
              }}
            >
              <span
                className="text-xs tracking-widest font-bold"
                style={{ color: isActive ? "rgb(234,179,8)" : "rgba(255,255,255,0.4)" }}
              >
                {TAB_LABELS[t]}
              </span>
              <span className="text-xs" style={{ color: isActive ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.25)" }}>
                {done}/{count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab description */}
      <div className="px-4 py-1.5 border-b border-zinc-800">
        <p className="text-xs text-zinc-600">{TAB_DESCRIPTIONS[tab]}</p>
      </div>

      {/* Quest list */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center h-32 text-zinc-500 text-xs tracking-widest">
            LOADING...
          </div>
        )}
        {error && (
          <div className="m-4 p-3 border border-red-800 bg-red-950 text-red-400 text-xs">
            {error}
            <button onClick={load} className="ml-3 underline">retry</button>
          </div>
        )}
        {!loading && !error && tabQuests.length === 0 && (
          <div className="flex items-center justify-center h-32 text-zinc-500 text-xs tracking-widest">
            NO QUESTS
          </div>
        )}

        {/* Pending */}
        {pendingInTab.length > 0 && (
          <div>
            <div className="px-4 py-2 bg-zinc-800 border-b border-zinc-700">
              <span className="text-xs text-zinc-400 tracking-widest">AVAILABLE — {pendingInTab.length}</span>
            </div>
            {pendingInTab.map((q) => (
              <QuestRow key={q._id} quest={q} onClick={() => setSelected(q)} />
            ))}
          </div>
        )}

        {/* Completed */}
        {completedInTab.length > 0 && (
          <div>
            <div className="px-4 py-2 bg-zinc-800 border-b border-zinc-700">
              <span className="text-xs text-zinc-400 tracking-widest">COMPLETED — {completedInTab.length}</span>
            </div>
            {completedInTab.map((q) => (
              <QuestRow key={q._id} quest={q} onClick={() => setSelected(q)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Quest row ──────────────────────────────────────────────────────────────────

function QuestRow({ quest, onClick }: { quest: Quest; onClick: () => void }) {
  const isFull =
    quest.maxCompletions !== null &&
    quest.totalCompletions >= quest.maxCompletions &&
    !quest.completedByMe;
  const isHiddenObfuscated = quest.category === "hidden" && !quest.completedByMe;

  return (
    <button
      onClick={onClick}
      className="w-full text-left border-b border-zinc-800 px-4 py-3 flex items-center gap-3 hover:bg-zinc-800 transition-colors"
    >
      {/* Icon */}
      <span
        className="text-2xl w-8 text-center flex-shrink-0"
        style={{ filter: isHiddenObfuscated ? "grayscale(1) opacity(0.4)" : undefined }}
      >
        {quest.icon}
      </span>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="text-sm font-bold truncate"
            style={{ color: quest.completedByMe ? "rgba(255,255,255,0.4)" : "#fff" }}
          >
            {quest.title}
          </span>
          {quest.completedByMe && (
            <span className="text-xs text-green-500 tracking-widest flex-shrink-0">✓ DONE</span>
          )}
          {isFull && (
            <span className="text-xs text-red-500 tracking-widest flex-shrink-0">FULL</span>
          )}
        </div>
        <p className="text-xs truncate mt-0.5" style={{ color: isHiddenObfuscated ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.4)" }}>
          {quest.description}
        </p>
      </div>

      {/* XP badge */}
      <div className="flex-shrink-0 text-right">
        {isHiddenObfuscated ? (
          <span className="text-sm font-bold text-zinc-600">??? XP</span>
        ) : (
          <>
            <span
              className="text-sm font-bold"
              style={{ color: quest.completedByMe ? "rgba(234,179,8,0.4)" : "rgb(234,179,8)" }}
            >
              +{quest.xpReward}
            </span>
            <span className="text-xs text-zinc-500 ml-1">XP</span>
          </>
        )}
        {quest.maxCompletions !== null && (
          <p className="text-xs text-zinc-600 mt-0.5">
            {quest.totalCompletions}/{quest.maxCompletions}
          </p>
        )}
      </div>
    </button>
  );
}

// ── Quest detail view ──────────────────────────────────────────────────────────

function QuestDetail({ quest, onBack }: { quest: Quest; onBack: () => void }) {
  const isFull =
    quest.maxCompletions !== null &&
    quest.totalCompletions >= quest.maxCompletions &&
    !quest.completedByMe;
  const isHiddenObfuscated = quest.category === "hidden" && !quest.completedByMe;

  return (
    <div className="flex flex-col h-full bg-zinc-900 font-mono">
      {/* Nav */}
      <div className="border-b border-zinc-700 px-4 py-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-xs text-zinc-400 tracking-widest hover:text-white border border-zinc-700 px-2 py-1"
        >
          ← BACK
        </button>
        <span className="text-xs text-zinc-500 tracking-widest">QUEST DETAIL</span>
        {quest.category === "hidden" && (
          <span className="ml-auto text-xs tracking-widest px-1.5 py-0.5 border border-purple-800 text-purple-400">
            SECRET
          </span>
        )}
        {quest.category === "side" && (
          <span className="ml-auto text-xs tracking-widest px-1.5 py-0.5 border border-zinc-600 text-zinc-400">
            SIDE
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {/* Header card */}
        <div className="border border-zinc-700 p-4 bg-zinc-800">
          <div className="flex items-start gap-3">
            <span
              className="text-4xl flex-shrink-0"
              style={{ filter: isHiddenObfuscated ? "grayscale(1) opacity(0.35)" : undefined }}
            >
              {quest.icon}
            </span>
            <div className="flex-1">
              <p className="text-white font-bold text-base leading-tight">{quest.title}</p>
              <p className="text-xs mt-1" style={{ color: isHiddenObfuscated ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.5)" }}>
                {quest.description}
              </p>
            </div>
          </div>
        </div>

        {/* Reward */}
        <div className="border border-zinc-700 bg-zinc-800 px-4 py-3 flex items-center justify-between">
          <span className="text-xs text-zinc-500 tracking-widest">XP REWARD</span>
          {isHiddenObfuscated ? (
            <span className="text-2xl font-bold text-zinc-600">??? XP</span>
          ) : (
            <span className="text-2xl font-bold text-yellow-400">+{quest.xpReward} XP</span>
          )}
        </div>

        {/* Capacity */}
        {quest.maxCompletions !== null && (
          <div className="border border-zinc-700 bg-zinc-800 px-4 py-3 flex items-center justify-between">
            <span className="text-xs text-zinc-500 tracking-widest">SLOTS</span>
            <span className="text-sm font-bold text-white">
              {quest.totalCompletions} / {quest.maxCompletions}
            </span>
          </div>
        )}

        {/* Status */}
        {quest.completedByMe ? (
          <div className="border border-green-800 bg-green-950 px-4 py-3">
            <p className="text-xs text-green-400 tracking-widest">✓ COMPLETED</p>
            {quest.completedAt && (
              <p className="text-xs text-zinc-500 mt-1">{formatDate(quest.completedAt)}</p>
            )}
          </div>
        ) : isFull ? (
          <div className="border border-red-800 bg-red-950 px-4 py-3">
            <p className="text-xs text-red-400 tracking-widest">QUEST IS FULL</p>
            <p className="text-xs text-zinc-500 mt-1">All slots have been taken.</p>
          </div>
        ) : isHiddenObfuscated ? (
          <div className="border border-purple-900 bg-purple-950 px-4 py-3">
            <p className="text-xs text-purple-400 tracking-widest mb-1">SECRET ACHIEVEMENT</p>
            <p className="text-xs text-zinc-400 leading-relaxed">
              The objective and reward for this achievement are hidden. Figure it out — or stumble upon it naturally.
            </p>
          </div>
        ) : (
          <div className="border border-zinc-700 bg-zinc-800 px-4 py-3">
            <p className="text-xs text-zinc-400 tracking-widest mb-1">HOW TO COMPLETE</p>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Complete this quest IRL, then visit the <span className="text-yellow-400 font-bold">Campfire booth</span> and ask a staff member to verify your completion. They will award your XP on the spot.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
