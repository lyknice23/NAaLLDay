import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { LoginCard } from "@/components/login-card";
import { AppHeader } from "@/components/app-header";
import { getMe, type Profile } from "@/lib/meetings.functions";
import { dealCode, milestoneTitle, MILESTONES, PARTNERS } from "@/lib/journal-catalog";
import {
  getJournal,
  listShared,
  saveDay,
  setCleanDate,
  shareAchievement,
  type JournalEntry,
  type JournalState,
  type SharedAchievement,
} from "@/lib/journal.functions";

export const Route = createFileRoute("/journal")({ component: JournalPage });

function JournalPage() {
  const { user, isPending } = useCurrentUserState();
  const userId = user?.id;
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [journal, setJournal] = useState<JournalState | null>(null);
  const [shared, setShared] = useState<SharedAchievement[] | null>(null);
  const [date, setDate] = useState("");
  const [selected, setSelected] = useState("");
  const [draft, setDraft] = useState("");
  const [shareNotes, setShareNotes] = useState<Record<number, string>>({});
  const [editingDate, setEditingDate] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  function load(month: string) {
    setError("");
    return getJournal({ data: { month } }).then(setJournal);
  }

  function refreshShares() {
    return listShared().then(setShared);
  }

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
    Promise.all([getJournal({ data: { month: "" } }), listShared()])
      .then(([next, board]) => {
        if (cancelled) return;
        setJournal(next);
        setShared(board);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not open the journal.");
      });
    return () => {
      cancelled = true;
    };
  }, [profile]);

  const journalRef = useRef(journal);
  journalRef.current = journal;
  const journalMonth = journal?.month;

  // When the visible month changes, start on today (or the first of the month).
  useEffect(() => {
    const current = journalRef.current;
    if (!current) return;
    const day = current.today.startsWith(current.month) ? current.today : `${current.month}-01`;
    setSelected(day);
    setDraft(current.entries.find((entry) => entry.entryDate === day)?.body ?? "");
  }, [journalMonth]);

  if (isPending || (user && profile === undefined)) {
    return (
      <main className="grid min-h-screen place-items-center">
        <p className="text-muted">Opening your journal…</p>
      </main>
    );
  }
  if (!user) return <LoginCard />;
  if (!profile) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <p className="text-fg">Choose a first name on the meetings page before keeping a journal.</p>
      </main>
    );
  }

  const started = Boolean(journal?.cleanSince);
  const byDate = new Map<string, JournalEntry>(
    (journal?.entries ?? []).map((entry) => [entry.entryDate, entry] as const),
  );
  const selectedEntry = selected ? byDate.get(selected) : undefined;

  function shiftMonth(delta: number) {
    if (!journal) return;
    const [year, monthNumber] = journal.month.split("-").map(Number);
    const next = new Date(year, monthNumber - 1 + delta, 1);
    void load(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`).catch((err: unknown) =>
      setError(err instanceof Error ? err.message : "Could not load that month."),
    );
  }

  function saveSelected(marked: boolean) {
    if (!journal || !selected) return;
    setPending(true);
    setError("");
    void saveDay({ data: { date: selected, body: marked ? draft : "", marked, month: journal.month } })
      .then((result) => {
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setJournal(result.journal);
        if (!marked) setDraft("");
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not save that day."))
      .finally(() => setPending(false));
  }

  const [year, monthNumber] = (journal?.month ?? "").split("-").map(Number);
  const daysInMonth = journal ? new Date(year, monthNumber, 0).getDate() : 0;
  const leading = journal ? new Date(year, monthNumber - 1, 1).getDay() : 0;
  const monthLabel = journal
    ? new Date(year, monthNumber - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : "";
  const atCurrentMonth = journal ? journal.month >= journal.today.slice(0, 7) : true;

  return (
    <div className="min-h-screen">
      <AppHeader profile={profile} />
      <main className="mx-auto grid max-w-5xl gap-8 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-8">
          <section>
            <p className="text-sm font-medium text-primary">Only you can read the notes</p>
            <h1 className="mt-2 font-display text-4xl text-fg">Clean journal</h1>
            <p className="mt-3 max-w-xl text-muted">
              Mark the days you stayed clean and keep a line about how it went. Notes stay on your account. A day can be
              marked from your clean date through today.
            </p>
          </section>

          {!journal && !error && <p className="text-muted">Loading your journal…</p>}
          {error && <p className="text-sm text-danger">{error}</p>}

          {journal && (!started || editingDate) && (
            <form
              className="rounded-lg border border-border bg-surface p-5"
              onSubmit={(event) => {
                event.preventDefault();
                setPending(true);
                setError("");
                void setCleanDate({ data: { date } })
                  .then((result) => {
                    if (!result.ok) setError(result.error);
                    else {
                      setJournal(result.journal);
                      setEditingDate(false);
                      return refreshShares();
                    }
                  })
                  .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not save the date."))
                  .finally(() => setPending(false));
              }}
            >
              <label className="block text-sm text-muted">
                When did this clean time start?
                <input
                  type="date"
                  required
                  max={journal.today || undefined}
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  className="mt-1 h-11 w-full rounded-lg border border-border bg-bg px-3 text-fg"
                />
              </label>
              <button
                type="submit"
                disabled={pending}
                className="mt-4 h-11 rounded-lg bg-primary px-4 font-semibold text-primary-fg disabled:opacity-60"
              >
                {pending ? "Saving…" : "Save clean date"}
              </button>
            </form>
          )}

          {journal && started && !editingDate && (
            <>
              <section className="rounded-lg border border-border bg-surface p-5">
                <p className="text-sm text-muted">Clean</p>
                <p className="font-display text-6xl text-fg">
                  {journal.daysClean}
                  <span className="ml-2 text-2xl text-muted">{journal.daysClean === 1 ? "day" : "days"}</span>
                </p>
                <p className="mt-1 text-sm text-muted">Since {journal.cleanSince}</p>
                <button
                  type="button"
                  onClick={() => setEditingDate(true)}
                  className="mt-3 text-sm text-muted underline-offset-4 hover:underline"
                >
                  Set a new clean date
                </button>
              </section>

              <section className="rounded-lg border border-border bg-surface p-4">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => shiftMonth(-1)}
                    aria-label="Previous month"
                    className="grid h-10 w-10 place-items-center rounded-lg border border-border text-fg"
                  >
                    ←
                  </button>
                  <div className="text-center">
                    <p className="font-display text-xl text-fg">{monthLabel}</p>
                    <p className="text-xs text-muted">
                      {journal.entries.length} {journal.entries.length === 1 ? "day" : "days"} marked
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => shiftMonth(1)}
                    disabled={atCurrentMonth}
                    aria-label="Next month"
                    className="grid h-10 w-10 place-items-center rounded-lg border border-border text-fg disabled:opacity-40"
                  >
                    →
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs text-muted">
                  {["S", "M", "T", "W", "T", "F", "S"].map((label, index) => (
                    <span key={`${label}-${index}`}>{label}</span>
                  ))}
                </div>

                <div className="mt-1 grid grid-cols-7 gap-1">
                  {Array.from({ length: leading }).map((_, index) => (
                    <div key={`pad-${index}`} />
                  ))}
                  {Array.from({ length: daysInMonth }, (_, index) => {
                    const day = index + 1;
                    const dateStr = `${journal.month}-${String(day).padStart(2, "0")}`;
                    const entry = byDate.get(dateStr);
                    const future = dateStr > journal.today;
                    const beforeStart = Boolean(journal.cleanSince && dateStr < journal.cleanSince);
                    const disabled = future || beforeStart;
                    const isSelected = selected === dateStr;
                    const isToday = dateStr === journal.today;
                    return (
                      <button
                        key={dateStr}
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          setSelected(dateStr);
                          setDraft(entry?.body ?? "");
                        }}
                        aria-label={`${formatDay(dateStr)}${entry ? ", marked clean" : ""}`}
                        aria-pressed={isSelected}
                        className={`relative flex min-h-11 flex-col items-center justify-center rounded-lg border text-sm transition-colors ${
                          disabled
                            ? "border-transparent text-muted/40"
                            : isSelected
                              ? "border-primary bg-primary/15 text-fg ring-1 ring-primary"
                              : entry
                                ? "border-primary/50 bg-primary/10 text-fg"
                                : "border-border bg-surface-2 text-muted hover:border-primary/40 hover:text-fg"
                        }`}
                      >
                        <span className={isToday ? "font-semibold text-primary" : undefined}>{day}</span>
                        {entry && <span className="mt-0.5 size-1.5 rounded-full bg-primary" />}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 text-xs text-muted">
                  Tap a day to write a note. A filled day means you marked it clean.
                </p>
              </section>

              {selected && (
                <section className="rounded-lg border border-border bg-surface p-4">
                  <p className="text-sm font-medium text-fg">
                    {formatDay(selected)}
                    {selectedEntry ? <span className="font-normal text-primary"> · day {selectedEntry.cleanDays}</span> : null}
                  </p>
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    rows={3}
                    placeholder="A private line, if you want one"
                    className="mt-2 w-full rounded-lg border border-border bg-bg px-3 py-2 text-fg"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => saveSelected(true)}
                      disabled={pending}
                      className="h-11 rounded-lg bg-primary px-4 font-semibold text-primary-fg disabled:opacity-60"
                    >
                      {pending ? "Saving…" : selectedEntry ? "Save note" : "I stayed clean"}
                    </button>
                    {selectedEntry && (
                      <button
                        type="button"
                        onClick={() => saveSelected(false)}
                        disabled={pending}
                        className="h-11 rounded-lg border border-border px-4 text-sm font-semibold text-fg disabled:opacity-60"
                      >
                        Remove mark
                      </button>
                    )}
                  </div>
                </section>
              )}

              <section>
                <h2 className="font-display text-2xl text-fg">Notes this month</h2>
                <ul className="mt-3 space-y-3">
                  {journal.entries.filter((entry) => entry.body).length === 0 && (
                    <li className="text-sm text-muted">No notes yet. Marking a day is enough.</li>
                  )}
                  {journal.entries
                    .filter((entry) => entry.body)
                    .map((entry) => (
                      <li key={entry.id} className="rounded-lg border border-border bg-surface p-4">
                        <p className="text-sm text-muted">
                          {formatDay(entry.entryDate)} · day {entry.cleanDays}
                        </p>
                        <p className="mt-1 text-fg">{entry.body}</p>
                      </li>
                    ))}
                </ul>
              </section>

              <section>
                <h2 className="font-display text-2xl text-fg">Goals</h2>
                <ul className="mt-3 space-y-3">
                  {MILESTONES.map((goal) => {
                    const reached = journal.daysClean >= goal.days;
                    const sharedAlready = journal.sharedMine.includes(goal.days);
                    const partner = PARTNERS.find((item) => item.id === goal.partnerId);
                    return (
                      <li key={goal.days} className="rounded-lg border border-border bg-surface p-4">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p className="font-semibold text-fg">{goal.title}</p>
                          <p className={`text-sm ${reached ? "text-primary" : "text-muted"}`}>
                            {reached ? "Reached" : `${goal.days} days`}
                          </p>
                        </div>
                        {partner && (
                          <p className="mt-1 text-sm text-muted">
                            {reached ? `${partner.name} deal is open.` : `${partner.name} deal opens at ${goal.days} days.`}
                          </p>
                        )}
                        {reached && (
                          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                            <input
                              value={shareNotes[goal.days] ?? ""}
                              onChange={(event) =>
                                setShareNotes((current) => ({ ...current, [goal.days]: event.target.value }))
                              }
                              placeholder={sharedAlready ? "Update what you share" : "A line to share, optional"}
                              className="h-11 min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 text-sm text-fg"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setError("");
                                void shareAchievement({ data: { days: goal.days, note: shareNotes[goal.days] ?? "" } })
                                  .then((result) => {
                                    if (!result.ok) setError(result.error);
                                    else {
                                      void load(journal.month);
                                      return refreshShares();
                                    }
                                  })
                                  .catch((err: unknown) =>
                                    setError(err instanceof Error ? err.message : "Could not share."),
                                  );
                              }}
                              className="h-11 rounded-lg border border-border px-4 text-sm font-semibold text-fg"
                            >
                              {sharedAlready ? "Update share" : "Share"}
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            </>
          )}

          <section>
            <h2 className="font-display text-2xl text-fg">Shared achievements</h2>
            <ul className="mt-3 space-y-3">
              {shared === null && <li className="text-muted">Loading…</li>}
              {shared?.length === 0 && <li className="text-sm text-muted">No one has shared a goal yet.</li>}
              {shared?.map((item) => (
                <li key={item.id} className="rounded-lg border border-border bg-surface p-4">
                  <p className="font-semibold text-fg">
                    {item.displayName}
                    <span className="font-normal text-muted"> · {milestoneTitle(item.milestoneDays)}</span>
                    {item.mine ? <span className="font-normal text-primary"> · you</span> : null}
                  </p>
                  {item.note && <p className="mt-1 text-sm text-fg">{item.note}</p>}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          <div>
            <h2 className="font-display text-2xl text-fg">Partner deals</h2>
            <p className="mt-1 text-sm text-muted">Ads from partners keep ALL DAY NA free. A deal opens only after the goal.</p>
          </div>
          {PARTNERS.map((partner) => {
            const open = (journal?.daysClean ?? 0) >= partner.days && started;
            return (
              <article
                key={partner.id}
                className={`rounded-lg border p-4 ${open ? "border-primary bg-surface" : "border-border bg-surface"}`}
              >
                <p className="text-xs font-medium tracking-wide text-muted">Ad · {partner.name}</p>
                <p className="mt-2 text-sm text-fg">{partner.ad}</p>
                <p className="mt-3 text-sm text-muted">{partner.offer}</p>
                {open ? (
                  <p className="mt-2 text-sm font-semibold text-primary">{dealCode(partner.id, partner.days)}</p>
                ) : (
                  <p className="mt-2 text-sm text-muted">Opens at {partner.days} days clean.</p>
                )}
              </article>
            );
          })}
        </aside>
      </main>
    </div>
  );
}

function formatDay(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return date;
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
