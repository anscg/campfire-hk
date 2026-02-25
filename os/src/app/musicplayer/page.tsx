"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

interface Song {
  _id: string;
  youtubeId: string;
  title: string;
  channelName: string;
  thumbnail: string;
  durationSeconds: number;
  addedByName: string;
  boostCount: number;
  status: "queued" | "playing" | "played" | "removed";
  position: number;
  addedAt: number;
}

interface Player {
  isPlaying: boolean;
  currentId?: string;
  elapsedSeconds: number;
  startedAt?: number;
  pausedAt?: number;
}

function fmtDuration(sec: number): string {
  if (!sec) return "";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

// ── Main player page ──────────────────────────────────────────────────────────

export default function MusicPlayerPage() {
  const [queue, setQueue] = useState<Song[]>([]);
  const [player, setPlayer] = useState<Player | null>(null);
  const [elapsedDisplay, setElapsedDisplay] = useState(0);

  // true once the user has clicked the start overlay (unlocks browser autoplay)
  const [started, setStarted] = useState(false);
  // true once window.YT.Player fires onReady
  const [ytReady, setYtReady] = useState(false);

  const ytPlayerRef = useRef<any>(null);
  const lastVideoIdRef = useRef<string | null>(null);

  // ── Fetch state ────────────────────────────────────────────
  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/music/queue`);
      if (!res.ok) return;
      const data = await res.json();
      setQueue(data.queue ?? []);
      setPlayer(data.player ?? null);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchState();
    const iv = setInterval(fetchState, 2000);
    return () => clearInterval(iv);
  }, [fetchState]);

  // ── Elapsed time ticker ────────────────────────────────────
  useEffect(() => {
    if (!player) return;
    const tick = () => {
      if (player.isPlaying && player.startedAt) {
        setElapsedDisplay(Math.floor(player.elapsedSeconds + (Date.now() - player.startedAt) / 1000));
      } else {
        setElapsedDisplay(Math.floor(player.elapsedSeconds));
      }
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [player]);

  // ── Init YouTube IFrame API (once) ─────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;

    const initPlayer = () => {
      ytPlayerRef.current = new window.YT.Player("yt-player", {
        width: "100%",
        height: "100%",
        videoId: "",
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          playsinline: 1,
          origin: typeof window !== "undefined" ? window.location.origin : "",
        },
        events: {
          onReady: () => {
            // Mark YT ready — triggers the drive-effect
            setYtReady(true);
          },
          onStateChange: (e: any) => {
            // YT.PlayerState.ENDED = 0
            if (e.data === 0) {
              fetch(`${API_URL}/api/music/song-ended`, { method: "POST" })
                .then(() => fetchState())
                .catch(() => {});
            }
          },
        },
      });
    };

    if (window.YT?.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
      if (!document.getElementById("yt-api-script")) {
        const script = document.createElement("script");
        script.id = "yt-api-script";
        script.src = "https://www.youtube.com/iframe_api";
        document.body.appendChild(script);
      }
    }
  }, [fetchState]);

  // ── Drive YT player whenever queue, player state, or readiness changes ───────
  // Only runs after user has clicked start AND YT player is ready
  useEffect(() => {
    if (!started || !ytReady || !ytPlayerRef.current) return;
    const yt = ytPlayerRef.current;
    const nowPlaying = queue.find((s) => s.status === "playing");

    if (!nowPlaying) {
      try { yt.stopVideo?.(); } catch { /* ignore */ }
      lastVideoIdRef.current = null;
      return;
    }

    const videoChanged = nowPlaying.youtubeId !== lastVideoIdRef.current;

    if (videoChanged) {
      lastVideoIdRef.current = nowPlaying.youtubeId;
      try {
        yt.loadVideoById({
          videoId: nowPlaying.youtubeId,
          startSeconds: player?.elapsedSeconds ?? 0,
        });
        // loadVideoById starts buffering; explicitly call playVideo once buffered
        // We call it immediately — the IFrame API queues it correctly
        yt.playVideo?.();
      } catch { /* ignore */ }
    } else {
      // Same video — sync play/pause
      try {
        const ytState = yt.getPlayerState?.();
        const YT_PLAYING = 1;
        const YT_PAUSED = 2;
        if (player?.isPlaying && ytState !== YT_PLAYING) {
          yt.playVideo?.();
        } else if (!player?.isPlaying && ytState === YT_PLAYING) {
          yt.pauseVideo?.();
        }
      } catch { /* ignore */ }
    }
  }, [queue, player, started, ytReady]);

  const nowPlaying = queue.find((s) => s.status === "playing");
  const queued = queue.filter((s) => s.status === "queued");

  return (
    <div
      className="flex h-screen w-screen overflow-hidden select-none"
      style={{ background: "#09090b", fontFamily: "var(--font-geist-mono), 'Courier New', monospace" }}
    >
      {/* ── Left: YouTube player ──────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Video embed */}
        <div className="relative flex-1 bg-black overflow-hidden" style={{ minHeight: 0 }}>
          <div id="yt-player" className="absolute inset-0 w-full h-full" />

          {/* Click-to-start overlay — required to unlock browser autoplay */}
          {!started && (
            <button
              onClick={() => setStarted(true)}
              className="absolute inset-0 flex flex-col items-center justify-center gap-6 w-full h-full"
              style={{ background: "rgba(9,9,11,0.97)", cursor: "pointer", border: "none" }}
            >
              <p style={{ fontSize: 72 }}>🔥</p>
              <div className="flex flex-col items-center gap-2">
                <p
                  style={{
                    fontSize: 13,
                    letterSpacing: "0.25em",
                    color: "rgba(255,255,255,0.9)",
                    fontWeight: 700,
                  }}
                >
                  CAMPFIRE HK · MUSIC PLAYER
                </p>
                <p
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.2em",
                    color: "rgba(255,255,255,0.35)",
                  }}
                >
                  CLICK ANYWHERE TO START
                </p>
              </div>
              <div
                style={{
                  marginTop: 8,
                  padding: "10px 32px",
                  border: "1px solid rgb(234,179,8)",
                  background: "rgb(234,179,8)",
                  color: "#000",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.3em",
                }}
              >
                ▶ START
              </div>
            </button>
          )}

          {/* Idle overlay — nothing queued/playing */}
          {started && !nowPlaying && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-4 pointer-events-none"
              style={{ background: "rgba(9,9,11,0.95)" }}
            >
              <p style={{ fontSize: 64 }}>🔥</p>
              <p
                style={{
                  fontSize: 11,
                  letterSpacing: "0.3em",
                  color: "rgba(255,255,255,0.3)",
                  textTransform: "uppercase",
                }}
              >
                CAMPFIRE HK · WAITING FOR MUSIC
              </p>
            </div>
          )}
        </div>

        {/* Now playing info bar */}
        <div
          className="flex items-center gap-4 px-6 py-4 border-t"
          style={{ borderColor: "#27272a", background: "#111113" }}
        >
          {nowPlaying ? (
            <>
              <div
                className="flex-shrink-0 overflow-hidden"
                style={{ width: 52, height: 38, background: "#27272a" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={nowPlaying.thumbnail} alt="" className="w-full h-full object-cover" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="truncate font-bold leading-tight" style={{ fontSize: 15, color: "#fff" }}>
                  {nowPlaying.title}
                </p>
                <p className="truncate" style={{ fontSize: 11, color: "#71717a", marginTop: 2 }}>
                  {nowPlaying.channelName}
                  {nowPlaying.addedByName ? ` · requested by ${nowPlaying.addedByName}` : ""}
                  {nowPlaying.boostCount > 0 ? ` · ↑${nowPlaying.boostCount} boost${nowPlaying.boostCount !== 1 ? "s" : ""}` : ""}
                </p>
              </div>

              {nowPlaying.durationSeconds > 0 && (
                <div className="flex-shrink-0 flex items-center gap-2">
                  <span style={{ fontSize: 12, color: "#a1a1aa", fontVariantNumeric: "tabular-nums" }}>
                    {fmtDuration(Math.min(elapsedDisplay, nowPlaying.durationSeconds))}
                  </span>
                  <div className="overflow-hidden" style={{ width: 80, height: 2, background: "#27272a" }}>
                    <div
                      style={{
                        height: "100%",
                        background: "rgb(234,179,8)",
                        width: `${Math.min(100, (elapsedDisplay / nowPlaying.durationSeconds) * 100)}%`,
                        transition: "width 1s linear",
                      }}
                    />
                  </div>
                  <span style={{ fontSize: 12, color: "#52525b", fontVariantNumeric: "tabular-nums" }}>
                    {fmtDuration(nowPlaying.durationSeconds)}
                  </span>
                </div>
              )}

              <div className="flex-shrink-0 flex items-center gap-2">
                {player?.isPlaying ? (
                  <PlayingBars />
                ) : (
                  <span style={{ fontSize: 11, color: "rgb(234,179,8)", letterSpacing: "0.2em" }}>
                    PAUSED
                  </span>
                )}
              </div>
            </>
          ) : (
            <p style={{ fontSize: 11, letterSpacing: "0.3em", color: "#3f3f46" }}>
              CAMPFIRE HK · QUEUE EMPTY
            </p>
          )}
        </div>
      </div>

      {/* ── Right: Queue sidebar ──────────────────────────── */}
      <div
        className="flex flex-col border-l overflow-hidden"
        style={{ width: 320, borderColor: "#27272a" }}
      >
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: "#27272a", background: "#0c0c0e" }}
        >
          <div>
            <p style={{ fontSize: 10, letterSpacing: "0.3em", color: "#52525b" }}>CAMPFIRE HK</p>
            <p style={{ fontSize: 12, letterSpacing: "0.2em", color: "#a1a1aa", marginTop: 2 }}>UP NEXT</p>
          </div>
          {queued.length > 0 && (
            <span
              style={{
                fontSize: 10,
                letterSpacing: "0.1em",
                border: "1px solid #3f3f46",
                color: "#71717a",
                padding: "2px 8px",
              }}
            >
              {queued.length} SONG{queued.length !== 1 ? "S" : ""}
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto" style={{ background: "#0c0c0e" }}>
          {queued.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2" style={{ color: "#3f3f46" }}>
              <p style={{ fontSize: 24 }}>🎵</p>
              <p style={{ fontSize: 10, letterSpacing: "0.3em" }}>QUEUE EMPTY</p>
            </div>
          ) : (
            queued.map((song, idx) => <QueueRow key={song._id} song={song} idx={idx} />)
          )}
        </div>

        <div
          className="px-4 py-3 border-t flex items-center justify-between"
          style={{ borderColor: "#27272a", background: "#0c0c0e" }}
        >
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 16 }}>🔥</span>
            <div>
              <p style={{ fontSize: 9, letterSpacing: "0.3em", color: "#3f3f46" }}>CAMPFIRE HONG KONG</p>
              <p style={{ fontSize: 9, letterSpacing: "0.2em", color: "#27272a" }}>os.campfire.hk</p>
            </div>
          </div>
          <p style={{ fontSize: 9, color: "#3f3f46", letterSpacing: "0.2em" }}>ADD SONGS IN THE OS APP</p>
        </div>
      </div>
    </div>
  );
}

// ── Queue row ─────────────────────────────────────────────────────────────────

function QueueRow({ song, idx }: { song: Song; idx: number }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: "#1a1a1d" }}>
      <span
        style={{
          fontSize: 11, color: "#3f3f46", width: 18, textAlign: "right",
          flexShrink: 0, fontVariantNumeric: "tabular-nums",
        }}
      >
        {idx + 1}
      </span>
      <div style={{ width: 40, height: 30, flexShrink: 0, background: "#1c1c1f", overflow: "hidden" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={song.thumbnail} alt="" className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="truncate leading-tight" style={{ fontSize: 11, color: "#d4d4d8", fontWeight: 600 }}>
          {song.title}
        </p>
        <p className="truncate" style={{ fontSize: 10, color: "#52525b", marginTop: 1 }}>
          {song.addedByName}{song.durationSeconds > 0 ? ` · ${fmtDuration(song.durationSeconds)}` : ""}
        </p>
      </div>
      {song.boostCount > 0 && (
        <span
          style={{
            fontSize: 9, letterSpacing: "0.1em", color: "rgb(234,179,8)",
            flexShrink: 0, border: "1px solid rgba(234,179,8,0.3)", padding: "1px 4px",
          }}
        >
          ↑{song.boostCount}
        </span>
      )}
    </div>
  );
}

// ── Animated playing bars ─────────────────────────────────────────────────────

function PlayingBars() {
  return (
    <div className="flex items-end gap-0.5" style={{ height: 16 }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: 3,
            background: "rgb(34,197,94)",
            animation: `musicBar${i} 0.8s ease-in-out infinite alternate`,
            animationDelay: `${i * 0.15}s`,
            height: "100%",
            transformOrigin: "bottom",
          }}
        />
      ))}
      <style>{`
        @keyframes musicBar0 { from { transform: scaleY(0.2); } to { transform: scaleY(1); } }
        @keyframes musicBar1 { from { transform: scaleY(0.5); } to { transform: scaleY(0.3); } }
        @keyframes musicBar2 { from { transform: scaleY(0.8); } to { transform: scaleY(0.15); } }
      `}</style>
    </div>
  );
}
