"use client";

import { useAuthStore } from "@/stores/authStore";

// ============================================================
// Profile Window - Shows user info and XP
// ============================================================

export default function ProfileWindow() {
  const { user } = useAuthStore();

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full bg-zinc-900 text-zinc-500 font-mono text-sm">
        Not logged in
      </div>
    );
  }

  return (
    <div className="h-full bg-zinc-900 p-4 font-mono overflow-auto">
      {/* Name and Email */}
      <div className="flex flex-col items-center mb-6">
        <h2 className="text-lg text-white font-bold">{user.displayName}</h2>
        <p className="text-xs text-zinc-500">{user.email}</p>
      </div>

      {/* Stats */}
      <div className="space-y-4">
        {/* XP */}
        <div className="bg-zinc-800 p-4">
          <div className="flex justify-between items-center">
            <span className="text-xs text-zinc-400 tracking-widest">TOTAL XP</span>
            <span className="text-2xl text-yellow-400 font-bold">{user.xp}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
