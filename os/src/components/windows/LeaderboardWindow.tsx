"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/authStore";

// ============================================================
// Types
// ============================================================

interface LeaderboardEntry {
  _id: string;
  displayName: string;
  xp: number;
}

interface GroupMember {
  _id: string;
  displayName: string;
  xp: number;
}

interface Group {
  _id: string;
  name: string;
  members: GroupMember[];
}

// ============================================================
// Tab switcher — iOS segmented control style, no rounded corners
// ============================================================

function TabSwitcher({
  active,
  onChange,
}: {
  active: "participants" | "groups";
  onChange: (tab: "participants" | "groups") => void;
}) {
  return (
    <div
      className="flex mx-4 mb-3"
      style={{ background: "rgb(30, 30, 32)", border: "1px solid rgb(55, 55, 58)" }}
    >
      {(["participants", "groups"] as const).map((tab) => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className="flex-1 py-1.5 text-xs font-bold tracking-wider transition-colors"
          style={{
            background: active === tab ? "rgb(80, 80, 85)" : "transparent",
            color: active === tab ? "rgb(255, 255, 255)" : "rgb(113, 113, 122)",
            borderRight: tab === "participants" ? "1px solid rgb(55, 55, 58)" : "none",
            cursor: "pointer",
          }}
        >
          {tab === "participants" ? "Participants" : "Groups"}
        </button>
      ))}
    </div>
  );
}

// ============================================================
// Participants Tab
// ============================================================

function ParticipantsTab() {
  const { user, token } = useAuthStore();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        setLoading(true);
        setError(null);
        const serverUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
        const res = await fetch(`${serverUrl}/api/leaderboard`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error("Failed to fetch leaderboard");
        setLeaderboard(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 10000);
    return () => clearInterval(interval);
  }, [token]);

  const currentUserRank = leaderboard.findIndex((e) => e._id === user?._id);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="text-zinc-500 text-center py-8 text-sm">Loading...</div>
        ) : error ? (
          <div className="text-red-400 text-sm text-center py-8">{error}</div>
        ) : leaderboard.length === 0 ? (
          <div className="text-zinc-500 text-center py-8 text-sm">No participants yet</div>
        ) : (
          <div>
            {leaderboard.map((entry, idx) => {
              const isCurrentUser = entry._id === user?._id;
              return (
                <div
                  key={entry._id}
                  className="flex items-center gap-3 px-4 border-b"
                  style={{
                    height: "36px",
                    background: isCurrentUser ? "rgba(234, 179, 8, 0.08)" : "transparent",
                    borderColor: "rgb(39, 39, 42)",
                  }}
                >
                  <span className="text-xs font-bold text-zinc-600 w-7 flex-shrink-0 text-right">
                    {idx + 1}
                  </span>
                  <p
                    className="flex-1 text-xs font-bold truncate min-w-0"
                    style={{ color: isCurrentUser ? "rgb(250, 204, 21)" : "rgb(228, 228, 231)" }}
                  >
                    {entry.displayName}
                    {isCurrentUser && <span className="font-normal text-zinc-500"> (you)</span>}
                  </p>
                  <span
                    className="text-xs font-bold flex-shrink-0"
                    style={{ color: isCurrentUser ? "rgb(250, 204, 21)" : "rgb(161, 161, 170)" }}
                  >
                    {entry.xp} XP
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {!loading && currentUserRank >= 0 && (
        <div className="border-t border-zinc-800 px-4 py-2 flex-shrink-0">
          <p className="text-xs text-zinc-600">
            Ranked <span className="text-yellow-400 font-bold">#{currentUserRank + 1}</span>
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Groups Tab — read-only leaderboard, sorted by total XP
// ============================================================

function GroupsTab() {
  const { user, token } = useAuthStore();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        setLoading(true);
        setError(null);
        const serverUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
        const res = await fetch(`${serverUrl}/api/groups`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error("Failed to fetch groups");
        const data: Group[] = await res.json();
        data.sort(
          (a, b) =>
            b.members.reduce((sum, m) => sum + m.xp, 0) -
            a.members.reduce((sum, m) => sum + m.xp, 0)
        );
        setGroups(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchGroups();
    const interval = setInterval(fetchGroups, 10000);
    return () => clearInterval(interval);
  }, [token]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="text-zinc-500 text-center py-8 text-sm">Loading...</div>
        ) : error ? (
          <div className="text-red-400 text-sm text-center py-8">{error}</div>
        ) : groups.length === 0 ? (
          <div className="text-zinc-500 text-center py-8 text-sm">No groups yet</div>
        ) : (
          <div>
            {groups.map((group, idx) => {
              const totalXP = group.members.reduce((sum, m) => sum + m.xp, 0);
              const isMyGroup = group.members.some((m) => m._id === user?._id);
              return (
                <div
                  key={group._id}
                  className="border-b"
                  style={{
                    borderColor: "rgb(39, 39, 42)",
                    background: isMyGroup ? "rgba(234, 179, 8, 0.06)" : "transparent",
                  }}
                >
                  {/* Group row */}
                  <div
                    className="flex items-center gap-3 px-4"
                    style={{ height: "36px" }}
                  >
                    <span className="text-xs font-bold text-zinc-600 w-7 flex-shrink-0 text-right">
                      {idx + 1}
                    </span>
                    <p
                      className="flex-1 text-xs font-bold truncate min-w-0"
                      style={{ color: isMyGroup ? "rgb(250, 204, 21)" : "rgb(228, 228, 231)" }}
                    >
                      {group.name}
                      {isMyGroup && <span className="font-normal text-zinc-500"> (yours)</span>}
                    </p>
                    <span
                      className="text-xs font-bold flex-shrink-0"
                      style={{ color: isMyGroup ? "rgb(250, 204, 21)" : "rgb(161, 161, 170)" }}
                    >
                      {totalXP} XP
                    </span>
                  </div>
                  {/* Members row */}
                  <div className="flex gap-2 px-4 pb-2 pl-14 flex-wrap">
                    {group.members.map((m) => (
                      <span key={m._id} className="text-[10px] text-zinc-600">
                        {m.displayName}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Main LeaderboardWindow
// ============================================================

export default function LeaderboardWindow() {
  const [activeTab, setActiveTab] = useState<"participants" | "groups">("participants");

  return (
    <div className="h-full bg-zinc-900 font-mono flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-4 pt-3 pb-0 flex-shrink-0">
        <h2 className="text-xs text-zinc-500 font-bold tracking-widest mb-3">LEADERBOARD</h2>
        <TabSwitcher active={activeTab} onChange={setActiveTab} />
      </div>

      {activeTab === "participants" ? <ParticipantsTab /> : <GroupsTab />}
    </div>
  );
}
