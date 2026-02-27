"use client";

import { useState, useRef, useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";
import { ApiError } from "@/lib/api";
import Image from "next/image";

// ============================================================
// Login Screen - Email + OTP flow
// ============================================================

export default function LoginScreen() {
  const { login, verifyOTP, otpSent, pendingEmail, isLoading, error, clearError } =
    useAuthStore();
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState(["", "", "", "", "", ""]);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  // Track whether the error is a "not on the list" rejection
  const [notRegistered, setNotRegistered] = useState(false);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setNotRegistered(false);
    try {
      await login(email.trim());
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 403) {
        setNotRegistered(true);
      }
    }
  };

  const handleOTPChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newCode = [...otpCode];
    newCode[index] = value.slice(-1);
    setOtpCode(newCode);

    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }

    const fullCode = newCode.join("");
    if (fullCode.length === 6 && pendingEmail) {
      verifyOTP(pendingEmail, fullCode);
    }
  };

  const handleOTPKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otpCode[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOTPPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 0) return;

    const newCode = [...otpCode];
    for (let i = 0; i < pasted.length && i < 6; i++) {
      newCode[i] = pasted[i];
    }
    setOtpCode(newCode);

    const nextEmpty = pasted.length < 6 ? pasted.length : 5;
    otpRefs.current[nextEmpty]?.focus();

    if (pasted.length === 6 && pendingEmail) {
      verifyOTP(pendingEmail, pasted);
    }
  };

  useEffect(() => {
    clearError();
    setNotRegistered(false);
  }, [email, clearError]);

  // Detect 403 from the store error as well (login() swallows the throw)
  useEffect(() => {
    if (error && error.includes("participant list")) {
      setNotRegistered(true);
    }
  }, [error]);

  return (
    <div
      className="min-h-screen bg-black flex flex-col items-center justify-center p-4 gap-6"
      style={{ fontFamily: "var(--font-pixelify), sans-serif" }}
    >
      {/* Logo with light sweep */}
      <LogoSweep />

      {/* Login area */}
      <div className="w-full max-w-sm">
        {!otpSent ? (
          <form onSubmit={handleEmailSubmit} className="flex items-center gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="flex-1 bg-zinc-900 border border-zinc-700 px-3 py-2 text-white
                placeholder-zinc-600 focus:outline-none focus:border-orange-500
                text-sm transition-colors [font-family:inherit]"
              autoFocus
              autoComplete="email"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !email.trim()}
              className="bg-orange-600 hover:bg-orange-500 disabled:bg-zinc-800
                disabled:text-zinc-600 text-white font-bold px-4 py-2 transition-colors
                text-sm tracking-wider whitespace-nowrap [font-family:inherit]"
            >
              {isLoading ? "..." : "LOGIN"}
            </button>
          </form>
        ) : (
          <div>
            <p className="text-zinc-500 text-xs mb-3 text-center">
              Enter the code sent to {pendingEmail}
            </p>
            <div className="flex gap-2 justify-center mb-3" onPaste={handleOTPPaste}>
              {otpCode.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { otpRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOTPChange(i, e.target.value)}
                  onKeyDown={(e) => handleOTPKeyDown(i, e)}
                  className="w-11 bg-zinc-900 border border-zinc-700 text-center
                    text-white text-xl focus:outline-none focus:border-orange-500
                    transition-colors py-2 [font-family:inherit]"
                  autoFocus={i === 0}
                  disabled={isLoading}
                />
              ))}
            </div>
            <button
              onClick={() => {
                setOtpCode(["", "", "", "", "", ""]);
                useAuthStore.setState({ otpSent: false, pendingEmail: null, error: null });
              }}
              className="w-full text-zinc-600 hover:text-zinc-400 text-xs py-1 transition-colors [font-family:inherit]"
            >
              ← back
            </button>
          </div>
        )}

        {/* Not-registered error — distinct styling */}
        {notRegistered && error && (
          <div className="mt-3 border border-orange-800 px-3 py-3 bg-orange-900/20 space-y-1">
            <p className="text-orange-400 text-xs font-bold tracking-wider">NOT ON THE LIST</p>
            <p className="text-orange-300/80 text-xs leading-relaxed">{error}</p>
          </div>
        )}

        {/* Generic error */}
        {error && !notRegistered && (
          <div className="mt-3 border border-red-800 px-3 py-2 bg-red-900/20">
            <p className="text-red-400 text-xs">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Logo with repeating light sweep every 5s ─────────────────

function LogoSweep() {
  return (
    <div className="relative select-none" style={{ width: 560, height: 240 }}>
      {/* Base logo */}
      <Image
        src="/logo.png"
        alt="Campfire OS"
        fill
        style={{ objectFit: "contain" }}
        priority
        draggable={false}
      />
      {/* Sweep layer — masked to logo alpha so shine only hits logo pixels */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          maskImage: "url(/logo.png)",
          WebkitMaskImage: "url(/logo.png)",
          maskSize: "contain",
          WebkitMaskSize: "contain",
          maskRepeat: "no-repeat",
          WebkitMaskRepeat: "no-repeat",
          maskPosition: "center",
          WebkitMaskPosition: "center",
          overflow: "hidden",
        }}
      >
        <div className="logo-sweep" />
      </div>

      <style>{`
        .logo-sweep {
          position: absolute;
          top: -20%;
          left: -60%;
          width: 35%;
          height: 140%;
          background: linear-gradient(
            105deg,
            transparent 20%,
            rgba(255,255,255,0.7) 50%,
            transparent 80%
          );
          animation: logo-sweep 5s ease-in-out infinite;
        }
        @keyframes logo-sweep {
          0%   { left: -60%; }
          30%  { left: 130%; }
          100% { left: 130%; }
        }
      `}</style>
    </div>
  );
}
