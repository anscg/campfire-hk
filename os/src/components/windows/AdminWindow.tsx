"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuthStore } from "@/stores/authStore";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

// ── Types ──────────────────────────────────────────────────────────────────────

interface QuestCompletion {
  _id: string;
  userId: string;
  userName: string;
  verifiedByName: string;
  note: string | null;
  completedAt: number;
}

interface AdminQuest {
  _id: string;
  title: string;
  description: string;
  xpReward: number;
  maxCompletions: number | null;
  active: boolean;
  icon: string;
  category: "main" | "side" | "hidden";
  teaserDescription: string | null;
  createdAt: number;
  completions: QuestCompletion[];
  totalCompletions: number;
}

interface SearchUser {
  _id: string;
  displayName: string;
  xp: number;
}

type Tab = "quests" | "verify" | "create" | "xp" | "market";

function formatDate(ts: number) {
  return new Date(ts).toLocaleString("en-HK", {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function AdminWindow() {
  const { token, user } = useAuthStore();
  const [tab, setTab] = useState<Tab>("verify");
  const [authError, setAuthError] = useState(false);

  // Quick admin check using the user object (isAdmin comes from /api/user/me)
  const isAdmin = (user as any)?.isAdmin === true;

  useEffect(() => {
    if (user && !isAdmin) setAuthError(true);
  }, [user, isAdmin]);

  if (authError) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-zinc-900 font-mono gap-3">
        <p className="text-4xl">🚫</p>
        <p className="text-red-400 text-sm font-bold tracking-widest">ACCESS DENIED</p>
        <p className="text-xs text-zinc-500">Admin privileges required</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-zinc-900 font-mono">
      {/* Tab bar */}
      <div className="flex border-b border-zinc-700">
        {(["verify", "quests", "create", "xp", "market"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 py-2 text-xs tracking-widest transition-colors"
            style={{
              background: tab === t ? "rgb(234,179,8)" : "transparent",
              color: tab === t ? "#000" : "rgba(255,255,255,0.5)",
              fontWeight: tab === t ? "700" : "400",
              borderRight: "1px solid rgb(63,63,70)",
            }}
          >
            {t === "verify" ? "VERIFY" : t === "quests" ? "QUESTS" : t === "create" ? "CREATE" : t === "xp" ? "XP" : "MARKET"}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {tab === "verify" && <VerifyTab token={token} />}
        {tab === "quests" && <QuestsTab token={token} />}
        {tab === "create" && <CreateTab token={token} onCreated={() => setTab("quests")} />}
        {tab === "xp" && <XPTab token={token} />}
        {tab === "market" && <MarketTab token={token} />}
      </div>
    </div>
  );
}

// ── VERIFY TAB ─────────────────────────────────────────────────────────────────
// Booth flow: search participant → pick quest → confirm → award XP

function VerifyTab({ token }: { token: string | null }) {
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null);

  const [quests, setQuests] = useState<AdminQuest[]>([]);
  const [questsLoading, setQuestsLoading] = useState(false);
  const [selectedQuest, setSelectedQuest] = useState<AdminQuest | null>(null);

  const [note, setNote] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Search users
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!searchQ.trim()) { setSearchResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`${API_URL}/api/admin/users/search?q=${encodeURIComponent(searchQ)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) setSearchResults(await res.json());
      } finally { setSearching(false); }
    }, 300);
  }, [searchQ, token]);

  // Load quests when user is selected
  useEffect(() => {
    if (!selectedUser) return;
    setQuestsLoading(true);
    setSelectedQuest(null);
    fetch(`${API_URL}/api/admin/quests`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data: AdminQuest[]) => setQuests(data.filter((q) => q.active)))
      .finally(() => setQuestsLoading(false));
  }, [selectedUser, token]);

  const handleVerify = async () => {
    if (!selectedUser || !selectedQuest) return;
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await fetch(`${API_URL}/api/admin/quests/${selectedQuest._id}/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId: selectedUser._id, note: note || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setVerifyResult({ ok: true, msg: `+${selectedQuest.xpReward} XP awarded to ${selectedUser.displayName}` });
      setNote("");
      // Refresh quest list to update completion count
      const r2 = await fetch(`${API_URL}/api/admin/quests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r2.ok) setQuests((await r2.json() as AdminQuest[]).filter((q) => q.active));
    } catch (e: any) {
      setVerifyResult({ ok: false, msg: e.message });
    } finally {
      setVerifying(false);
    }
  };

  const reset = () => {
    setSelectedUser(null);
    setSelectedQuest(null);
    setSearchQ("");
    setSearchResults([]);
    setNote("");
    setVerifyResult(null);
  };

  // ── Step 3: confirm ──
  if (selectedUser && selectedQuest) {
    const alreadyDone = selectedQuest.completions.some((c) => c.userId === selectedUser._id);
    const isFull = selectedQuest.maxCompletions !== null &&
      selectedQuest.totalCompletions >= selectedQuest.maxCompletions && !alreadyDone;

    return (
      <div className="flex flex-col h-full overflow-y-auto p-4 gap-3">
        <button onClick={() => setSelectedQuest(null)}
          className="text-xs text-zinc-500 tracking-widest hover:text-white self-start border border-zinc-700 px-2 py-1">
          ← BACK
        </button>

        <div className="border border-zinc-700 bg-zinc-800 p-3">
          <p className="text-xs text-zinc-500 tracking-widest mb-1">PARTICIPANT</p>
          <p className="text-white font-bold">{selectedUser.displayName}</p>
          <p className="text-xs text-zinc-500">{selectedUser.xp} XP current</p>
        </div>

        <div className="border border-zinc-700 bg-zinc-800 p-3">
          <p className="text-xs text-zinc-500 tracking-widest mb-1">QUEST</p>
          <p className="text-white font-bold">{selectedQuest.icon} {selectedQuest.title}</p>
          <p className="text-xs text-zinc-500">{selectedQuest.description}</p>
        </div>

        <div className="border border-zinc-700 bg-zinc-800 px-3 py-2 flex items-center justify-between">
          <span className="text-xs text-zinc-500 tracking-widest">REWARD</span>
          <span className="text-yellow-400 font-bold">+{selectedQuest.xpReward} XP</span>
        </div>

        {alreadyDone && (
          <div className="border border-yellow-700 bg-yellow-950 px-3 py-2">
            <p className="text-xs text-yellow-400 tracking-widest">⚠ ALREADY COMPLETED</p>
            <p className="text-xs text-zinc-400 mt-1">This participant already completed this quest.</p>
          </div>
        )}
        {isFull && (
          <div className="border border-red-700 bg-red-950 px-3 py-2">
            <p className="text-xs text-red-400 tracking-widest">⚠ QUEST FULL</p>
          </div>
        )}

        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note (e.g. booth station #2)"
          className="bg-zinc-800 border border-zinc-700 px-3 py-2 text-xs text-white placeholder-zinc-600 outline-none"
        />

        {verifyResult && (
          <div className={`border px-3 py-2 text-xs ${verifyResult.ok ? "border-green-700 bg-green-950 text-green-400" : "border-red-700 bg-red-950 text-red-400"}`}>
            {verifyResult.ok ? "✓ " : "✗ "}{verifyResult.msg}
          </div>
        )}

        <button
          onClick={handleVerify}
          disabled={verifying || alreadyDone || isFull}
          className="mt-auto w-full py-3 text-xs font-bold tracking-widest border"
          style={{
            background: (alreadyDone || isFull) ? "transparent" : "rgb(234,179,8)",
            borderColor: (alreadyDone || isFull) ? "rgb(63,63,70)" : "rgb(234,179,8)",
            color: (alreadyDone || isFull) ? "rgba(255,255,255,0.3)" : "#000",
            cursor: (alreadyDone || isFull || verifying) ? "not-allowed" : "pointer",
            opacity: verifying ? 0.6 : 1,
          }}
        >
          {verifying ? "AWARDING..." : `AWARD +${selectedQuest.xpReward} XP`}
        </button>

        <button onClick={reset}
          className="w-full py-2 text-xs text-zinc-500 tracking-widest border border-zinc-800 hover:border-zinc-600">
          START OVER
        </button>
      </div>
    );
  }

  // ── Step 2: pick quest ──
  if (selectedUser) {
    return (
      <div className="flex flex-col h-full">
        <div className="border-b border-zinc-700 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setSelectedUser(null)}
            className="text-xs text-zinc-500 tracking-widest border border-zinc-700 px-2 py-1 hover:text-white">
            ← BACK
          </button>
          <div>
            <p className="text-xs text-zinc-500">PARTICIPANT</p>
            <p className="text-white text-sm font-bold">{selectedUser.displayName}</p>
          </div>
        </div>
        <p className="px-4 py-2 text-xs text-zinc-500 tracking-widest border-b border-zinc-800">SELECT QUEST TO VERIFY</p>
        <div className="flex-1 overflow-y-auto">
          {questsLoading && (
            <div className="flex items-center justify-center h-20 text-zinc-500 text-xs">LOADING...</div>
          )}
          {!questsLoading && quests.map((q) => {
            const done = q.completions.some((c) => c.userId === selectedUser._id);
            const full = q.maxCompletions !== null && q.totalCompletions >= q.maxCompletions && !done;
            return (
              <button
                key={q._id}
                onClick={() => setSelectedQuest(q)}
                className="w-full text-left border-b border-zinc-800 px-4 py-3 flex items-center gap-3 hover:bg-zinc-800"
              >
                <span className="text-xl w-7 text-center">{q.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{q.title}</p>
                  <p className="text-xs text-zinc-500 truncate">{q.description}</p>
                </div>
                <div className="flex-shrink-0 flex flex-col items-end gap-0.5">
                  <span className="text-xs font-bold text-yellow-400">+{q.xpReward} XP</span>
                  {done && <span className="text-xs text-green-500">✓ done</span>}
                  {full && <span className="text-xs text-red-500">full</span>}
                  {q.maxCompletions !== null && !done && !full && (
                    <span className="text-xs text-zinc-600">{q.totalCompletions}/{q.maxCompletions}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Step 1: search participant ──
  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-zinc-700 px-4 py-3">
        <p className="text-xs text-zinc-500 tracking-widest mb-2">SEARCH PARTICIPANT</p>
        <input
          autoFocus
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          placeholder="Type display name..."
          className="w-full bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none"
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {searching && (
          <div className="flex items-center justify-center h-20 text-zinc-500 text-xs">SEARCHING...</div>
        )}
        {!searching && searchQ.trim() && searchResults.length === 0 && (
          <div className="flex items-center justify-center h-20 text-zinc-500 text-xs">NO RESULTS</div>
        )}
        {searchResults.map((u) => (
          <button
            key={u._id}
            onClick={() => setSelectedUser(u)}
            className="w-full text-left border-b border-zinc-800 px-4 py-3 flex items-center justify-between hover:bg-zinc-800"
          >
            <div>
              <p className="text-sm font-bold text-white">{u.displayName}</p>
            </div>
            <span className="text-xs text-yellow-400 font-bold">{u.xp} XP</span>
          </button>
        ))}
        {!searchQ.trim() && (
          <div className="flex items-center justify-center h-32 text-zinc-600 text-xs tracking-widest text-center px-4">
            Search for a participant's name to begin verification
          </div>
        )}
      </div>
    </div>
  );
}

// ── QUESTS TAB ─────────────────────────────────────────────────────────────────

function QuestsTab({ token }: { token: string | null }) {
  const [quests, setQuests] = useState<AdminQuest[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [givingAll, setGivingAll] = useState<string | null>(null);
  const [giveAllResult, setGiveAllResult] = useState<{ questId: string; msg: string } | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/quests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setQuests(await res.json());
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async (q: AdminQuest) => {
    setToggling(q._id);
    try {
      await fetch(`${API_URL}/api/admin/quests/${q._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ active: !q.active }),
      });
      await load();
    } finally { setToggling(null); }
  };

  const revoke = async (questId: string, userId: string, userName: string) => {
    if (!confirm(`Revoke completion for ${userName}? This will deduct their XP.`)) return;
    setRevoking(`${questId}-${userId}`);
    try {
      await fetch(`${API_URL}/api/admin/quests/${questId}/completions/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      await load();
    } finally { setRevoking(null); }
  };

  const deleteQuest = async (q: AdminQuest) => {
    if (!confirm(`Delete "${q.title}"? This cannot be undone. Existing completions remain for audit.`)) return;
    setDeleting(q._id);
    try {
      await fetch(`${API_URL}/api/admin/quests/${q._id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      await load();
    } finally { setDeleting(null); }
  };

  const handleSeed = async () => {
    if (!confirm("Seed the real quest list? Quests with duplicate titles will be skipped.")) return;
    setSeeding(true);
    setSeedResult(null);
    try {
      const res = await fetch(`${API_URL}/api/admin/quests/seed`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setSeedResult(`✓ ${data.created} created, ${data.skipped} skipped`);
      await load();
    } catch (e: any) {
      setSeedResult(`✗ ${e.message}`);
    } finally {
      setSeeding(false);
    }
  };

  const giveAll = async (q: AdminQuest) => {
    if (!confirm(`Award "${q.title}" (+${q.xpReward} XP) to ALL participants who haven't completed it yet?`)) return;
    setGivingAll(q._id);
    setGiveAllResult(null);
    try {
      const res = await fetch(`${API_URL}/api/admin/quests/${q._id}/verify-all`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ note: "Mass award" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setGiveAllResult({ questId: q._id, msg: `✓ ${data.awarded} awarded, ${data.skipped} skipped` });
      await load();
    } catch (e: any) {
      setGiveAllResult({ questId: q._id, msg: `✗ ${e.message}` });
    } finally {
      setGivingAll(null);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-32 text-zinc-500 text-xs">LOADING...</div>;
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 gap-2">
        <span className="text-xs text-zinc-500 tracking-widest">{quests.length} QUESTS</span>
        <div className="flex gap-2 items-center">
          {seedResult && (
            <span
              className="text-xs tracking-widest"
              style={{ color: seedResult.startsWith("✓") ? "rgb(34,197,94)" : "rgb(239,68,68)" }}
            >
              {seedResult}
            </span>
          )}
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="text-xs tracking-widest px-2 py-1 border border-zinc-700 text-zinc-400 hover:text-white disabled:opacity-40"
          >
            {seeding ? "SEEDING..." : "SEED QUESTS"}
          </button>
          <button onClick={load} className="text-xs text-zinc-500 hover:text-white tracking-widest">↺ REFRESH</button>
        </div>
      </div>
      {quests.length === 0 && (
        <div className="flex items-center justify-center h-32 text-zinc-600 text-xs">NO QUESTS</div>
      )}
      {quests.map((q) => (
        <div key={q._id} className="border-b border-zinc-800">
          {/* Row */}
          <div className="flex items-center gap-2 px-4 py-3">
            <span className="text-lg w-6 text-center">{q.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-bold text-white truncate">{q.title}</p>
                <span
                  className="text-xs tracking-widest px-1"
                  style={{
                    border: `1px solid ${q.active ? "rgb(34,197,94)" : "rgb(63,63,70)"}`,
                    color: q.active ? "rgb(34,197,94)" : "rgb(113,113,122)",
                    background: "transparent",
                  }}
                >
                  {q.active ? "ON" : "OFF"}
                </span>
                <span
                  className="text-xs tracking-widest px-1"
                  style={{
                    border: `1px solid ${
                      q.category === "hidden" ? "rgb(147,51,234)"
                      : q.category === "side" ? "rgb(99,102,241)"
                      : "rgb(63,63,70)"
                    }`,
                    color: q.category === "hidden" ? "rgb(192,132,252)"
                      : q.category === "side" ? "rgb(165,180,252)"
                      : "rgb(113,113,122)",
                  }}
                >
                  {q.category.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-zinc-500">
                +{q.xpReward} XP · {q.totalCompletions}{q.maxCompletions !== null ? `/${q.maxCompletions}` : ""} completions
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => toggleActive(q)}
                disabled={toggling === q._id}
                className="text-xs tracking-widest px-2 py-1 border border-zinc-700 text-zinc-400 hover:text-white"
              >
                {q.active ? "DISABLE" : "ENABLE"}
              </button>
              <button
                onClick={() => deleteQuest(q)}
                disabled={deleting === q._id}
                className="text-xs tracking-widest px-2 py-1 border border-red-900 text-red-600 hover:text-red-400 disabled:opacity-40"
              >
                DEL
              </button>
              <button
                onClick={() => setExpanded(expanded === q._id ? null : q._id)}
                className="text-xs tracking-widest px-2 py-1 border border-zinc-700 text-zinc-400 hover:text-white"
              >
                {expanded === q._id ? "▲" : "▼"}
              </button>
            </div>
          </div>

          {/* Expanded completions */}
          {expanded === q._id && (
            <div className="bg-zinc-950 border-t border-zinc-800">
              <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
                <p className="text-xs text-zinc-500 tracking-widest">
                  COMPLETIONS ({q.completions.length})
                </p>
                <div className="flex items-center gap-2">
                  {giveAllResult?.questId === q._id && (
                    <span
                      className="text-xs tracking-widest"
                      style={{ color: giveAllResult.msg.startsWith("✓") ? "rgb(34,197,94)" : "rgb(239,68,68)" }}
                    >
                      {giveAllResult.msg}
                    </span>
                  )}
                  <button
                    onClick={() => giveAll(q)}
                    disabled={givingAll === q._id}
                    className="text-xs tracking-widest px-2 py-1 border border-yellow-700 text-yellow-500 hover:text-yellow-300 disabled:opacity-40"
                  >
                    {givingAll === q._id ? "AWARDING..." : "GIVE ALL"}
                  </button>
                </div>
              </div>
              {q.completions.length === 0 && (
                <p className="px-4 py-3 text-xs text-zinc-600">No completions yet</p>
              )}
              {q.completions.map((c) => (
                <div key={c._id} className="flex items-center gap-2 px-4 py-2 border-b border-zinc-900">
                  <div className="flex-1">
                    <p className="text-xs text-white font-bold">{c.userName}</p>
                    <p className="text-xs text-zinc-600">{formatDate(c.completedAt)} · by {c.verifiedByName}</p>
                    {c.note && <p className="text-xs text-zinc-500 italic">{c.note}</p>}
                  </div>
                  <button
                    onClick={() => revoke(q._id, c.userId, c.userName)}
                    disabled={revoking === `${q._id}-${c.userId}`}
                    className="text-xs text-red-600 hover:text-red-400 tracking-widest border border-red-900 px-2 py-1"
                  >
                    REVOKE
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── CREATE TAB ─────────────────────────────────────────────────────────────────

function CreateTab({ token, onCreated }: { token: string | null; onCreated: () => void }) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    xpReward: "50",
    maxCompletions: "",
    icon: "📋",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const ICON_PRESETS = ["📋", "🤝", "🎯", "🏃", "🧩", "💡", "🎨", "🔥", "⚡", "🌟", "🎤", "🤖"];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim() || !form.xpReward) {
      setError("Title, description and XP reward are required");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/admin/quests`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim(),
          xpReward: Number(form.xpReward),
          maxCompletions: form.maxCompletions ? Number(form.maxCompletions) : undefined,
          icon: form.icon,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setSuccess(true);
      setTimeout(() => { setSuccess(false); onCreated(); }, 1200);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-y-auto p-4 gap-3">
      {/* Icon picker */}
      <div>
        <p className="text-xs text-zinc-500 tracking-widest mb-2">ICON</p>
        <div className="flex flex-wrap gap-1">
          {ICON_PRESETS.map((ic) => (
            <button
              key={ic}
              type="button"
              onClick={() => setForm((p) => ({ ...p, icon: ic }))}
              className="w-9 h-9 text-lg flex items-center justify-center border"
              style={{
                borderColor: form.icon === ic ? "rgb(234,179,8)" : "rgb(63,63,70)",
                background: form.icon === ic ? "rgba(234,179,8,0.1)" : "transparent",
              }}
            >
              {ic}
            </button>
          ))}
          <input
            value={form.icon.length > 2 ? "" : form.icon}
            onChange={set("icon")}
            placeholder="✏️"
            className="w-9 h-9 text-center bg-zinc-800 border border-zinc-700 text-sm text-white outline-none"
          />
        </div>
      </div>

      <Field label="TITLE" required>
        <input
          value={form.title}
          onChange={set("title")}
          placeholder="e.g. Meet 3 new friends"
          className="w-full bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none"
          required
        />
      </Field>

      <Field label="DESCRIPTION">
        <textarea
          value={form.description}
          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          placeholder="What do participants need to do?"
          rows={3}
          className="w-full bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none resize-none"
        />
      </Field>

      <div className="flex gap-3">
        <Field label="XP REWARD" required className="flex-1">
          <input
            type="number"
            value={form.xpReward}
            onChange={set("xpReward")}
            min={1}
            className="w-full bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-white outline-none"
            required
          />
        </Field>
        <Field label="MAX COMPLETIONS" className="flex-1">
          <input
            type="number"
            value={form.maxCompletions}
            onChange={set("maxCompletions")}
            min={1}
            placeholder="∞ unlimited"
            className="w-full bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none"
          />
        </Field>
      </div>

      {error && (
        <div className="border border-red-700 bg-red-950 px-3 py-2 text-xs text-red-400">{error}</div>
      )}
      {success && (
        <div className="border border-green-700 bg-green-950 px-3 py-2 text-xs text-green-400">✓ Quest created!</div>
      )}

      <button
        type="submit"
        disabled={submitting || success}
        className="mt-auto w-full py-3 text-xs font-bold tracking-widest border"
        style={{
          background: "rgb(234,179,8)",
          borderColor: "rgb(234,179,8)",
          color: "#000",
          cursor: submitting ? "not-allowed" : "pointer",
          opacity: submitting ? 0.6 : 1,
        }}
      >
        {submitting ? "CREATING..." : "CREATE QUEST"}
      </button>
    </form>
  );
}

// ── XP TAB ─────────────────────────────────────────────────────────────────────
// Directly add/deduct XP for any participant with a reason note.

function XPTab({ token }: { token: string | null }) {
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null);

  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced user search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!searchQ.trim()) { setSearchResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `${API_URL}/api/admin/users/search?q=${encodeURIComponent(searchQ)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (res.ok) setSearchResults(await res.json());
      } finally { setSearching(false); }
    }, 300);
  }, [searchQ, token]);

  const handleSubmit = async () => {
    if (!selectedUser) return;
    const parsed = Number(amount);
    if (!amount.trim() || isNaN(parsed) || parsed === 0) {
      setResult({ ok: false, msg: "Enter a non-zero amount" });
      return;
    }
    if (!reason.trim()) {
      setResult({ ok: false, msg: "Reason is required" });
      return;
    }
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch(`${API_URL}/api/admin/xp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId: selectedUser._id, amount: parsed, reason: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      const sign = parsed > 0 ? "+" : "";
      setResult({ ok: true, msg: `${sign}${parsed} XP applied to ${selectedUser.displayName}` });
      setAmount("");
      setReason("");
      // Update local XP display
      setSelectedUser((u) => u ? { ...u, xp: Math.max(0, u.xp + parsed) } : u);
    } catch (e: any) {
      setResult({ ok: false, msg: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setSelectedUser(null);
    setSearchQ("");
    setSearchResults([]);
    setAmount("");
    setReason("");
    setResult(null);
  };

  // ── Step 2: XP form ──
  if (selectedUser) {
    const parsed = Number(amount);
    const isAdd = parsed > 0;
    const isSub = parsed < 0;

    return (
      <div className="flex flex-col h-full overflow-y-auto p-4 gap-3">
        <button
          onClick={reset}
          className="text-xs text-zinc-500 tracking-widest hover:text-white self-start border border-zinc-700 px-2 py-1"
        >
          ← BACK
        </button>

        <div className="border border-zinc-700 bg-zinc-800 p-3">
          <p className="text-xs text-zinc-500 tracking-widest mb-1">PARTICIPANT</p>
          <p className="text-white font-bold">{selectedUser.displayName}</p>
          <p className="text-xs text-zinc-500">{selectedUser.xp} XP current</p>
        </div>

        <div>
          <p className="text-xs text-zinc-500 tracking-widest mb-1">
            AMOUNT <span className="text-zinc-600">(positive to add, negative to deduct)</span>
          </p>
          <input
            type="number"
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setResult(null); }}
            placeholder="e.g. 100 or -50"
            className="w-full bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none"
            style={{
              borderColor: isAdd ? "rgb(34,197,94)" : isSub ? "rgb(239,68,68)" : "rgb(63,63,70)",
            }}
          />
          {(isAdd || isSub) && (
            <p className="text-xs mt-1" style={{ color: isAdd ? "rgb(34,197,94)" : "rgb(239,68,68)" }}>
              {isAdd ? `Add ${parsed} XP → ${selectedUser.xp + parsed} XP total` : `Deduct ${Math.abs(parsed)} XP → ${Math.max(0, selectedUser.xp + parsed)} XP total`}
            </p>
          )}
        </div>

        <div>
          <p className="text-xs text-zinc-500 tracking-widest mb-1">REASON <span className="text-yellow-500">*</span></p>
          <input
            value={reason}
            onChange={(e) => { setReason(e.target.value); setResult(null); }}
            placeholder="e.g. Bonus for helping setup"
            className="w-full bg-zinc-800 border border-zinc-700 px-3 py-2 text-xs text-white placeholder-zinc-600 outline-none"
          />
        </div>

        {result && (
          <div
            className={`border px-3 py-2 text-xs ${
              result.ok
                ? "border-green-700 bg-green-950 text-green-400"
                : "border-red-700 bg-red-950 text-red-400"
            }`}
          >
            {result.ok ? "✓ " : "✗ "}{result.msg}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting || !amount.trim() || parsed === 0 || !reason.trim()}
          className="mt-auto w-full py-3 text-xs font-bold tracking-widest border"
          style={{
            background:
              !amount.trim() || parsed === 0 || !reason.trim()
                ? "transparent"
                : isAdd
                ? "rgb(34,197,94)"
                : "rgb(239,68,68)",
            borderColor:
              !amount.trim() || parsed === 0 || !reason.trim()
                ? "rgb(63,63,70)"
                : isAdd
                ? "rgb(34,197,94)"
                : "rgb(239,68,68)",
            color: !amount.trim() || parsed === 0 || !reason.trim() ? "rgba(255,255,255,0.3)" : "#000",
            cursor: submitting || !amount.trim() || parsed === 0 || !reason.trim() ? "not-allowed" : "pointer",
            opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting
            ? "APPLYING..."
            : !amount.trim() || parsed === 0
            ? "ENTER AMOUNT"
            : isAdd
            ? `ADD +${parsed} XP`
            : `DEDUCT ${Math.abs(parsed)} XP`}
        </button>
      </div>
    );
  }

  // ── Step 1: search participant ──
  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-zinc-700 px-4 py-3">
        <p className="text-xs text-zinc-500 tracking-widest mb-2">SEARCH PARTICIPANT</p>
        <input
          autoFocus
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          placeholder="Type display name..."
          className="w-full bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none"
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {searching && (
          <div className="flex items-center justify-center h-20 text-zinc-500 text-xs">SEARCHING...</div>
        )}
        {!searching && searchQ.trim() && searchResults.length === 0 && (
          <div className="flex items-center justify-center h-20 text-zinc-500 text-xs">NO RESULTS</div>
        )}
        {searchResults.map((u) => (
          <button
            key={u._id}
            onClick={() => setSelectedUser(u)}
            className="w-full text-left border-b border-zinc-800 px-4 py-3 flex items-center justify-between hover:bg-zinc-800"
          >
            <p className="text-sm font-bold text-white">{u.displayName}</p>
            <span className="text-xs text-yellow-400 font-bold">{u.xp} XP</span>
          </button>
        ))}
        {!searchQ.trim() && (
          <div className="flex items-center justify-center h-32 text-zinc-600 text-xs tracking-widest text-center px-4">
            Search for a participant to adjust their XP
          </div>
        )}
      </div>
    </div>
  );
}

// ── MARKET TAB ─────────────────────────────────────────────────────────────────
// Admin controls for market events (e.g. Great Depression)

function MarketTab({ token }: { token: string | null }) {
  const [running, setRunning] = useState(false);
  const [checking, setChecking] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  // More Depression state
  const [moreRunning, setMoreRunning] = useState(false);
  const [sellBlocked, setSellBlocked] = useState(false);
  const [moreConfirmed, setMoreConfirmed] = useState(false);
  const [moreMessage, setMoreMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [unblocking, setUnblocking] = useState(false);

  // Market open/close state
  const [marketOpen, setMarketOpen] = useState(true);
  const [marketMessage, setMarketMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [marketToggling, setMarketToggling] = useState(false);

  // Poll both statuses every 3 s
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const [r1, r2, r3] = await Promise.all([
          fetch(`${API_URL}/api/admin/stocks/great-depression/status`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_URL}/api/admin/stocks/more-depression/status`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_URL}/api/admin/stocks/market/status`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        if (!cancelled) {
          if (r1.ok) {
            const d1 = await r1.json();
            setRunning(d1.running);
          }
          if (r2.ok) {
            const d2 = await r2.json();
            setMoreRunning(d2.running);
            setSellBlocked(d2.sellBlocked);
          }
          if (r3.ok) {
            const d3 = await r3.json();
            setMarketOpen(d3.open);
          }
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => { cancelled = true; clearInterval(id); };
  }, [token]);

  const trigger = async () => {
    setConfirmed(false);
    setMessage(null);
    try {
      const res = await fetch(`${API_URL}/api/admin/stocks/great-depression`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.started) {
        setRunning(true);
        setMessage({ ok: true, text: "Great Depression started. Prices inflating for ~60 s then crashing." });
      } else {
        setMessage({ ok: false, text: data.error ?? "Failed to start event" });
      }
    } catch {
      setMessage({ ok: false, text: "Network error" });
    }
  };

  const triggerMore = async () => {
    setMoreConfirmed(false);
    setMoreMessage(null);
    try {
      const res = await fetch(`${API_URL}/api/admin/stocks/more-depression`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.started) {
        setMoreRunning(true);
        setMoreMessage({ ok: true, text: "More Depression started. 5-phase sequence underway." });
      } else {
        setMoreMessage({ ok: false, text: data.error ?? "Failed to start event" });
      }
    } catch {
      setMoreMessage({ ok: false, text: "Network error" });
    }
  };

  const unblockSell = async () => {
    setUnblocking(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/stocks/unblock-sell`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setSellBlocked(false);
        setMoreMessage({ ok: true, text: "Sell orders unblocked." });
      }
    } catch {
      /* ignore */
    } finally {
      setUnblocking(false);
    }
  };

  const toggleMarket = async (open: boolean) => {
    setMarketToggling(true);
    setMarketMessage(null);
    try {
      const endpoint = open ? "open" : "close";
      const res = await fetch(`${API_URL}/api/admin/stocks/market/${endpoint}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setMarketOpen(open);
        setMarketMessage({ ok: true, text: open ? "Exchange is now OPEN." : "Exchange is now CLOSED." });
      } else {
        const data = await res.json();
        setMarketMessage({ ok: false, text: data.error ?? "Failed" });
      }
    } catch {
      setMarketMessage({ ok: false, text: "Network error" });
    } finally {
      setMarketToggling(false);
    }
  };

  if (checking) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500 text-xs tracking-widest">
        LOADING...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto">
      <p className="text-xs text-zinc-500 tracking-widest">MARKET EVENTS</p>

      {/* Market Hours card */}
      <div className="border border-zinc-700 p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{marketOpen ? "🟢" : "🔴"}</span>
          <div>
            <p className="text-sm font-bold text-white tracking-wide">MARKET HOURS</p>
            <p className="text-xs text-zinc-400">
              Open/close the exchange. When closed, buy/sell are blocked and prices freeze.
            </p>
          </div>
        </div>

        <div
          className={`px-3 py-2 text-xs tracking-widest border ${
            marketOpen
              ? "bg-green-900/30 border-green-600 text-green-400"
              : "bg-red-900/30 border-red-600 text-red-400"
          }`}
        >
          EXCHANGE IS {marketOpen ? "OPEN" : "CLOSED"}
        </div>

        {marketMessage && (
          <div
            className={`px-3 py-2 text-xs tracking-widest border ${
              marketMessage.ok
                ? "bg-green-900/30 border-green-600 text-green-400"
                : "bg-red-900/30 border-red-600 text-red-400"
            }`}
          >
            {marketMessage.text}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => toggleMarket(false)}
            disabled={marketToggling || !marketOpen}
            className="flex-1 py-2 text-xs font-bold tracking-widest bg-red-700 hover:bg-red-600 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {marketToggling && !marketOpen ? "CLOSING..." : "CLOSE EXCHANGE"}
          </button>
          <button
            onClick={() => toggleMarket(true)}
            disabled={marketToggling || marketOpen}
            className="flex-1 py-2 text-xs font-bold tracking-widest bg-green-700 hover:bg-green-600 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {marketToggling && marketOpen ? "OPENING..." : "OPEN EXCHANGE"}
          </button>
        </div>
      </div>

      {/* Great Depression card */}
      <div className="border border-zinc-700 p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">📉</span>
          <div>
            <p className="text-sm font-bold text-white tracking-wide">GREAT DEPRESSION</p>
            <p className="text-xs text-zinc-400">
              All stocks inflate over ~1 minute, then crash to 1–3 XP in 5 seconds.
            </p>
          </div>
        </div>

        {message && (
          <div
            className={`px-3 py-2 text-xs tracking-widest border ${
              message.ok
                ? "bg-green-900/30 border-green-600 text-green-400"
                : "bg-red-900/30 border-red-600 text-red-400"
            }`}
          >
            {message.text}
          </div>
        )}

        {!confirmed && (
          <button
            onClick={() => setConfirmed(true)}
            disabled={running}
            className="w-full py-2 text-xs font-bold tracking-widest bg-red-700 hover:bg-red-600 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {running ? "RUNNING..." : "TRIGGER EVENT"}
          </button>
        )}

        {!running && confirmed && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-red-400 tracking-widest">
              ARE YOU SURE? This will affect all participants' stock values.
            </p>
            <div className="flex gap-2">
              <button
                onClick={trigger}
                className="flex-1 py-2 text-xs font-bold tracking-widest bg-red-700 hover:bg-red-600 text-white transition-colors"
              >
                CONFIRM
              </button>
              <button
                onClick={() => setConfirmed(false)}
                className="flex-1 py-2 text-xs font-bold tracking-widest bg-zinc-700 hover:bg-zinc-600 text-white transition-colors"
              >
                CANCEL
              </button>
            </div>
          </div>
        )}
      </div>

      {/* More Depression card */}
      <div className="border border-zinc-700 p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">📉📉</span>
          <div>
            <p className="text-sm font-bold text-white tracking-wide">MORE DEPRESSION</p>
            <p className="text-xs text-zinc-400">
              Phase 1: inflate 10 min · Phase 2: crash 2 min · Phase 3: rise 50% ~1 min · Phase 4: drop 30% ~30 s · Phase 5: sell orders blocked.
            </p>
          </div>
        </div>

        {sellBlocked && (
          <div className="px-3 py-2 text-xs tracking-widest border bg-yellow-900/30 border-yellow-600 text-yellow-400">
            SELL ORDERS ARE BLOCKED
          </div>
        )}

        {moreMessage && (
          <div
            className={`px-3 py-2 text-xs tracking-widest border ${
              moreMessage.ok
                ? "bg-green-900/30 border-green-600 text-green-400"
                : "bg-red-900/30 border-red-600 text-red-400"
            }`}
          >
            {moreMessage.text}
          </div>
        )}

        {!moreConfirmed && (
          <button
            onClick={() => setMoreConfirmed(true)}
            disabled={moreRunning}
            className="w-full py-2 text-xs font-bold tracking-widest bg-red-700 hover:bg-red-600 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {moreRunning ? "RUNNING..." : "TRIGGER EVENT"}
          </button>
        )}

        {!moreRunning && moreConfirmed && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-red-400 tracking-widest">
              ARE YOU SURE? This is a 5-phase sequence with sell blocking.
            </p>
            <div className="flex gap-2">
              <button
                onClick={triggerMore}
                className="flex-1 py-2 text-xs font-bold tracking-widest bg-red-700 hover:bg-red-600 text-white transition-colors"
              >
                CONFIRM
              </button>
              <button
                onClick={() => setMoreConfirmed(false)}
                className="flex-1 py-2 text-xs font-bold tracking-widest bg-zinc-700 hover:bg-zinc-600 text-white transition-colors"
              >
                CANCEL
              </button>
            </div>
          </div>
        )}

        {sellBlocked && (
          <button
            onClick={unblockSell}
            disabled={unblocking}
            className="w-full py-2 text-xs font-bold tracking-widest border border-yellow-600 text-yellow-400 hover:text-yellow-200 hover:border-yellow-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "transparent" }}
          >
            {unblocking ? "UNBLOCKING..." : "UNBLOCK SELLS"}
          </button>
        )}
      </div>
    </div>
  );
}

function Field({ label, children, required, className }: {
  label: string; children: React.ReactNode; required?: boolean; className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-xs text-zinc-500 tracking-widest mb-1">
        {label}{required && <span className="text-yellow-500 ml-1">*</span>}
      </p>
      {children}
    </div>
  );
}
