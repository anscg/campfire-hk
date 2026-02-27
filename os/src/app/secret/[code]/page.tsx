"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

type Phase = "loading" | "redirect" | "invalid" | "error";

// ── /secret/[code] ────────────────────────────────────────────
// QR codes at the venue may point here for participants who are not
// logged in on the scanning device. This page:
//   1. Resolves the short code → hunt ID via /api/hunt/secret/:code
//   2. If the user IS logged in → immediately redirects to /hunt/[huntId]
//   3. If NOT logged in → shows them the direct URL to open on their own device
export default function SecretPage() {
  const params = useParams();
  const router = useRouter();
  const code = params?.code as string;

  const [phase, setPhase] = useState<Phase>("loading");
  const [huntId, setHuntId] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    resolve();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  async function resolve() {
    try {
      const res = await fetch(`${API_URL}/api/hunt/secret/${encodeURIComponent(code)}`);
      if (res.status === 404) {
        setPhase("invalid");
        return;
      }
      if (!res.ok) {
        setPhase("error");
        return;
      }
      const { huntId: hid } = await res.json();
      setHuntId(hid);

      // If already logged in, redirect straight to the hunt page
      const token = getStoredToken();
      if (token) {
        router.replace(`/hunt/${hid}`);
        setPhase("redirect");
      } else {
        setPhase("redirect"); // show the "open on your device" UI
      }
    } catch {
      setPhase("error");
    }
  }

  const huntUrl = huntId ? `os.campfire.hk/hunt/${huntId}` : null;

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
          <Box colour="zinc">
            <p className="text-zinc-400 text-sm text-center animate-pulse">Checking code…</p>
          </Box>
        )}

        {phase === "redirect" && huntId && !getStoredToken() && (
          <Box colour="orange">
            <p className="text-orange-400 font-bold text-sm tracking-wider mb-1">
              YOU FOUND IT!
            </p>
            <p className="text-orange-300/80 text-xs leading-relaxed mb-3">
              You're not logged in on this device. To claim your XP, open this link on
              the device where you're logged into Campfire OS:
            </p>
            <div className="bg-black/40 border border-orange-700 px-3 py-3 text-center">
              <span className="text-orange-300 font-bold text-sm break-all">{huntUrl}</span>
            </div>
            <p className="text-zinc-500 text-xs mt-3 text-center">
              Or scan the original QR code again on your own phone.
            </p>
          </Box>
        )}

        {phase === "redirect" && huntId && getStoredToken() && (
          <Box colour="zinc">
            <p className="text-zinc-400 text-sm text-center animate-pulse">Redirecting…</p>
          </Box>
        )}

        {phase === "invalid" && (
          <Box colour="red">
            <p className="text-red-400 font-bold text-sm tracking-wider mb-1">
              INVALID CODE
            </p>
            <p className="text-red-300/80 text-xs leading-relaxed">
              This code isn't recognised. Make sure you scanned the right QR code.
            </p>
          </Box>
        )}

        {phase === "error" && (
          <Box colour="red">
            <p className="text-red-400 font-bold text-sm tracking-wider mb-1">ERROR</p>
            <p className="text-red-300/80 text-xs leading-relaxed">
              Something went wrong. Try again.
            </p>
          </Box>
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

function getStoredToken(): string | null {
  try {
    const raw = localStorage.getItem("campfire-os-auth");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state?.token ?? null;
  } catch {
    return null;
  }
}

function Box({
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

  return <div className={`border px-4 py-4 ${border}`}>{children}</div>;
}
