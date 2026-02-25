// ============================================================
// Campfire OS - Core Type Definitions
// ============================================================

// --- Auth ---
export interface User {
  _id: string;
  email: string;
  displayName: string;
  xp: number;
  isAdmin?: boolean;
  createdAt: number;
  lastLogin: number;
}

export interface OTPRequest {
  email: string;
}

export interface OTPVerify {
  email: string;
  code: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string) => Promise<void>;
  verifyOTP: (email: string, code: string) => Promise<boolean>;
  logout: () => void;
  setUser: (user: User) => void;
}

// --- Window System ---
export interface WindowPosition {
  x: number;
  y: number;
}

export interface WindowSize {
  width: number;
  height: number;
}

export interface WindowConfig {
  id: string;
  title: string;
  icon: string; // emoji or URL
  component: string;
  defaultSize: WindowSize;
  minSize: WindowSize;
  resizable: boolean;
  closable: boolean;
  maximizable: boolean;
}

export type WindowAnimState = "opening" | "closing" | "minimizing" | "unminimizing" | null;

export interface WindowInstance {
  id: string;
  configId: string;
  title: string;
  icon: string;
  component: string;
  position: WindowPosition;
  size: WindowSize;
  minSize: WindowSize;
  isMaximized: boolean;
  isMinimized: boolean;
  zIndex: number;
  resizable: boolean;
  closable: boolean;
  maximizable: boolean;
  preMaximizeState?: { position: WindowPosition; size: WindowSize };
  animState: WindowAnimState;
}

export interface WindowManagerState {
  windows: WindowInstance[];
  activeWindowId: string | null;
  nextZIndex: number;
  isMobile: boolean;
  openWindow: (config: WindowConfig) => void;
  closeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  maximizeWindow: (id: string) => void;
  restoreWindow: (id: string) => void;
  updatePosition: (id: string, position: WindowPosition) => void;
  updateSize: (id: string, size: WindowSize) => void;
  setMobile: (isMobile: boolean) => void;
}

// --- Desktop ---
export interface DesktopIcon {
  id: string;
  label: string;
  icon: string;
  windowConfig: WindowConfig;
  adminOnly?: boolean;
}

export interface TaskbarItem {
  windowId: string;
  title: string;
  icon: string;
  isActive: boolean;
  isMinimized: boolean;
}

// --- XP / Shop ---
export interface ShopItem {
  _id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  icon: string;
  available: boolean;
}

export interface Transaction {
  _id: string;
  userId: string;
  type: "purchase" | "earn" | "refund";
  amount: number;
  itemId?: string;
  description: string;
  createdAt: number;
}

export interface XPEvent {
  _id: string;
  userId: string;
  amount: number;
  reason: string;
  createdAt: number;
}

// --- Boot Sequence ---
export type BootPhase =
  | "init"
  | "loading"
  | "connecting"
  | "ready"
  | "complete";

export interface BootState {
  phase: BootPhase;
  progress: number;
  messages: string[];
  setPhase: (phase: BootPhase) => void;
  addMessage: (message: string) => void;
  setProgress: (progress: number) => void;
  reset: () => void;
}
