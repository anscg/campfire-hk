// ============================================================
// Window Registry - Maps component names to React components
// Add new window types here to make them available in the OS
// ============================================================

import type { WindowConfig } from "@/types";
import type { ComponentType } from "react";

// Registry of window components - lazy loaded
const windowComponents: Record<string, () => Promise<{ default: ComponentType<any> }>> = {};
const resolvedComponents: Record<string, ComponentType<any>> = {};

export function registerWindow(
  name: string,
  loader: () => Promise<{ default: ComponentType<any> }>
) {
  windowComponents[name] = loader;
}

export async function getWindowComponent(
  name: string
): Promise<ComponentType<any> | null> {
  if (resolvedComponents[name]) return resolvedComponents[name];

  const loader = windowComponents[name];
  if (!loader) return null;

  const mod = await loader();
  resolvedComponents[name] = mod.default;
  return mod.default;
}

// Synchronous getter for already-resolved components
export function getResolvedComponent(
  name: string
): ComponentType<any> | null {
  return resolvedComponents[name] || null;
}

// ============================================================
// Pre-defined window configurations
// ============================================================

export const WINDOW_CONFIGS: Record<string, WindowConfig> = {
  profile: {
    id: "profile",
    title: "Profile",
    icon: "👤",
    component: "ProfileWindow",
    defaultSize: { width: 420, height: 480 },
    minSize: { width: 320, height: 400 },
    resizable: true,
    closable: true,
    maximizable: true,
  },
  shop: {
    id: "shop",
    title: "Shop",
    icon: "🛒",
    component: "ShopWindow",
    defaultSize: { width: 560, height: 520 },
    minSize: { width: 400, height: 400 },
    resizable: true,
    closable: true,
    maximizable: true,
  },
  terminal: {
    id: "terminal",
    title: "Terminal",
    icon: "💻",
    component: "TerminalWindow",
    defaultSize: { width: 600, height: 400 },
    minSize: { width: 400, height: 300 },
    resizable: true,
    closable: true,
    maximizable: true,
  },
  about: {
    id: "about",
    title: "campfire.hk",
    icon: "https://cdn.hackclub.com/019c8bb3-0d6b-7d37-93c2-b492a528f028/pxart.png",
    component: "AboutWindow",
    defaultSize: { width: 640, height: 480 },
    minSize: { width: 400, height: 300 },
    resizable: true,
    closable: true,
    maximizable: true,
  },
  settings: {
    id: "settings",
    title: "Settings",
    icon: "⚙️",
    component: "SettingsWindow",
    defaultSize: { width: 440, height: 480 },
    minSize: { width: 360, height: 400 },
    resizable: true,
    closable: true,
    maximizable: true,
  },
  countdown: {
    id: "countdown",
    title: "Countdown",
    icon: "⏳",
    component: "CountdownWindow",
    defaultSize: { width: 420, height: 300 },
    minSize: { width: 340, height: 260 },
    resizable: true,
    closable: true,
    maximizable: true,
  },
  leaderboard: {
    id: "leaderboard",
    title: "Leaderboard",
    icon: "🏆",
    component: "LeaderboardWindow",
    defaultSize: { width: 480, height: 400 },
    minSize: { width: 360, height: 300 },
    resizable: true,
    closable: true,
    maximizable: true,
  },
  groups: {
    id: "groups",
    title: "Groups",
    icon: "👥",
    component: "GroupsWindow",
    defaultSize: { width: 440, height: 480 },
    minSize: { width: 340, height: 380 },
    resizable: true,
    closable: true,
    maximizable: true,
  },
  schedule: {
    id: "schedule",
    title: "Schedule",
    icon: "📅",
    component: "ScheduleWindow",
    defaultSize: { width: 420, height: 500 },
    minSize: { width: 340, height: 380 },
    resizable: true,
    closable: true,
    maximizable: true,
  },
  camppay: {
    id: "camppay",
    title: "CampPay",
    icon: "💸",
    component: "CampPayWindow",
    defaultSize: { width: 400, height: 520 },
    minSize: { width: 320, height: 420 },
    resizable: true,
    closable: true,
    maximizable: true,
  },
  quests: {
    id: "quests",
    title: "Quests",
    icon: "📋",
    component: "QuestsWindow",
    defaultSize: { width: 440, height: 560 },
    minSize: { width: 340, height: 400 },
    resizable: true,
    closable: true,
    maximizable: true,
  },
  admin: {
    id: "admin",
    title: "Admin",
    icon: "🛡️",
    component: "AdminWindow",
    defaultSize: { width: 480, height: 580 },
    minSize: { width: 360, height: 440 },
    resizable: true,
    closable: true,
    maximizable: true,
  },
  receipts: {
    id: "receipts",
    title: "Receipts",
    icon: "🧾",
    component: "ReceiptsWindow",
    defaultSize: { width: 480, height: 520 },
    minSize: { width: 360, height: 380 },
    resizable: true,
    closable: true,
    maximizable: true,
  },
  shopcampfy: {
    id: "shopcampfy",
    title: "Shopcampfy",
    icon: "🏪",
    component: "ShopcampfyWindow",
    defaultSize: { width: 520, height: 580 },
    minSize: { width: 380, height: 440 },
    resizable: true,
    closable: true,
    maximizable: true,
  },
  music: {
    id: "music",
    title: "Music",
    icon: "🎵",
    component: "MusicWindow",
    defaultSize: { width: 480, height: 560 },
    minSize: { width: 360, height: 440 },
    resizable: true,
    closable: true,
    maximizable: true,
  },
  stocks: {
    id: "stocks",
    title: "Stocks",
    icon: "📈",
    component: "StocksWindow",
    defaultSize: { width: 520, height: 600 },
    minSize: { width: 400, height: 480 },
    resizable: true,
    closable: true,
    maximizable: true,
  },
};

// ============================================================
// Desktop icon definitions
// ============================================================

export const DESKTOP_ICONS = [
  { id: "profile", label: "Profile", icon: "👤", windowConfig: WINDOW_CONFIGS.profile },
  { id: "shop", label: "Shop", icon: "🛒", windowConfig: WINDOW_CONFIGS.shop },
  { id: "terminal", label: "Terminal", icon: "💻", windowConfig: WINDOW_CONFIGS.terminal },
  { id: "about", label: "campfire.hk", icon: "https://cdn.hackclub.com/019c8bb3-0d6b-7d37-93c2-b492a528f028/pxart.png", windowConfig: WINDOW_CONFIGS.about },
  { id: "countdown", label: "Countdown", icon: "⏳", windowConfig: WINDOW_CONFIGS.countdown },
  { id: "leaderboard", label: "Leaderboard", icon: "🏆", windowConfig: WINDOW_CONFIGS.leaderboard },
  { id: "groups", label: "Groups", icon: "👥", windowConfig: WINDOW_CONFIGS.groups },
  { id: "schedule", label: "Schedule", icon: "📅", windowConfig: WINDOW_CONFIGS.schedule },
  { id: "camppay", label: "CampPay", icon: "💸", windowConfig: WINDOW_CONFIGS.camppay },
  { id: "quests", label: "Quests", icon: "📋", windowConfig: WINDOW_CONFIGS.quests },
  { id: "admin", label: "Admin", icon: "🛡️", windowConfig: WINDOW_CONFIGS.admin, adminOnly: true },
  { id: "shopcampfy", label: "Shopcampfy", icon: "🏪", windowConfig: WINDOW_CONFIGS.shopcampfy, adminOnly: true },
  { id: "music", label: "Music", icon: "🎵", windowConfig: WINDOW_CONFIGS.music },
  { id: "stocks", label: "Stocks", icon: "📈", windowConfig: WINDOW_CONFIGS.stocks },
  { id: "receipts", label: "Receipts", icon: "🧾", windowConfig: WINDOW_CONFIGS.receipts },
  { id: "settings", label: "Settings", icon: "⚙️", windowConfig: WINDOW_CONFIGS.settings },
];

// ============================================================
// Register all built-in windows
// ============================================================

export function registerBuiltinWindows() {
  registerWindow("ProfileWindow", () => import("@/components/windows/ProfileWindow"));
  registerWindow("ShopWindow", () => import("@/components/windows/ShopWindow"));
  registerWindow("TerminalWindow", () => import("@/components/windows/TerminalWindow"));
  registerWindow("AboutWindow", () => import("@/components/windows/AboutWindow"));
  registerWindow("SettingsWindow", () => import("@/components/windows/SettingsWindow"));
  registerWindow("CountdownWindow", () => import("@/components/windows/CountdownWindow"));
  registerWindow("LeaderboardWindow", () => import("@/components/windows/LeaderboardWindow"));
  registerWindow("GroupsWindow", () => import("@/components/windows/GroupsWindow"));
  registerWindow("ScheduleWindow", () => import("@/components/windows/ScheduleWindow"));
  registerWindow("CampPayWindow", () => import("@/components/windows/CampPayWindow"));
  registerWindow("QuestsWindow", () => import("@/components/windows/QuestsWindow"));
  registerWindow("AdminWindow", () => import("@/components/windows/AdminWindow"));
  registerWindow("ReceiptsWindow", () => import("@/components/windows/ReceiptsWindow"));
  registerWindow("ShopcampfyWindow", () => import("@/components/windows/ShopcampfyWindow"));
  registerWindow("MusicWindow", () => import("@/components/windows/MusicWindow"));
  registerWindow("StocksWindow", () => import("@/components/windows/StocksWindow"));
}
