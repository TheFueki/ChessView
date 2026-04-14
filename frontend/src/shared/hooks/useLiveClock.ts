import { useEffect, useMemo, useState } from "react";
import type { ClockState } from "@/shared/types";

function computeClock(clock: ClockState | null, now: number) {
  if (!clock) {
    return { whiteTimeMs: 0, blackTimeMs: 0, graceRemainingMs: null as number | null };
  }

  const lastUpdatedAt = new Date(clock.last_updated_at).getTime();
  const elapsedMs = Math.max(0, now - lastUpdatedAt);
  let whiteTimeMs = clock.white_time_ms;
  let blackTimeMs = clock.black_time_ms;

  if (!clock.is_paused && clock.active_color === "white") {
    whiteTimeMs = Math.max(0, whiteTimeMs - elapsedMs);
  }
  if (!clock.is_paused && clock.active_color === "black") {
    blackTimeMs = Math.max(0, blackTimeMs - elapsedMs);
  }

  const graceRemainingMs = clock.grace_deadline_at
    ? Math.max(0, new Date(clock.grace_deadline_at).getTime() - now)
    : null;

  return { whiteTimeMs, blackTimeMs, graceRemainingMs };
}

export function useLiveClock(clock: ClockState | null) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!clock || (clock.is_paused && !clock.grace_deadline_at)) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 250);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [clock]);

  return useMemo(() => computeClock(clock, now), [clock, now]);
}
