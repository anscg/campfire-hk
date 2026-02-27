"use client";

import { useState } from "react";
import { useAuthStore } from "@/stores/authStore";

// ============================================================
// Settings Window - User preferences
// ============================================================

export default function SettingsWindow() {
  const { user, logout } = useAuthStore();
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [saved, setSaved] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const handleSave = () => {
    // In a full implementation, this would call the API
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="h-full bg-zinc-900 p-4 font-mono overflow-auto">
      <h2 className="text-sm text-zinc-300 font-bold mb-4">SETTINGS</h2>

      <div className="space-y-4 max-w-sm">
        {/* Display Name */}
        <div>
          <label className="block text-[10px] text-zinc-500 uppercase mb-1">
            Display Name
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 px-3 py-2
              text-white text-sm focus:outline-none focus:border-orange-500 transition-colors"
          />
        </div>

        {/* Email (readonly) */}
        <div>
          <label className="block text-[10px] text-zinc-500 uppercase mb-1">
            Email
          </label>
          <input
            type="email"
            value={user?.email || ""}
            readOnly
            className="w-full bg-zinc-800/50 border border-zinc-700/50 px-3 py-2
              text-zinc-500 text-sm cursor-not-allowed"
          />
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-2
            transition-colors text-sm tracking-wider"
        >
          {saved ? "SAVED!" : "SAVE SETTINGS"}
        </button>

        {/* Danger Zone */}
        <div className="mt-8 pt-4 border-t border-zinc-800">
          <h3 className="text-[10px] text-red-400 uppercase mb-2">
            DANGER ZONE
          </h3>
          {confirmLogout ? (
            <div className="border border-red-800 bg-red-900/20 p-3 space-y-2">
              <p className="text-red-400 text-xs">Are you sure you want to log out?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => { logout(); setConfirmLogout(false); }}
                  className="flex-1 bg-red-900/50 hover:bg-red-900 border border-red-800
                    text-red-300 font-bold py-1.5 transition-colors text-xs tracking-wider"
                >
                  YES, LOG OUT
                </button>
                <button
                  onClick={() => setConfirmLogout(false)}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700
                    text-zinc-400 font-bold py-1.5 transition-colors text-xs tracking-wider"
                >
                  CANCEL
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmLogout(true)}
              className="w-full bg-zinc-800 hover:bg-red-900/30 border border-zinc-700 hover:border-red-800
                text-zinc-400 hover:text-red-400 font-bold py-2 transition-colors text-sm"
            >
              LOG OUT
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
