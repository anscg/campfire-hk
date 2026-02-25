"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useBootStore } from "@/stores/bootStore";
import LoginScreen from "@/components/auth/LoginScreen";
import BootSequence from "@/components/boot/BootSequence";
import Desktop from "@/components/desktop/Desktop";
import { apiClient } from "@/lib/api";

// ============================================================
// Campfire OS - Main Application Orchestrator
//
// Flow: Login -> Boot Sequence -> Desktop
// ============================================================

type AppPhase = "loading" | "login" | "boot" | "desktop";

// Extract ?pay= token from a hash like "#camppay?pay=TOKEN"
function extractPayToken(hash: string): string | null {
  const qIdx = hash.indexOf("?");
  if (qIdx === -1) return null;
  const params = new URLSearchParams(hash.slice(qIdx + 1));
  return params.get("pay");
}

export default function CampfireOS() {
  const { isAuthenticated, token, fetchUser } = useAuthStore();
  const { reset: resetBoot } = useBootStore();
  const [phase, setPhase] = useState<AppPhase>("loading");

  // Check existing session on mount
  useEffect(() => {
    // Stash any incoming pay token BEFORE any phase transitions wipe the hash
    if (typeof window !== "undefined") {
      const payToken = extractPayToken(window.location.hash);
      if (payToken) {
        sessionStorage.setItem("camppay_incoming_token", payToken);
      }
    }

    if (token) {
      apiClient.setToken(token);
      fetchUser().then(() => {
        const auth = useAuthStore.getState();
        if (auth.isAuthenticated) {
          // Skip boot if arriving via QR pay link
          const hasPayToken = !!sessionStorage.getItem("camppay_incoming_token");
          setPhase(hasPayToken ? "desktop" : "boot");
        } else {
          setPhase("login");
        }
      });
    } else {
      setPhase("login");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // When user is null but we are authenticated (e.g. server was restarting),
  // keep retrying fetchUser every 3s until the user object is populated.
  const { user } = useAuthStore();
  useEffect(() => {
    if (!isAuthenticated || user) return;
    const iv = setInterval(() => {
      fetchUser();
    }, 3000);
    return () => clearInterval(iv);
  }, [isAuthenticated, user, fetchUser]);

  // Watch for authentication changes
  useEffect(() => {
    if (isAuthenticated && phase === "login") {
      resetBoot();
      // Skip boot if arriving via QR pay link
      const hasPayToken = !!sessionStorage.getItem("camppay_incoming_token");
      setPhase(hasPayToken ? "desktop" : "boot");
    } else if (!isAuthenticated && phase !== "loading") {
      setPhase("login");
    }
  }, [isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBootComplete = useCallback(() => {
    setPhase("desktop");
  }, []);

  // Render phase
  switch (phase) {
    case "loading":
      return (
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="text-zinc-600 font-mono text-sm animate-pulse">
            CAMPFIRE OS
          </div>
        </div>
      );
    case "login":
      return <LoginScreen />;
    case "boot":
      return <BootSequence onComplete={handleBootComplete} />;
    case "desktop":
      return <Desktop />;
  }
}
