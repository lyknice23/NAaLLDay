import { useEffect, useRef } from "react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { setUnreadCount } from "@/lib/alerts-store";
import { listNotifications, type AppNotification } from "@/lib/notify.functions";

export function AlertWatcher() {
  const { user } = useCurrentUserState();
  const userId = user?.id;
  const seen = useRef(new Set<string>());
  const ready = useRef(false);

  useEffect(() => {
    if (!userId) {
      setUnreadCount(0);
      return;
    }
    let stop = false;
    ready.current = false;
    seen.current = new Set();

    async function pull() {
      try {
        const items = await listNotifications();
        if (stop) return;
        setUnreadCount(items.filter((item) => !item.read).length);
        const fresh = items.filter((item) => !seen.current.has(item.id));
        for (const item of fresh) seen.current.add(item.id);
        if (!ready.current) {
          ready.current = true;
          return;
        }
        if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
        if (!document.hidden) return;
        for (const item of fresh.filter((entry) => !entry.read)) showBrowserAlert(item);
      } catch {
        /* next poll */
      }
    }

    void pull();
    const timer = window.setInterval(() => void pull(), 20000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [userId]);

  return null;
}

function showBrowserAlert(item: AppNotification) {
  const note = new Notification(item.title, { body: item.body });
  note.onclick = () => {
    window.focus();
    window.location.href = item.href;
  };
}
