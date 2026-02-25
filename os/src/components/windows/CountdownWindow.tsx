"use client";

import { useEffect, useState } from "react";
import NumberFlow, { NumberFlowGroup } from "@number-flow/react";

// Deadline: 1 March 2026 15:00 HKT (UTC+8)
const DEADLINE = new Date("2026-03-01T15:00:00+08:00").getTime();
// Jam start: 28 Feb 2026 10:45 HKT (UTC+8)
const START = new Date("2026-02-28T10:45:00+08:00").getTime();

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

function getTimeLeft(): TimeLeft {
  const total = Math.max(0, DEADLINE - Date.now());
  const seconds = Math.floor((total / 1000) % 60);
  const minutes = Math.floor((total / 1000 / 60) % 60);
  const hours = Math.floor((total / 1000 / 60 / 60) % 24);
  const days = Math.floor(total / 1000 / 60 / 60 / 24);
  return { days, hours, minutes, seconds, total };
}

export default function CountdownWindow() {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(getTimeLeft);

  useEffect(() => {
    if (timeLeft.total === 0) return;
    const id = setInterval(() => setTimeLeft(getTimeLeft()), 1000);
    return () => clearInterval(id);
  }, [timeLeft.total]);

  const isDone = timeLeft.total === 0;

  return (
    <div className="h-full bg-zinc-900 font-mono flex flex-col items-center justify-center gap-6 p-6">
      <div className="text-center">
        <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">
          Countdown to
        </p>
        <h2 className="text-sm text-zinc-200 font-bold tracking-wider">
          DEADLINE
        </h2>
        <p className="text-[10px] text-zinc-600 mt-1">
          1 Mar 2026 · 15:00 HKT
        </p>
      </div>

      {isDone ? (
        <div className="text-center">
          <p className="text-2xl font-bold text-orange-400 tracking-widest animate-pulse">
            TIME&apos;S UP
          </p>
          <p className="text-xs text-zinc-500 mt-2">Submissions are closed.</p>
        </div>
      ) : (
        <NumberFlowGroup>
          <div
            style={{ fontVariantNumeric: "tabular-nums" }}
            className="flex items-start gap-3"
          >
            {/* Days */}
            <div className="flex flex-col items-center gap-1">
              <div
                className="bg-zinc-800 border border-zinc-700 px-4 py-3 min-w-[64px] text-center"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                <span className="text-3xl font-mono font-bold text-orange-400 tracking-widest">
                  <NumberFlow
                    trend={-1}
                    value={timeLeft.days}
                    format={{ minimumIntegerDigits: 2 }}
                  />
                </span>
              </div>
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                days
              </span>
            </div>

            <span className="text-2xl font-bold text-zinc-600 mt-3">:</span>

            {/* Hours */}
            <div className="flex flex-col items-center gap-1">
              <div
                className="bg-zinc-800 border border-zinc-700 px-4 py-3 min-w-[64px] text-center"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                <span className="text-3xl font-mono font-bold text-orange-400 tracking-widest">
                  <NumberFlow
                    trend={-1}
                    value={timeLeft.hours}
                    format={{ minimumIntegerDigits: 2 }}
                    digits={{ 1: { max: 9 } }}
                  />
                </span>
              </div>
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                hours
              </span>
            </div>

            <span className="text-2xl font-bold text-zinc-600 mt-3">:</span>

            {/* Minutes */}
            <div className="flex flex-col items-center gap-1">
              <div
                className="bg-zinc-800 border border-zinc-700 px-4 py-3 min-w-[64px] text-center"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                <span className="text-3xl font-mono font-bold text-orange-400 tracking-widest">
                  <NumberFlow
                    trend={-1}
                    value={timeLeft.minutes}
                    format={{ minimumIntegerDigits: 2 }}
                    digits={{ 1: { max: 5 } }}
                  />
                </span>
              </div>
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                min
              </span>
            </div>

            <span className="text-2xl font-bold text-zinc-600 mt-3">:</span>

            {/* Seconds */}
            <div className="flex flex-col items-center gap-1">
              <div
                className="bg-zinc-800 border border-zinc-700 px-4 py-3 min-w-[64px] text-center"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                <span className="text-3xl font-mono font-bold text-orange-400 tracking-widest">
                  <NumberFlow
                    trend={-1}
                    value={timeLeft.seconds}
                    format={{ minimumIntegerDigits: 2 }}
                    digits={{ 1: { max: 5 } }}
                  />
                </span>
              </div>
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                sec
              </span>
            </div>
          </div>
        </NumberFlowGroup>
      )}

      <div className="w-full max-w-xs mt-2">
        <div className="h-1 bg-zinc-800 w-full">
          <div
            className="h-1 bg-orange-500 transition-all duration-1000"
            style={{
              width: `${Math.max(
                0,
                Math.min(100, (1 - timeLeft.total / (DEADLINE - START)) * 100)
              )}%`,
            }}
          />
        </div>
        <p className="text-[10px] text-zinc-700 mt-1 text-right">
          progress to deadline
        </p>
      </div>
    </div>
  );
}
