import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppHeader } from "@/components/app-header";
import { LoginCard } from "@/components/login-card";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cleanTimeLabel } from "@/lib/onboarding";
import { getMe, type Profile } from "@/lib/meetings.functions";
import { listCommunityCleanTimes, type CommunityCleanTime } from "@/lib/journal.functions";

export const Route = createFileRoute("/community")({ component: CommunityPage });

function CommunityPage() {
  const { user, isPending } = useCurrentUserState();
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [entries, setEntries] = useState<CommunityCleanTime[] | null>(null);
  const [error, setError] = useState("");
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    getMe()
      .then((result) => {
        if (!cancelled) setProfile(result.profile);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setProfile(null);
        setError(err instanceof Error ? err.message : "Could not open Community.");
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    setError("");
    listCommunityCleanTimes()
      .then((board) => {
        if (!cancelled) setEntries(board);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setEntries(null);
        setError(err instanceof Error ? err.message : "Could not load clean time.");
      });
    return () => {
      cancelled = true;
    };
  }, [profile]);

  if (isPending || (user && profile === undefined)) {
    return (
      <main className="grid min-h-screen place-items-center">
        <p className="text-muted">Opening Community…</p>
      </main>
    );
  }
  if (!user) return <LoginCard />;
  if (!profile) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <p className={error ? "text-danger" : "text-fg"}>
          {error || "Choose a first name before visiting Community."}
        </p>
        <Link to="/" className="mt-4 inline-block text-primary">
          Back to meetings
        </Link>
      </main>
    );
  }

  return (
    <div className="min-h-screen">
      <AppHeader profile={profile} />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-sm font-medium text-primary">Clean time, shared</p>
        <h1 className="mt-2 font-display text-4xl text-fg">Community</h1>
        <p className="mt-3 max-w-xl text-muted">
          Members choose to show how long they have been clean. Only the first name and clean time
          they share appear here. Journal notes always stay private.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            to="/journal"
            className="inline-flex h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-fg"
          >
            Share my clean time
          </Link>
          <Link
            to="/sponsors"
            className="inline-flex h-11 items-center rounded-lg border border-border px-4 text-sm font-semibold text-fg"
          >
            Sponsor board
          </Link>
        </div>

        {error && <p className="mt-4 text-sm text-danger">{error}</p>}
        {entries === null && !error && <p className="mt-6 text-muted">Loading clean time…</p>}
        {entries?.length === 0 && (
          <section className="mt-6 rounded-lg border border-border bg-surface p-5">
            <p className="font-semibold text-fg">No one is sharing yet.</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Add your clean date in the Journal, then turn on “Show my clean time on the Community
              board.” It is your choice, and you can turn it off any time.
            </p>
          </section>
        )}
        <ul className="mt-6 space-y-3">
          {entries?.map((entry) => (
            <li
              key={entry.userId}
              className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  aria-hidden="true"
                  className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/15 font-display text-lg text-primary"
                >
                  {entry.displayName.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-fg">
                    {entry.displayName}
                    {entry.mine ? <span className="font-normal text-primary"> · you</span> : null}
                  </p>
                </div>
              </div>
              <p className="shrink-0 sm:text-right">
                <span className="font-display text-2xl text-primary">
                  {entry.cleanDays === 0 ? "Today" : cleanTimeLabel(entry.cleanDays)}
                </span>
                <span className="block text-xs text-muted">clean</span>
              </p>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
