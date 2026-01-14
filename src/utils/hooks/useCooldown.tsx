import React from "react";
import { useRerenderOnInterval } from "./useRerenderOnInterval";

export const useCooldown = (cooldownMs: number, tickMs = 1000) => {
  const [endTime, setEndTime] = React.useState<number | null>(null);
  useRerenderOnInterval(tickMs, !endTime);

  // eslint-disable-next-line
  const now = Date.now();
  const remainingMs = endTime ? Math.max(0, endTime - now) : 0;

  const isCoolingDown = remainingMs > 0;
  const remainingSeconds = Math.ceil(remainingMs / 1000);

  const percent = (1 - remainingMs / cooldownMs) * 100;
  const progress = endTime ? Math.max(0, Math.min(100, percent)) : 0;

  const start = React.useCallback(() => {
    setEndTime(Date.now() + cooldownMs);
  }, [cooldownMs]);

  const reset = React.useCallback(() => setEndTime(null), []);

  React.useEffect(() => {
    if (!isCoolingDown) {
      reset();
    }
    // eslint-disable-next-line
  }, [isCoolingDown]);

  return {
    isCoolingDown,
    remainingMs,
    remainingSeconds,
    progress,
    start,
    reset,
  };
};
