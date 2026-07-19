import { useEffect, useMemo, useState } from "react";

interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isComplete: boolean;
}

function getCountdown(targetIso: string): Countdown {
  const target = new Date(targetIso).getTime();
  const diffMs = target - Date.now();

  if (diffMs <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isComplete: true };
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { days, hours, minutes, seconds, isComplete: false };
}

export function useEventCountdown(targetIso: string | null | undefined) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!targetIso) return;
    const timer = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [targetIso]);

  return useMemo(() => {
    void tick;
    if (!targetIso) {
      return null;
    }
    return getCountdown(targetIso);
  }, [targetIso, tick]);
}

