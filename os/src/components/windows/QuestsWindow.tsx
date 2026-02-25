"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/stores/authStore";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface Quest {
  _id: string;
  title: string;
  description: string;
  xpReward: number;
  maxCompletions: number | null;
  icon: string;
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

export default function QuestsWindow() {
  const { token } = useAuthStore();
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  const completed = quests.filter((q) => q.completedByMe);
  const pending = quests.filter((q) => !q.completedByMe);
  const totalXPEarned = completed.reduce((sum, q) => sum + q.xpReward, 0);
  const totalXPAvailable = pending.reduce((sum, q) => sum + q.xpReward, 0);

  if (selected) {
    return <QuestDetail quest={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="flex flex-col h-full bg-zinc-900 font-mono">
      {/* Header */}
      <div className="border-b border-zinc-700 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-zinc-500 tracking-widest">QUESTS</p>
          <p className="text-white text-sm font-bold">
            {completed.length}/{quests.length} completed
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-zinc-500 tracking-widest">EARNED</p>
          <p className="text-yellow-400 text-sm font-bold">{totalXPEarned} XP</p>
        </div>
      </div>

      {/* XP progress bar */}
      {quests.length > 0 && (
        <div className="px-4 py-2 border-b border-zinc-800">
          <div className="flex justify-between text-xs text-zinc-500 mb-1">
            <span>PROGRESS</span>
            <span>+{totalXPAvailable} XP available</span>
          </div>
          <div className="h-2 bg-zinc-800 border border-zinc-700">
            <div
              className="h-full bg-yellow-400"
              style={{
                width: quests.length
                  ? `${(completed.length / quests.length) * 100}%`
                  : "0%",
                transition: "width 0.4s ease",
              }}
            />
          </div>
        </div>
      )}

      {/* Content */}
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
        {!loading && !error && quests.length === 0 && (
          <div className="flex items-center justify-center h-32 text-zinc-500 text-xs tracking-widest">
            NO QUESTS YET
          </div>
        )}

        {/* Active quests */}
        {pending.length > 0 && (
          <div>
            <div className="px-4 py-2 bg-zinc-800 border-b border-zinc-700">
              <span className="text-xs text-zinc-400 tracking-widest">AVAILABLE — {pending.length}</span>
            </div>
            {pending.map((q) => (
              <QuestRow key={q._id} quest={q} onClick={() => setSelected(q)} />
            ))}
          </div>
        )}

        {/* Completed quests */}
        {completed.length > 0 && (
          <div>
            <div className="px-4 py-2 bg-zinc-800 border-b border-zinc-700">
              <span className="text-xs text-zinc-400 tracking-widest">COMPLETED — {completed.length}</span>
            </div>
            {completed.map((q) => (
              <QuestRow key={q._id} quest={q} onClick={() => setSelected(q)} />
            ))}
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="border-t border-zinc-800 px-4 py-2">
        <p className="text-xs text-zinc-600 text-center">
          Complete quests IRL · Visit the booth to verify
        </p>
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

  return (
    <button
      onClick={onClick}
      className="w-full text-left border-b border-zinc-800 px-4 py-3 flex items-center gap-3 hover:bg-zinc-800 transition-colors"
      style={{ cursor: "pointer" }}
    >
      {/* Icon */}
      <span className="text-2xl w-8 text-center flex-shrink-0">{quest.icon}</span>

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
        <p className="text-xs text-zinc-500 truncate mt-0.5">{quest.description}</p>
      </div>

      {/* XP badge */}
      <div className="flex-shrink-0 text-right">
        <span
          className="text-sm font-bold"
          style={{ color: quest.completedByMe ? "rgba(234,179,8,0.4)" : "rgb(234,179,8)" }}
        >
          +{quest.xpReward}
        </span>
        <span className="text-xs text-zinc-500 ml-1">XP</span>
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
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {/* Header card */}
        <div className="border border-zinc-700 p-4 bg-zinc-800">
          <div className="flex items-start gap-3">
            <span className="text-4xl">{quest.icon}</span>
            <div className="flex-1">
              <p className="text-white font-bold text-base leading-tight">{quest.title}</p>
              <p className="text-xs text-zinc-500 mt-1">{quest.description}</p>
            </div>
          </div>
        </div>

        {/* Reward */}
        <div className="border border-zinc-700 bg-zinc-800 px-4 py-3 flex items-center justify-between">
          <span className="text-xs text-zinc-500 tracking-widest">XP REWARD</span>
          <span className="text-2xl font-bold text-yellow-400">+{quest.xpReward} XP</span>
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
