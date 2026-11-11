import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { LoginCard } from "@/components/login-card";
import { AppHeader } from "@/components/app-header";
import { setUnreadCount } from "@/lib/alerts-store";
import { getMe, type Profile } from "@/lib/meetings.functions";
import { listNotifications, markNotificationRead, type AppNotification } from "@/lib/notify.functions";

export const Route = createFileRoute("/notifications")({ component: NotificationsPage });

function NotificationsPage() {
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [error, setError] = useState("");
  const [permission, setPermission] = useState<NotificationPermission | "off">("off");
  const userId = user?.id;

  function apply(next: AppNotification[]) {
    setItems(next);
    setUnreadCount(next.filter((item) => !item.read).length);
  }

  useEffect(() => {
    if (typeof Notification !== "undefined") setPermission(Notification.permission);
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    getMe()
      .then((result) => {
        if (!cancelled) setProfile(result.profile);
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    listNotifications()
      .then((next) => {
        if (!cancelled) apply(next);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load alerts.");
      });
    return () => {
      cancelled = true;
    };
  }, [profile]);

  if (isPending || (user && profile === undefined)) {
    return (
      <main className="grid min-h-screen place-items-center">
        <p className="text-muted">Opening alerts…</p>
      </main>
    );
  }
  if (!user) return <LoginCard />;
  if (!profile) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <p className="text-fg">Choose a first name on the meetings page first.</p>
      </main>
    );
  }

  const unread = items?.filter((item) => !item.read).length ?? 0;

  return (
    <div className="min-h-screen">
      <AppHeader profile={profile} />
      <main className="mx-auto max-w-xl px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-4xl text-fg">Alerts</h1>
            <p className="mt-2 text-muted">Meetings you signed up for, and a daily reminder to stay clean.</p>
          </div>
          {unread > 0 && (
            <button
              type="button"
              onClick={() => {
                void markNotificationRead({ data: {} }).then(() => listNotifications().then(apply));
              }}
              className="h-11 rounded-lg border border-border px-4 text-sm font-semibold text-fg"
            >
              Mark all read
            </button>
          )}
        </div>

        {permission !== "granted" && permission !== "denied" && typeof Notification !== "undefined" && (
          <button
            type="button"
            onClick={() => {
              void Notification.requestPermission().then((next) => setPermission(next));
            }}
            className="mt-6 h-11 rounded-lg bg-primary px-4 font-semibold text-primary-fg"
          >
            Also alert this browser
          </button>
        )}
        {permission === "granted" && <p className="mt-4 text-sm text-muted">This browser will alert you when the tab is in the background.</p>}
        {permission === "denied" && <p className="mt-4 text-sm text-muted">Browser alerts are blocked. These stay in the list.</p>}
        {error && <p className="mt-4 text-sm text-danger">{error}</p>}

        <ul className="mt-6 space-y-3">
          {items === null && !error && <li className="text-muted">Loading…</li>}
          {items?.length === 0 && <li className="text-sm text-muted">Nothing yet. Sign up for a meeting and you’ll be reminded here.</li>}
          {items?.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => {
                  void markNotificationRead({ data: { id: item.id } }).then(() => {
                    if (item.href.startsWith("/room/")) {
                      return navigate({ to: "/room/$meetingId", params: { meetingId: item.href.slice("/room/".length) } });
                    }
                    return navigate({ to: "/journal" });
                  });
                }}
                className={`w-full rounded-lg border px-4 py-3 text-left ${item.read ? "border-border bg-surface text-muted" : "border-primary bg-surface text-fg"}`}
              >
                <p className="font-semibold">{item.title}</p>
                <p className="mt-1 text-sm">{item.body}</p>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-sm text-muted">
          Signing up is on the <Link to="/" className="text-primary">meetings</Link> board. Clean reminders stop for the day once you mark your journal.
        </p>
      </main>
    </div>
  );
}
