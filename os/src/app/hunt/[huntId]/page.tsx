"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

type Phase =
  | "idle"
  | "loading"
  | "success"
  | "already"
  | "group_blocked"
  | "no_xp"
  | "not_logged_in"
  | "error";

interface RedeemResult {
  alreadyRedeemed: boolean;
  groupBlocked: boolean;
  xpAwarded: number;
  rank: number;
}

const RANK_LABELS: Record<number, string> = {
  1: "1ST",
  2: "2ND",
  3: "3RD",
};

export default function HuntPage() {
  const params = useParams();
  const huntId = params?.huntId as string;

  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<RedeemResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!huntId) return;
    redeem();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [huntId]);

  async function redeem() {
    setPhase("loading");
    setError(null);

    const token = getStoredToken();
    if (!token) {
      setPhase("not_logged_in");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/hunt/${encodeURIComponent(huntId)}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (res.status === 401) {
        setPhase("not_logged_in");
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error ?? `Server error ${res.status}`);
        setPhase("error");
        return;
      }

      const data: RedeemResult = await res.json();

      if (data.alreadyRedeemed) {
        setResult(data);
        setPhase("already");
      } else if (data.groupBlocked) {
        setPhase("group_blocked");
      } else if (data.xpAwarded === 0) {
        setPhase("no_xp");
      } else {
        setResult(data);
        setPhase("success");
      }
    } catch (err: any) {
      setError(err?.message ?? "Network error");
      setPhase("error");
    }
  }

  return (
    <div
      className="min-h-screen bg-black flex flex-col items-center justify-center p-6 gap-6"
      style={{ fontFamily: "var(--font-pixelify), monospace" }}
    >
      <div className="text-4xl">🔍</div>
      <h1 className="text-orange-400 text-xl font-bold tracking-widest uppercase">
        Code Hunters
      </h1>

      <div className="w-full max-w-xs">
        {phase === "loading" && (
          <StatusBox colour="zinc">
            <p className="text-zinc-400 text-sm text-center animate-pulse">Redeeming…</p>
          </StatusBox>
        )}

        {phase === "idle" && (
          <StatusBox colour="zinc">
            <p className="text-zinc-500 text-xs text-center">Initialising…</p>
          </StatusBox>
        )}

        {phase === "not_logged_in" && (
          <StatusBox colour="orange">
            <p className="text-orange-400 font-bold text-sm tracking-wider mb-1">
              NOT LOGGED IN
            </p>
            <p className="text-orange-300/80 text-xs leading-relaxed mb-3">
              You need to be logged in to claim XP. Open this link on the device
              where you're already logged in:
            </p>
            <div className="bg-black/40 border border-orange-800 px-3 py-2 text-center mb-3">
              <span className="text-orange-300 text-xs font-mono break-all">
                os.campfire.hk/hunt/{huntId}
              </span>
            </div>
            <ShareButton huntId={huntId} />
          </StatusBox>
        )}

        {phase === "success" && result && (
          <StatusBox colour="green">
            <p className="text-green-400 font-bold text-lg tracking-widest mb-1 text-center">
              {RANK_LABELS[result.rank] ?? `#${result.rank}`} FIND!
            </p>
            <p className="text-green-300 text-3xl font-bold text-center mb-1">
              +{result.xpAwarded} XP
            </p>
            <p className="text-green-300/60 text-xs text-center">
              Added to your balance
            </p>
          </StatusBox>
        )}

        {phase === "already" && result && (
          <StatusBox colour="zinc">
            <p className="text-zinc-300 font-bold text-sm tracking-wider mb-1">
              ALREADY REDEEMED
            </p>
            <p className="text-zinc-400 text-xs leading-relaxed">
              You already claimed this hunt (+{result.xpAwarded} XP). You can't claim it again.
            </p>
          </StatusBox>
        )}

        {phase === "group_blocked" && (
          <StatusBox colour="orange">
            <p className="text-orange-400 font-bold text-sm tracking-wider mb-1">
              GROUP ALREADY CLAIMED
            </p>
            <p className="text-orange-300/80 text-xs leading-relaxed">
              Someone else in your group already redeemed this hunt. Only one person per
              group can claim each code.
            </p>
          </StatusBox>
        )}

        {phase === "no_xp" && (
          <StatusBox colour="zinc">
            <p className="text-zinc-300 font-bold text-sm tracking-wider mb-1">
              TOO LATE
            </p>
            <p className="text-zinc-400 text-xs leading-relaxed">
              The top 3 spots for this hunt are already taken. No XP this time — but
              nice find!
            </p>
          </StatusBox>
        )}

        {phase === "error" && (
          <StatusBox colour="red">
            <p className="text-red-400 font-bold text-sm tracking-wider mb-1">ERROR</p>
            <p className="text-red-300/80 text-xs leading-relaxed">
              {error ?? "Something went wrong. Try again."}
            </p>
          </StatusBox>
        )}
      </div>

      <a
        href="/"
        className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors tracking-wider"
      >
        ← Back to Campfire OS
      </a>
    </div>
  );
}

// ── helpers ───────────────────────────────────────────────────

function getStoredToken(): string | null {
  try {
    // Zustand persist stores under the key defined in authStore: "campfire-os-auth"
    const raw = localStorage.getItem("campfire-os-auth");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state?.token ?? null;
  } catch {
    return null;
  }
}

function StatusBox({
  colour,
  children,
}: {
  colour: "green" | "orange" | "red" | "zinc";
  children: React.ReactNode;
}) {
  const border = {
    green: "border-green-800 bg-green-900/20",
    orange: "border-orange-800 bg-orange-900/20",
    red: "border-red-800 bg-red-900/20",
    zinc: "border-zinc-700 bg-zinc-900/50",
  }[colour];

  return (
    <div className={`border px-4 py-4 ${border}`}>
      {children}
    </div>
  );
}

// ── ShareButton ───────────────────────────────────────────────
// Uses Web Share API (AirDrop on iOS/macOS Safari) with copy-link fallback.

function ShareButton({ huntId }: { huntId: string }) {
  const [copied, setCopied] = useState(false);
  const url = `https://os.campfire.hk/hunt/${huntId}`;

  const canShare =
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function";

  const handleShare = useCallback(async () => {
    if (canShare) {
      try {
        await navigator.share({
          title: "Campfire Hunt — claim your XP!",
          text: "I found a hidden code at Campfire HK — open this on your logged-in device to claim XP:",
          url,
        });
        return;
      } catch {
        // user cancelled or share failed — fall through to copy
      }
    }
    // Copy fallback
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked — nothing we can do
    }
  }, [canShare, url]);

  return (
    <button
      onClick={handleShare}
      className="w-full flex items-center justify-center gap-2 border border-orange-700
        bg-orange-900/30 hover:bg-orange-900/50 text-orange-300 text-xs font-bold
        tracking-widest py-2.5 transition-colors"
    >
      {canShare ? (
        <>
          <span>⬆</span>
          <span>SHARE / AIRDROP LINK</span>
        </>
      ) : copied ? (
        <span>COPIED!</span>
      ) : (
        <>
          <span>⎘</span>
          <span>COPY LINK</span>
        </>
      )}
    </button>
  );
}
