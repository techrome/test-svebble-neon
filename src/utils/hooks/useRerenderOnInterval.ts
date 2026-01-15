import React from "react";

type Store = {
  subscribers: Set<() => void>;
  tick: boolean;
  intervalId: ReturnType<typeof setInterval> | null;
};

const stores: Record<string, Store> = {};

const getStore = (intervalMs: number): Store => {
  let store = stores[intervalMs];
  if (!store) {
    store = { subscribers: new Set(), tick: false, intervalId: null };
    stores[intervalMs] = store;
  }
  return store;
};

const startInterval = (store: Store, intervalMs: number) => {
  if (store.intervalId !== null) return;

  store.intervalId = setInterval(() => {
    store.tick = !store.tick;
    store.subscribers.forEach((onStoreChange) => onStoreChange());
  }, intervalMs);
};

const stopInterval = (store: Store) => {
  if (store.intervalId === null) return;
  clearInterval(store.intervalId);
  store.intervalId = null;
};

export const useRerenderOnInterval = (
  intervalMs: number,
  disabled?: boolean
) => {
  const store = getStore(intervalMs);

  const subscribe = React.useCallback(
    (onStoreChange: () => void) => {
      if (disabled) return () => {};

      store.subscribers.add(onStoreChange);
      startInterval(store, intervalMs);

      return () => {
        store.subscribers.delete(onStoreChange);
        if (store.subscribers.size < 1) stopInterval(store);
      };
    },
    [store, intervalMs, disabled]
  );

  const getSnapshot = React.useCallback(
    () => (disabled ? false : store.tick),
    [store, disabled]
  );

  // using React.useSyncExternalStore so that many subscribing components could read the same value
  // and re-render at the same time without creating hook timer for each of them
  return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};
