"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuthStore } from "@/stores/authStore";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const YT_API_KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY || "";

const BOOST_XP_COST = 75;
const STOP_XP_COST = 150;
const SKIP_XP_COST = 350;

// ── Types ─────────────────────────────────────────────────────────────────────

interface Song {
  _id: string;
  youtubeId: string;
  title: string;
  channelName: string;
  thumbnail: string;
  durationSeconds: number;
  addedBy: string;
  addedByName: string;
  position: number;
  boostCount: number;
  boostedBy: string[];
  status: "queued" | "playing" | "played" | "removed";
  addedAt: number;
}

interface Player {
  isPlaying: boolean;
  currentId?: string;
  elapsedSeconds: number;
  startedAt?: number;
}

interface YTResult {
  id: string;
  title: string;
  channelName: string;
  thumbnail: string;
  durationSeconds: number;
  duration: string; // formatted
}

type Tab = "queue" | "search" | "history";

function fmtDuration(sec: number): string {
  if (!sec) return "?:??";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

// Parse ISO 8601 duration from YouTube API (e.g. PT3M45S → 225)
function parseISO8601Duration(d: string): number {
  const m = d.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (Number(m[1] || 0) * 3600) + (Number(m[2] || 0) * 60) + Number(m[3] || 0);
}

// ── Confirm Modal ─────────────────────────────────────────────────────────────

interface ConfirmModalProps {
  title: string;
  body: string;
  confirmLabel: string;
  confirmColor?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

function ConfirmModal({
  title,
  body,
  confirmLabel,
  confirmColor = "rgb(234,179,8)",
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmModalProps) {
  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.75)" }}
    >
      <div
        className="flex flex-col gap-4 p-5 w-72"
        style={{
          background: "#111113",
          border: "1px solid #3f3f46",
          fontFamily: "var(--font-geist-mono), 'Courier New', monospace",
        }}
      >
        <p
          className="text-xs font-bold tracking-widest"
          style={{ color: "#fff", letterSpacing: "0.2em" }}
        >
          {title}
        </p>
        <p className="text-xs leading-relaxed" style={{ color: "#a1a1aa" }}>
          {body}
        </p>
        <div className="flex gap-2 mt-1">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2 text-xs font-bold tracking-widest border"
            style={{
              border: "1px solid #3f3f46",
              color: "#71717a",
              background: "transparent",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            CANCEL
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2 text-xs font-bold tracking-widest"
            style={{
              background: loading ? "#3f3f46" : confirmColor,
              color: loading ? "#71717a" : "#000",
              border: `1px solid ${loading ? "#3f3f46" : confirmColor}`,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type PendingAction =
  | { type: "boost"; song: Song }
  | { type: "stop" }
  | { type: "skip" };

export default function MusicWindow() {
  const { token, user } = useAuthStore();
  const isAdmin = (user as any)?.isAdmin === true;

  const [tab, setTab] = useState<Tab>("queue");
  const [queue, setQueue] = useState<Song[]>([]);
  const [history, setHistory] = useState<Song[]>([]);
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Confirm modal state
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [confirming, setConfirming] = useState(false);

  // Poll queue every 3s
  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/music/queue`);
      if (res.ok) {
        const data = await res.json();
        setQueue(data.queue ?? []);
        setPlayer(data.player ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    const res = await fetch(`${API_URL}/api/music/history`);
    if (res.ok) setHistory(await res.json());
  }, []);

  useEffect(() => {
    fetchQueue();
    const iv = setInterval(fetchQueue, 3000);
    return () => clearInterval(iv);
  }, [fetchQueue]);

  useEffect(() => {
    if (tab === "history") fetchHistory();
  }, [tab, fetchHistory]);

  const flashMsg = (ok: boolean, text: string) => {
    setActionMsg({ ok, text });
    setTimeout(() => setActionMsg(null), 2500);
  };

  // ── Confirm modal handlers ────────────────────────────────────────────────

  const handleConfirm = async () => {
    if (!pendingAction || !token) return;
    setConfirming(true);
    try {
      if (pendingAction.type === "boost") {
        const res = await fetch(`${API_URL}/api/music/boost/${pendingAction.song._id}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        flashMsg(true, `Boosted! −${BOOST_XP_COST} XP`);
        fetchQueue();
      } else if (pendingAction.type === "stop") {
        const res = await fetch(`${API_URL}/api/music/participant-stop`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        flashMsg(true, `Music stopped. −${STOP_XP_COST} XP`);
        fetchQueue();
      } else if (pendingAction.type === "skip") {
        const res = await fetch(`${API_URL}/api/music/participant-skip`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        flashMsg(true, `Skipped! −${SKIP_XP_COST} XP`);
        fetchQueue();
      }
    } catch (e: any) {
      flashMsg(false, e.message);
    } finally {
      setConfirming(false);
      setPendingAction(null);
    }
  };

  const handleAdminAction = async (action: string) => {
    if (!token) return;
    let url = `${API_URL}/api/music/${action}`;
    let method = "POST";
    if (action.startsWith("remove/")) { url = `${API_URL}/api/music/${action}`; method = "DELETE"; }
    if (action === "clear") { url = `${API_URL}/api/music/clear`; method = "DELETE"; }
    try {
      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      fetchQueue();
    } catch (e: any) {
      flashMsg(false, e.message);
    }
  };

  const handleRemove = async (song: Song) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/music/remove/${song._id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      fetchQueue();
    } catch (e: any) {
      flashMsg(false, e.message);
    }
  };

  const nowPlaying = queue.find((s) => s.status === "playing");
  const queued = queue.filter((s) => s.status === "queued");
  const TABS: Tab[] = ["queue", "search", "history"];

  // ── Confirm modal config ──────────────────────────────────────────────────

  let modal: ConfirmModalProps | null = null;
  if (pendingAction) {
    if (pendingAction.type === "boost") {
      modal = {
        title: "BOOST SONG",
        body: `Move "${pendingAction.song.title}" up the queue. This costs ${BOOST_XP_COST} XP.`,
        confirmLabel: `BOOST −${BOOST_XP_COST} XP`,
        confirmColor: "rgb(234,179,8)",
        onConfirm: handleConfirm,
        onCancel: () => setPendingAction(null),
        loading: confirming,
      };
    } else if (pendingAction.type === "stop") {
      modal = {
        title: "STOP MUSIC",
        body: `Pause the current song for everyone. This costs ${STOP_XP_COST} XP.`,
        confirmLabel: `STOP −${STOP_XP_COST} XP`,
        confirmColor: "rgb(239,68,68)",
        onConfirm: handleConfirm,
        onCancel: () => setPendingAction(null),
        loading: confirming,
      };
    } else if (pendingAction.type === "skip") {
      modal = {
        title: "SKIP SONG",
        body: `Skip to the next song in the queue. This costs ${SKIP_XP_COST} XP.`,
        confirmLabel: `SKIP −${SKIP_XP_COST} XP`,
        confirmColor: "rgb(239,68,68)",
        onConfirm: handleConfirm,
        onCancel: () => setPendingAction(null),
        loading: confirming,
      };
    }
  }

  return (
    <div className="flex flex-col h-full bg-zinc-900 font-mono relative">
      {/* Now Playing bar */}
      <NowPlayingBar
        song={nowPlaying ?? null}
        player={player}
        isAdmin={isAdmin}
        token={token}
        onAdminAction={handleAdminAction}
        onParticipantStop={() => setPendingAction({ type: "stop" })}
        onParticipantSkip={() => setPendingAction({ type: "skip" })}
      />

      {/* Tab bar */}
      <div className="flex border-b border-zinc-700">
        {TABS.map((t) => (
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
            {t === "queue" ? `QUEUE${queued.length > 0 ? ` (${queued.length})` : ""}` : t.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Flash message */}
      {actionMsg && (
        <div
          className={`px-4 py-1.5 text-xs font-bold tracking-widest border-b ${
            actionMsg.ok
              ? "bg-green-950 border-green-800 text-green-400"
              : "bg-red-950 border-red-800 text-red-400"
          }`}
        >
          {actionMsg.ok ? "✓ " : "✗ "}{actionMsg.text}
        </div>
      )}

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {tab === "queue" && (
          <QueueTab
            queue={queued}
            loading={loading}
            userId={user?._id ?? ""}
            isAdmin={isAdmin}
            onBoost={(song) => setPendingAction({ type: "boost", song })}
            onRemove={handleRemove}
            onClear={() => handleAdminAction("clear")}
          />
        )}
        {tab === "search" && (
          <SearchTab token={token} onAdded={() => { setTab("queue"); fetchQueue(); }} />
        )}
        {tab === "history" && (
          <HistoryTab history={history} />
        )}
      </div>

      {/* Confirm modal overlay */}
      {modal && <ConfirmModal {...modal} />}
    </div>
  );
}

// ── Now Playing Bar ────────────────────────────────────────────────────────────

function NowPlayingBar({
  song,
  player,
  isAdmin,
  token,
  onAdminAction,
  onParticipantStop,
  onParticipantSkip,
}: {
  song: Song | null;
  player: Player | null;
  isAdmin: boolean;
  token: string | null;
  onAdminAction: (action: string) => void;
  onParticipantStop: () => void;
  onParticipantSkip: () => void;
}) {
  // Tick elapsed seconds locally so the bar animates smoothly between polls
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!player) { setElapsed(0); return; }
    const compute = () => {
      if (player.isPlaying && player.startedAt) {
        return Math.floor(player.elapsedSeconds + (Date.now() - player.startedAt) / 1000);
      }
      return Math.floor(player.elapsedSeconds);
    };
    setElapsed(compute());
    const iv = setInterval(() => setElapsed(compute()), 1000);
    return () => clearInterval(iv);
  }, [player]);

  if (!song) {
    return (
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700 bg-zinc-950">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-zinc-700" />
          <p className="text-xs text-zinc-600 tracking-widest">NOTHING PLAYING</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => onAdminAction("play")}
            className="text-xs px-3 py-1 border border-green-700 text-green-400 hover:bg-green-950 tracking-widest"
          >
            ▶ PLAY
          </button>
        )}
      </div>
    );
  }

  const duration = song.durationSeconds;
  const pct = duration > 0 ? Math.min(100, (elapsed / duration) * 100) : 0;

  return (
    <div className="border-b border-zinc-700 bg-zinc-950">
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Thumbnail */}
        <div className="w-10 h-10 flex-shrink-0 bg-zinc-800 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={song.thumbnail} alt="" className="w-full h-full object-cover" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="inline-block w-1.5 h-1.5 flex-shrink-0"
              style={{
                background: player?.isPlaying ? "rgb(34,197,94)" : "rgb(234,179,8)",
                animation: player?.isPlaying ? "pulse 1.5s ease-in-out infinite" : "none",
              }}
            />
            <p className="text-xs text-zinc-500 tracking-widest">
              {player?.isPlaying ? "NOW PLAYING" : "PAUSED"}
            </p>
          </div>
          <p className="text-sm font-bold text-white truncate leading-tight mt-0.5">
            {song.title}
          </p>
          <p className="text-xs text-zinc-500 truncate">{song.channelName}</p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {isAdmin ? (
            // Admin: free play/pause + skip
            <>
              {player?.isPlaying ? (
                <button
                  onClick={() => onAdminAction("pause")}
                  title="Pause"
                  className="w-7 h-7 flex items-center justify-center border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 text-xs"
                >
                  ⏸
                </button>
              ) : (
                <button
                  onClick={() => onAdminAction("play")}
                  title="Resume"
                  className="w-7 h-7 flex items-center justify-center border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 text-xs"
                >
                  ▶
                </button>
              )}
              <button
                onClick={() => onAdminAction("skip")}
                title="Skip"
                className="w-7 h-7 flex items-center justify-center border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 text-xs"
              >
                ⏭
              </button>
            </>
          ) : (
            // Participant: paid stop + skip
            <>
              <button
                onClick={onParticipantStop}
                title={`Stop music (${STOP_XP_COST} XP)`}
                className="flex items-center justify-center border text-xs px-2 h-7 gap-1 tracking-widest"
                style={{
                  borderColor: "rgb(63,63,70)",
                  color: "rgba(255,255,255,0.4)",
                  background: "transparent",
                }}
              >
                ⏸
                <span className="text-xs" style={{ color: "rgb(234,179,8)", fontSize: 9 }}>
                  {STOP_XP_COST}XP
                </span>
              </button>
              <button
                onClick={onParticipantSkip}
                title={`Skip song (${SKIP_XP_COST} XP)`}
                className="flex items-center justify-center border text-xs px-2 h-7 gap-1 tracking-widest"
                style={{
                  borderColor: "rgb(63,63,70)",
                  color: "rgba(255,255,255,0.4)",
                  background: "transparent",
                }}
              >
                ⏭
                <span className="text-xs" style={{ color: "rgb(234,179,8)", fontSize: 9 }}>
                  {SKIP_XP_COST}XP
                </span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Progress bar — full width, flush to bottom */}
      <ProgressBar
        pct={pct}
        isPlaying={player?.isPlaying ?? false}
        isAdmin={isAdmin}
        duration={duration}
        token={token}
      />
    </div>
  );
}

// ── Progress Bar ──────────────────────────────────────────────────────────────

function ProgressBar({
  pct,
  isPlaying,
  isAdmin,
  duration,
  token,
}: {
  pct: number;
  isPlaying: boolean;
  isAdmin: boolean;
  duration: number;
  token: string | null;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [localPct, setLocalPct] = useState<number | null>(null);

  function pctFromEvent(e: MouseEvent | React.MouseEvent) {
    const bar = barRef.current;
    if (!bar) return 0;
    const rect = bar.getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (!isAdmin || duration <= 0) return;
    e.preventDefault();
    dragging.current = true;
    setLocalPct(pctFromEvent(e) * 100);

    function onMove(ev: MouseEvent) {
      if (!dragging.current) return;
      setLocalPct(pctFromEvent(ev) * 100);
    }
    function onUp(ev: MouseEvent) {
      if (!dragging.current) return;
      dragging.current = false;
      const fraction = pctFromEvent(ev);
      setLocalPct(null);
      const seconds = Math.round(fraction * duration);
      fetch(`${API_URL}/api/music/seek`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ seconds }),
      }).catch(() => {});
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  const displayPct = localPct ?? pct;

  return (
    <div
      ref={barRef}
      onMouseDown={handleMouseDown}
      style={{
        height: 8,
        background: "#27272a",
        cursor: isAdmin && duration > 0 ? "col-resize" : "default",
        position: "relative",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${displayPct}%`,
          background: "#ffffff",
          transition: isPlaying && localPct === null ? "width 1s linear" : "none",
        }}
      />
      {/* Drag handle thumb — only shown for admins */}
      {isAdmin && duration > 0 && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: `${displayPct}%`,
            transform: "translate(-50%, -50%)",
            width: 12,
            height: 12,
            background: "#ffffff",
            border: "2px solid #27272a",
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}

// ── Queue Tab ─────────────────────────────────────────────────────────────────

function QueueTab({
  queue,
  loading,
  userId,
  isAdmin,
  onBoost,
  onRemove,
  onClear,
}: {
  queue: Song[];
  loading: boolean;
  userId: string;
  isAdmin: boolean;
  onBoost: (song: Song) => void;
  onRemove: (song: Song) => void;
  onClear: () => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-20 text-zinc-500 text-xs">
        LOADING...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      {(queue.length > 0 || isAdmin) && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
          <span className="text-xs text-zinc-500 tracking-widest">
            {queue.length} SONG{queue.length !== 1 ? "S" : ""} QUEUED
          </span>
          {isAdmin && queue.length > 0 && (
            <button
              onClick={() => {
                if (confirm("Clear the entire queue?")) onClear();
              }}
              className="text-xs text-red-600 hover:text-red-400 tracking-widest border border-red-900 px-2 py-1"
            >
              CLEAR ALL
            </button>
          )}
        </div>
      )}

      {queue.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full gap-2 text-zinc-600">
          <p className="text-2xl">🎵</p>
          <p className="text-xs tracking-widest">QUEUE IS EMPTY</p>
          <p className="text-xs text-zinc-700">Search for a song to add it</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {queue.map((song, idx) => {
            const alreadyBoosted = song.boostedBy.includes(userId);

            return (
              <div key={song._id} className="border-b border-zinc-800 px-4 py-3 flex items-center gap-3">
                {/* Position number */}
                <span className="text-xs text-zinc-600 w-5 text-right flex-shrink-0 font-bold">
                  {idx + 1}
                </span>

                {/* Thumbnail */}
                <div className="w-9 h-9 flex-shrink-0 bg-zinc-800 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={song.thumbnail} alt="" className="w-full h-full object-cover" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate leading-tight">{song.title}</p>
                  <p className="text-xs text-zinc-600 truncate">
                    {song.channelName} · {fmtDuration(song.durationSeconds)} · by {song.addedByName}
                  </p>
                </div>

                {/* Boost count badge */}
                {song.boostCount > 0 && (
                  <span
                    className="text-xs px-1.5 py-0.5 flex-shrink-0 font-bold tracking-widest"
                    style={{
                      background: "rgba(234,179,8,0.15)",
                      border: "1px solid rgba(234,179,8,0.4)",
                      color: "rgb(234,179,8)",
                    }}
                  >
                    ↑{song.boostCount}
                  </span>
                )}

                {/* Boost button */}
                <button
                  onClick={() => !alreadyBoosted && onBoost(song)}
                  disabled={alreadyBoosted}
                  title={alreadyBoosted ? "Already boosted" : `Boost this song (${BOOST_XP_COST} XP)`}
                  className="flex items-center justify-center border text-xs flex-shrink-0 gap-1 px-2 h-7"
                  style={{
                    borderColor: alreadyBoosted ? "rgb(34,197,94)" : "rgb(63,63,70)",
                    color: alreadyBoosted ? "rgb(34,197,94)" : "rgba(255,255,255,0.7)",
                    background: alreadyBoosted ? "rgba(34,197,94,0.08)" : "transparent",
                    cursor: alreadyBoosted ? "not-allowed" : "pointer",
                  }}
                >
                  {alreadyBoosted ? (
                    <span>✓</span>
                  ) : (
                    <>
                      <span>BOOST</span>
                      <span style={{ color: "rgb(234,179,8)", fontSize: 9 }}>{BOOST_XP_COST}XP</span>
                    </>
                  )}
                </button>

                {/* Admin remove */}
                {isAdmin && (
                  <button
                    onClick={() => onRemove(song)}
                    title="Remove"
                    className="w-7 h-7 flex items-center justify-center border border-zinc-800 text-zinc-600 hover:border-red-900 hover:text-red-500 text-xs flex-shrink-0"
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Search Tab ────────────────────────────────────────────────────────────────

function SearchTab({
  token,
  onAdded,
}: {
  token: string | null;
  onAdded: () => void;
}) {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<YTResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const extractVideoId = (input: string): string | null => {
    if (/^[a-zA-Z0-9_-]{11}$/.test(input.trim())) return input.trim();
    const m = input.match(
      /(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    );
    return m ? m[1] : null;
  };

  const handleLookup = async () => {
    const videoId = extractVideoId(url);
    if (!videoId) {
      setMsg({ ok: false, text: "Paste a valid YouTube URL or video ID" });
      return;
    }
    setLoading(true);
    setMsg(null);
    setResult(null);
    try {
      if (YT_API_KEY) {
        const r = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${YT_API_KEY}`
        );
        const data = await r.json();
        if (data.items?.[0]) {
          const item = data.items[0];
          const sec = parseISO8601Duration(item.contentDetails.duration);
          setResult({
            id: videoId,
            title: item.snippet.title,
            channelName: item.snippet.channelTitle,
            thumbnail: item.snippet.thumbnails?.medium?.url || `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
            durationSeconds: sec,
            duration: fmtDuration(sec),
          });
          return;
        }
      }
      // Fallback: no API key
      setResult({
        id: videoId,
        title: `YouTube video ${videoId}`,
        channelName: "",
        thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        durationSeconds: 0,
        duration: "?:??",
      });
    } catch {
      setMsg({ ok: false, text: "Failed to look up video" });
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (r: YTResult) => {
    if (!token) return;
    setAddingId(r.id);
    setMsg(null);
    try {
      const res = await fetch(`${API_URL}/api/music/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          youtubeId: r.id,
          title: r.title,
          channelName: r.channelName,
          thumbnail: r.thumbnail,
          durationSeconds: r.durationSeconds,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg({ ok: true, text: `"${r.title}" added to queue!` });
      setTimeout(() => onAdded(), 800);
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* URL input */}
      <div className="border-b border-zinc-700 px-4 py-3">
        <p className="text-xs text-zinc-500 tracking-widest mb-2">PASTE YOUTUBE URL</p>
        <div className="flex gap-2">
          <input
            autoFocus
            value={url}
            onChange={(e) => { setUrl(e.target.value); setMsg(null); setResult(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") handleLookup(); }}
            placeholder="https://youtube.com/watch?v=..."
            className="flex-1 bg-zinc-800 border border-zinc-700 px-3 py-2 text-xs text-white placeholder-zinc-600 outline-none"
          />
          <button
            onClick={handleLookup}
            disabled={loading || !url.trim()}
            className="px-3 py-2 text-xs font-bold tracking-widest border"
            style={{
              background: loading || !url.trim() ? "#27272a" : "rgb(234,179,8)",
              borderColor: loading || !url.trim() ? "#3f3f46" : "rgb(234,179,8)",
              color: loading || !url.trim() ? "#52525b" : "#000",
              cursor: loading || !url.trim() ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "..." : "GO"}
          </button>
        </div>
      </div>

      {/* Status message */}
      {msg && (
        <div
          className={`px-4 py-2 text-xs border-b ${
            msg.ok
              ? "bg-green-950 border-green-800 text-green-400"
              : "bg-red-950 border-red-800 text-red-400"
          }`}
        >
          {msg.ok ? "✓ " : "✗ "}{msg.text}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {/* Result */}
        {result && (
          <div className="border-b border-zinc-800 px-4 py-3 flex items-center gap-3">
            <div className="w-12 h-9 flex-shrink-0 bg-zinc-800 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={result.thumbnail} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white leading-tight truncate">{result.title}</p>
              <p className="text-xs text-zinc-600 truncate">
                {result.channelName}{result.duration !== "?:??" ? ` · ${result.duration}` : ""}
              </p>
            </div>
            <button
              onClick={() => handleAdd(result)}
              disabled={addingId === result.id}
              className="flex-shrink-0 px-3 py-1.5 text-xs font-bold tracking-widest border flex flex-col items-center leading-tight"
              style={{
                background: "rgb(234,179,8)",
                borderColor: "rgb(234,179,8)",
                color: "#000",
                opacity: addingId === result.id ? 0.6 : 1,
                cursor: addingId === result.id ? "not-allowed" : "pointer",
              }}
            >
              <span>{addingId === result.id ? "..." : "+ ADD"}</span>
              {addingId !== result.id && <span style={{ fontSize: "9px", opacity: 0.7 }}>10 XP</span>}
            </button>
          </div>
        )}

        {/* Empty state */}
        {!result && !msg && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-zinc-600 px-6 text-center">
            <p className="text-xl">🔗</p>
            <p className="text-xs tracking-widest">Paste a YouTube URL above and press GO</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── History Tab ───────────────────────────────────────────────────────────────

function HistoryTab({ history }: { history: Song[] }) {
  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-zinc-600">
        <p className="text-2xl">📼</p>
        <p className="text-xs tracking-widest">NO HISTORY YET</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto h-full">
      {history.map((song) => (
        <div key={song._id} className="border-b border-zinc-800 px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 flex-shrink-0 bg-zinc-800 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={song.thumbnail} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-zinc-400 truncate leading-tight">{song.title}</p>
            <p className="text-xs text-zinc-600 truncate">
              {song.channelName} · added by {song.addedByName} · {timeAgo(song.addedAt)}
            </p>
          </div>
          {song.boostCount > 0 && (
            <span className="text-xs text-zinc-600 flex-shrink-0">↑{song.boostCount}</span>
          )}
        </div>
      ))}
    </div>
  );
}
