"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuthStore } from "@/stores/authStore";

// ============================================================
// Types
// ============================================================

interface GroupMember {
  _id: string;
  displayName: string;
  xp: number;
}

interface Group {
  _id: string;
  name: string;
  inviteCode: string;
  createdBy: string;
  createdAt: number;
  members: GroupMember[];
}

// ============================================================
// Groups Window - Create / join / manage your group
// ============================================================

export default function GroupsWindow() {
  const { user, token } = useAuthStore();
  const [myGroup, setMyGroup] = useState<Group | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [view, setView] = useState<"home" | "create" | "join">("home");
  const [groupName, setGroupName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3001";

  const fetchMyGroup = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      const res = await fetch(`${serverUrl}/api/groups/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load group");
      setMyGroup(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [token, serverUrl]);

  useEffect(() => {
    fetchMyGroup();
    const interval = setInterval(fetchMyGroup, 10000);
    return () => clearInterval(interval);
  }, [fetchMyGroup]);

  const handleCreate = async () => {
    if (!groupName.trim()) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`${serverUrl}/api/groups/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: groupName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create group");
      setGroupName("");
      setView("home");
      await fetchMyGroup();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleJoin = async () => {
    if (inviteCode.trim().length !== 6) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`${serverUrl}/api/groups/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ inviteCode: inviteCode.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to join group");
      setInviteCode("");
      setView("home");
      await fetchMyGroup();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeave = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`${serverUrl}/api/groups/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to leave group");
      await fetchMyGroup();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setActionLoading(false);
    }
  };

  const copyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-zinc-900 text-zinc-500 font-mono text-sm">
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-zinc-900 text-red-400 font-mono text-sm">
        {error}
      </div>
    );
  }

  // ─── In a group ─────────────────────────────────────────────

  if (myGroup) {
    const totalXP = myGroup.members.reduce((sum, m) => sum + m.xp, 0);

    return (
      <div className="h-full bg-zinc-900 font-mono flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-zinc-800 border-b border-zinc-700 p-4 flex-shrink-0">
          <p className="text-xs text-zinc-500 tracking-widest mb-1">YOUR GROUP</p>
          <p className="text-lg font-bold text-white">{myGroup.name}</p>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-zinc-500">Invite code:</span>
            <span className="text-sm font-bold text-yellow-400 tracking-[0.2em]">
              {myGroup.inviteCode}
            </span>
            <button
              onClick={() => copyInviteCode(myGroup.inviteCode)}
              className="text-xs text-zinc-400 border border-zinc-600 px-2 py-0.5"
              style={{ cursor: "pointer" }}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        {/* Members */}
        <div className="flex-1 overflow-auto p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-zinc-500 tracking-widest">
              MEMBERS ({myGroup.members.length}/3)
            </p>
            <p className="text-xs text-zinc-500">
              Total: <span className="text-yellow-400 font-bold">{totalXP} XP</span>
            </p>
          </div>

          <div className="space-y-2">
            {myGroup.members.map((member) => {
              const isMe = member._id === user?._id;
              const isLeader = member._id === myGroup.createdBy;
              return (
                <div
                  key={member._id}
                  className="flex items-center gap-3 p-3 border"
                  style={{
                    background: isMe ? "rgba(234, 179, 8, 0.1)" : "rgb(39, 39, 42)",
                    borderColor: isMe ? "rgba(234, 179, 8, 0.3)" : "rgb(63, 63, 70)",
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-bold truncate"
                      style={{ color: isMe ? "rgb(250, 204, 21)" : "rgb(255,255,255)" }}
                    >
                      {member.displayName}
                      {isMe && <span className="font-normal text-zinc-500"> (you)</span>}
                      {isLeader && !isMe && (
                        <span className="font-normal text-zinc-500"> (leader)</span>
                      )}
                      {isLeader && isMe && (
                        <span className="font-normal text-zinc-500"> · leader</span>
                      )}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0 w-20">
                    <p className="text-xs text-zinc-500 mb-1">XP</p>
                    <p className="text-sm font-bold text-yellow-400">{member.xp}</p>
                  </div>
                </div>
              );
            })}

            {/* Empty slots */}
            {Array.from({ length: 3 - myGroup.members.length }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="flex items-center gap-3 p-3 border border-dashed border-zinc-800"
              >
                <div className="flex-1">
                  <p className="text-sm text-zinc-700">Empty slot</p>
                </div>
              </div>
            ))}
          </div>

          {actionError && <p className="text-red-400 text-xs mt-3">{actionError}</p>}
        </div>

        {/* Leave */}
        <div className="p-3 border-t border-zinc-700 flex-shrink-0">
          <button
            onClick={handleLeave}
            disabled={actionLoading}
            className="w-full py-2 text-xs font-bold tracking-widest border border-zinc-600 text-zinc-400"
            style={{
              cursor: actionLoading ? "not-allowed" : "pointer",
              opacity: actionLoading ? 0.5 : 1,
            }}
          >
            {actionLoading ? "LEAVING..." : "LEAVE GROUP"}
          </button>
        </div>
      </div>
    );
  }

  // ─── Create form ─────────────────────────────────────────────

  if (view === "create") {
    return (
      <div className="h-full bg-zinc-900 font-mono flex flex-col overflow-hidden">
        <div className="p-4 border-b border-zinc-700 flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => { setView("home"); setActionError(null); }}
            className="text-xs text-zinc-400 border border-zinc-600 px-2 py-1"
            style={{ cursor: "pointer" }}
          >
            ← Back
          </button>
          <span className="text-xs font-bold tracking-widest text-zinc-300">CREATE GROUP</span>
        </div>
        <div className="flex-1 p-4">
          <label className="block text-xs text-zinc-500 mb-2 tracking-widest">GROUP NAME</label>
          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="Team Campfire"
            maxLength={32}
            className="w-full bg-zinc-800 border border-zinc-600 text-white text-sm px-3 py-2 outline-none"
            style={{ fontFamily: "inherit" }}
            autoFocus
          />
          {actionError && <p className="text-red-400 text-xs mt-2">{actionError}</p>}
          <button
            onClick={handleCreate}
            disabled={actionLoading || !groupName.trim()}
            className="mt-4 w-full py-2 text-xs font-bold tracking-widest border"
            style={{
              cursor: actionLoading || !groupName.trim() ? "not-allowed" : "pointer",
              opacity: !groupName.trim() ? 0.4 : 1,
              background: "rgb(234, 179, 8)",
              borderColor: "rgb(234, 179, 8)",
              color: "rgb(0,0,0)",
            }}
          >
            {actionLoading ? "CREATING..." : "CREATE"}
          </button>
        </div>
      </div>
    );
  }

  // ─── Join form ───────────────────────────────────────────────

  if (view === "join") {
    return (
      <div className="h-full bg-zinc-900 font-mono flex flex-col overflow-hidden">
        <div className="p-4 border-b border-zinc-700 flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => { setView("home"); setActionError(null); }}
            className="text-xs text-zinc-400 border border-zinc-600 px-2 py-1"
            style={{ cursor: "pointer" }}
          >
            ← Back
          </button>
          <span className="text-xs font-bold tracking-widest text-zinc-300">JOIN GROUP</span>
        </div>
        <div className="flex-1 p-4">
          <label className="block text-xs text-zinc-500 mb-2 tracking-widest">INVITE CODE</label>
          <input
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            placeholder="ABC123"
            maxLength={6}
            className="w-full bg-zinc-800 border border-zinc-600 text-white text-sm px-3 py-2 outline-none tracking-[0.3em] font-bold"
            style={{ fontFamily: "inherit" }}
            autoFocus
          />
          {actionError && <p className="text-red-400 text-xs mt-2">{actionError}</p>}
          <button
            onClick={handleJoin}
            disabled={actionLoading || inviteCode.trim().length !== 6}
            className="mt-4 w-full py-2 text-xs font-bold tracking-widest border"
            style={{
              cursor: actionLoading || inviteCode.trim().length !== 6 ? "not-allowed" : "pointer",
              opacity: inviteCode.trim().length !== 6 ? 0.4 : 1,
              background: "rgb(234, 179, 8)",
              borderColor: "rgb(234, 179, 8)",
              color: "rgb(0,0,0)",
            }}
          >
            {actionLoading ? "JOINING..." : "JOIN"}
          </button>
        </div>
      </div>
    );
  }

  // ─── Home (not in a group) ───────────────────────────────────

  return (
    <div className="h-full bg-zinc-900 font-mono flex flex-col overflow-hidden">
      <div className="bg-zinc-800 border-b border-zinc-700 p-4 flex-shrink-0">
        <h2 className="text-sm font-bold tracking-widest text-zinc-200">GROUPS</h2>
        <p className="text-xs text-zinc-500 mt-1">
          Teams of up to 3 — join with an invite code
        </p>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6">
        <p className="text-zinc-500 text-sm mb-2">You are not in a group yet.</p>
        <button
          onClick={() => { setView("create"); setActionError(null); }}
          className="w-full max-w-xs py-3 text-xs font-bold tracking-widest border"
          style={{
            background: "rgb(234, 179, 8)",
            borderColor: "rgb(234, 179, 8)",
            color: "rgb(0,0,0)",
            cursor: "pointer",
          }}
        >
          + CREATE GROUP
        </button>
        <button
          onClick={() => { setView("join"); setActionError(null); }}
          className="w-full max-w-xs py-3 text-xs font-bold tracking-widest border border-zinc-600 text-zinc-300"
          style={{ cursor: "pointer" }}
        >
          JOIN WITH CODE
        </button>
      </div>
    </div>
  );
}
