import { useSyncExternalStore } from "react";

let unread = 0;
const listeners = new Set<() => void>();

export function setUnreadCount(count: number) {
  unread = count;
  for (const listener of listeners) listener();
}

export function useUnreadCount() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => unread,
    () => 0,
  );
}
