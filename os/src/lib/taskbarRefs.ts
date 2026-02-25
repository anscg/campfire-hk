// Shared module-level map so Taskbar can write button rects
// and WindowManager can read them for minimize/unminimize animation targets.

export const taskbarButtonRects = new Map<string, DOMRect>();
