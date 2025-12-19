import React from "react";

const INTERVAL_MS = 30_000;

let subscribers = new Set<() => void>();
let tick = false;
let intervalId: ReturnType<typeof setInterval> | null = null;

const startInterval = () => {
  if (intervalId !== null) {
    return;
  }

  intervalId = setInterval(() => {
    tick = !tick;
    subscribers.forEach((fn) => fn());
  }, INTERVAL_MS);
};

const stopInterval = () => {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
};

const subscribe = (onStoreChange: () => void) => {
  subscribers.add(onStoreChange);
  startInterval();

  return () => {
    subscribers.delete(onStoreChange);
    if (subscribers.size < 1) {
      stopInterval();
    }
  };
};

const getSnapshot = () => tick;

// using React.useSyncExternalStore so that many subscribing components could read the same value
// and re-render at the same time without creating hook timer for each of them
export const useRerenderOnInterval = () => {
  return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};
