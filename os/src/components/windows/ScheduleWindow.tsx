"use client";

import { useState } from "react";

// ============================================================
// Schedule data
// ============================================================

const SCHEDULE = [
  {
    day: "Day 1",
    date: "Sat 28 Feb",
    events: [
      { time: "09:00", label: "Doors Open", type: "milestone" },
      { time: "10:00", label: "Opening Ceremony", type: "milestone" },
      { time: "10:15", label: "Opening Slides + Introduction", type: "talk" },
      { time: "10:30", label: "Sponsor Speech", type: "talk" },
      { time: "11:00", label: "Event Begins", type: "milestone" },
      { time: "11:30", label: "Workshop 1: Godot 101", type: "workshop" },
      { time: "12:30", label: "Lunch", type: "break" },
      { time: "13:30", label: "Lolo — Music in Games", type: "talk" },
      { time: "15:00", label: "Demo 1 — Concept Showcase", type: "demo" },
      { time: "18:30", label: "Light Dinner", type: "break" },
      { time: "19:00", label: "Day 1 Ends", type: "milestone" },
    ],
  },
  {
    day: "Day 2",
    date: "Sun 1 Mar",
    events: [
      { time: "09:00", label: "Doors Open", type: "milestone" },
      { time: "10:00", label: "BSD Workshop", type: "workshop" },
      { time: "11:30", label: "Demo 2 — Test Run of Games", type: "demo" },
      { time: "12:30", label: "Lunch", type: "break" },
      { time: "15:00", label: "Submission Deadline", type: "milestone" },
      { time: "15:15", label: "Showcase + Presentation", type: "demo" },
      { time: "16:15", label: "Voting + Decide Awards", type: "activity" },
      { time: "17:00", label: "Closing Ceremony", type: "milestone" },
      { time: "18:00", label: "Day 2 Ends", type: "milestone" },
    ],
  },
] as const;

type EventType = "milestone" | "workshop" | "talk" | "demo" | "break" | "staff" | "activity";

const TYPE_COLOR: Record<EventType, { dot: string; label: string }> = {
  milestone: { dot: "rgb(250, 204, 21)",  label: "rgb(250, 204, 21)" },
  workshop:  { dot: "rgb(251, 146, 60)",  label: "rgb(251, 146, 60)" },
  talk:      { dot: "rgb(129, 140, 248)", label: "rgb(129, 140, 248)" },
  demo:      { dot: "rgb(52, 211, 153)",  label: "rgb(52, 211, 153)" },
  break:     { dot: "rgb(113, 113, 122)", label: "rgb(161, 161, 170)" },
  staff:     { dot: "rgb(63, 63, 70)",    label: "rgb(82, 82, 91)" },
  activity:  { dot: "rgb(232, 121, 249)", label: "rgb(232, 121, 249)" },
};

// ============================================================
// Tab switcher
// ============================================================

function TabSwitcher({
  active,
  onChange,
}: {
  active: 0 | 1;
  onChange: (i: 0 | 1) => void;
}) {
  return (
    <div
      className="flex mx-4 mb-3"
      style={{ background: "rgb(30, 30, 32)", border: "1px solid rgb(55, 55, 58)" }}
    >
      {SCHEDULE.map((s, i) => (
        <button
          key={i}
          onClick={() => onChange(i as 0 | 1)}
          className="flex-1 py-1.5 text-xs font-bold tracking-wider transition-colors"
          style={{
            background: active === i ? "rgb(80, 80, 85)" : "transparent",
            color: active === i ? "rgb(255, 255, 255)" : "rgb(113, 113, 122)",
            borderRight: i === 0 ? "1px solid rgb(55, 55, 58)" : "none",
            cursor: "pointer",
          }}
        >
          {s.day}
        </button>
      ))}
    </div>
  );
}

// ============================================================
// Schedule Window
// ============================================================

export default function ScheduleWindow() {
  const [activeDay, setActiveDay] = useState<0 | 1>(0);
  const schedule = SCHEDULE[activeDay];

  // Determine "current" event based on real time on event days
  const now = new Date();
  const eventDates = ["2026-02-28", "2026-03-01"];
  const todayStr = now.toISOString().slice(0, 10);
  const isEventDay = todayStr === eventDates[activeDay];
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const parseMinutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };

  // Find the active event index (last one whose time has passed)
  let activeIdx = -1;
  if (isEventDay) {
    schedule.events.forEach((e, i) => {
      if (parseMinutes(e.time) <= nowMinutes) activeIdx = i;
    });
  }

  return (
    <div className="h-full bg-zinc-900 font-mono flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-4 pt-3 pb-0 flex-shrink-0">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-xs text-zinc-500 font-bold tracking-widest">SCHEDULE</h2>
          <span className="text-xs text-zinc-600">{schedule.date}</span>
        </div>
        <TabSwitcher active={activeDay} onChange={setActiveDay} />
      </div>

      {/* Event list */}
      <div className="flex-1 overflow-auto">
        {schedule.events.map((event, idx) => {
          const colors = TYPE_COLOR[event.type as EventType];
          const isCurrent = idx === activeIdx;
          const isPast = isEventDay && idx < activeIdx;

          return (
            <div
              key={idx}
              className="flex items-center gap-3 px-4 border-b"
              style={{
                height: "34px",
                borderColor: "rgb(39, 39, 42)",
                background: isCurrent ? "rgba(250, 204, 21, 0.07)" : "transparent",
                opacity: isPast ? 0.4 : 1,
              }}
            >
              {/* Time */}
              <span
                className="text-xs flex-shrink-0 w-10 tabular-nums"
                style={{ color: isCurrent ? "rgb(250, 204, 21)" : "rgb(82, 82, 91)" }}
              >
                {event.time}
              </span>

              {/* Dot */}
              <span
                className="w-1.5 h-1.5 flex-shrink-0"
                style={{ background: isCurrent ? "rgb(250, 204, 21)" : colors.dot }}
              />

              {/* Label */}
              <span
                className="text-xs flex-1 truncate"
                style={{ color: isCurrent ? "rgb(255, 255, 255)" : colors.label }}
              >
                {event.label}
              </span>

              {/* "NOW" badge */}
              {isCurrent && (
                <span
                  className="text-[9px] font-bold tracking-widest flex-shrink-0 px-1.5 py-0.5"
                  style={{
                    background: "rgb(250, 204, 21)",
                    color: "rgb(0, 0, 0)",
                  }}
                >
                  NOW
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="border-t border-zinc-800 px-4 py-2 flex gap-3 flex-wrap flex-shrink-0">
        {(Object.entries(TYPE_COLOR) as [EventType, { dot: string; label: string }][])
          .filter(([t]) => t !== "staff")
          .map(([type, colors]) => (
            <span key={type} className="flex items-center gap-1">
              <span className="w-1.5 h-1.5" style={{ background: colors.dot }} />
              <span className="text-[10px] capitalize" style={{ color: "rgb(82, 82, 91)" }}>
                {type}
              </span>
            </span>
          ))}
      </div>
    </div>
  );
}
