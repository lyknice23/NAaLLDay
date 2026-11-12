import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { LoginCard } from "@/components/login-card";
import { AppHeader } from "@/components/app-header";
import {
  createMeeting,
  getMe,
  listMeetings,
  loadDemo,
  rescheduleMeeting,
  saveProfile,
  type Meeting,
  type Profile,
} from "@/lib/meetings.functions";
import { setSignup } from "@/lib/notify.functions";

export const Route = createFileRoute("/")({ component: Home });

const FORMATS = ["Discussion", "Speaker", "Step Study", "Literature", "Newcomer"];

function Home() {
  const { user, isPending } = useCurrentUserState();
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [loadError, setLoadError] = useState("");
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    getMe()
      .then((result) => {
        if (!cancelled) setProfile(result.profile);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Could not load your profile.";
        if (message === "Unauthorized") setNeedsSignIn(true);
        else setLoadError(message);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (isPending) return <ShellLoading />;
  if (!user || needsSignIn) return <LoginCard />;
  if (loadError) return <Centered>{loadError}</Centered>;
  if (profile === undefined) return <ShellLoading />;
  if (!profile) return <Setup onSaved={setProfile} />;
  return <Dashboard profile={profile} onProfile={setProfile} />;
}

function Setup({ onSaved }: { onSaved: (profile: Profile) => void }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<"leader" | "attendee">("attendee");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [demoPending, setDemoPending] = useState(false);

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
      <p className="text-sm font-medium text-primary">How will you take part?</p>
      <h1 className="mt-2 font-display text-4xl text-fg">First name only.</h1>
      <p className="mt-3 text-muted">
        Leaders schedule and guide meetings. Attendees join. You can change this later unless leader
        access is suspended.
      </p>
      <form
        className="mt-8 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          setPending(true);
          setError("");
          void saveProfile({ data: { displayName: name, role } })
            .then((result) => {
              if (!result.ok || !result.profile)
                setError(result.ok ? "Could not save." : result.error);
              else onSaved(result.profile);
            })
            .catch((err: unknown) =>
              setError(err instanceof Error ? err.message : "Could not save."),
            )
            .finally(() => setPending(false));
        }}
      >
        <label className="block text-sm text-muted">
          First name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            className="mt-1 h-12 w-full rounded-lg border border-border bg-surface px-3 text-fg"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <RoleChoice
            active={role === "leader"}
            onClick={() => setRole("leader")}
            title="Leader"
            detail="Schedule and guide"
          />
          <RoleChoice
            active={role === "attendee"}
            onClick={() => setRole("attendee")}
            title="Attendee"
            detail="Join meetings"
          />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button
          type="submit"
          disabled={pending || demoPending}
          className="h-12 w-full rounded-lg bg-primary font-semibold text-primary-fg disabled:opacity-60"
        >
          {pending ? "Saving…" : "Enter"}
        </button>
      </form>
      <button
        type="button"
        disabled={pending || demoPending}
        onClick={() => {
          setDemoPending(true);
          setError("");
          void loadDemo()
            .then((result) => {
              if (result.profile) onSaved(result.profile);
              else setError("Could not load the demo.");
            })
            .catch((err: unknown) =>
              setError(err instanceof Error ? err.message : "Could not load the demo."),
            )
            .finally(() => setDemoPending(false));
        }}
        className="mt-3 h-12 w-full rounded-lg border border-border font-semibold text-fg disabled:opacity-60"
      >
        {demoPending ? "Loading demo…" : "See a demo"}
      </button>
    </main>
  );
}

function RoleChoice({
  active,
  onClick,
  title,
  detail,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  detail: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-4 text-left ${active ? "border-primary bg-surface-2" : "border-border bg-surface"}`}
    >
      <span className="block font-semibold text-fg">{title}</span>
      <span className="text-sm text-muted">{detail}</span>
    </button>
  );
}

function Dashboard({
  profile,
  onProfile,
}: {
  profile: Profile;
  onProfile: (profile: Profile) => void;
}) {
  const [meetings, setMeetings] = useState<Meeting[] | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [demoPending, setDemoPending] = useState(false);
  const leading = profile.role === "leader" && !profile.leaderBanned;

  function refresh() {
    void listMeetings().then(setMeetings);
    void getMe().then((result) => {
      if (result.profile) onProfile(result.profile);
    });
  }

  useEffect(() => {
    let cancelled = false;
    listMeetings()
      .then((rows) => {
        if (!cancelled) setMeetings(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load meetings.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen">
      <AppHeader profile={profile} />
      <main className="mx-auto max-w-5xl px-4 py-8">
        {profile.leaderBanned && (
          <p className="mb-6 rounded-lg border border-danger/40 bg-surface px-4 py-3 text-sm text-fg">
            Leader access is suspended: last week had fewer than 3 meetings you guided through the
            end. You can still attend every meeting.
          </p>
        )}
        {leading && (
          <section className="mb-8 rounded-lg border border-border bg-surface p-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm text-muted">Hosted this week</p>
                <p className="font-display text-4xl text-fg">
                  {profile.hostedThisWeek}
                  <span className="text-2xl text-muted"> / 3</span>
                </p>
                <p className="mt-1 text-sm text-muted">
                  {profile.scheduledThisWeek} scheduled. A meeting counts once it is over, and only
                  if you were in the room to guide it. After your first week, a week under 3 counted
                  meetings suspends leader access. Any hour is allowed.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                className="h-11 rounded-lg bg-primary px-4 font-semibold text-primary-fg"
              >
                Schedule a meeting
              </button>
            </div>
            {open && (
              <ScheduleForm
                onCreated={() => {
                  setOpen(false);
                  refresh();
                }}
              />
            )}
          </section>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl text-fg">Coming up</h2>
          <button
            type="button"
            disabled={demoPending}
            onClick={() => {
              setDemoPending(true);
              setError("");
              void loadDemo()
                .then((result) => {
                  if (result.profile) onProfile(result.profile);
                  return listMeetings().then(setMeetings);
                })
                .catch((err: unknown) =>
                  setError(err instanceof Error ? err.message : "Could not load the demo."),
                )
                .finally(() => setDemoPending(false));
            }}
            className="h-11 rounded-lg border border-border px-4 font-semibold text-fg disabled:opacity-60"
          >
            {demoPending ? "Loading demo…" : "See a demo"}
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        {meetings === null && !error && <p className="mt-4 text-muted">Loading meetings…</p>}
        {meetings?.length === 0 && (
          <p className="mt-4 text-muted">
            No meetings on the board yet. Try the demo, or schedule one any hour of the day.
          </p>
        )}
        <ul className="mt-4 space-y-3">
          {meetings?.map((meeting) => {
            const closed = Boolean(meeting.joinState && meeting.joinState !== "open");
            const lockLabel = meeting.lockAt
              ? new Date(meeting.lockAt).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })
              : "";
            return (
              <li
                key={meeting.id}
                className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-fg">{meeting.title}</h3>
                  <p className="text-sm text-muted">
                    {meeting.format} · {new Date(meeting.startsAt).toLocaleString()} ·{" "}
                    {meeting.leaderName}
                    {meeting.mine ? " · yours" : ""}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {meeting.signupCount ?? 0} signed up · {meeting.liveCount ?? 0} / 50 in the room
                    {!meeting.mine && !closed ? ` · joins close ${lockLabel}` : ""}
                  </p>
                  {meeting.description && (
                    <p className="mt-1 text-sm text-fg">{meeting.description}</p>
                  )}
                  {meeting.mine && (
                    <p className="mt-1 text-sm text-primary">
                      {meeting.hosted
                        ? "Counted"
                        : new Date(meeting.endsAt).getTime() > Date.now()
                          ? "Counts once it's over"
                          : "Over · did not count"}
                    </p>
                  )}
                  {!meeting.mine && meeting.signedUp && (
                    <p className="mt-1 text-sm text-primary">You'll get a reminder.</p>
                  )}
                  {meeting.mine && <Reschedule meeting={meeting} onDone={refresh} />}
                </div>
                <div className="flex flex-wrap items-start gap-2">
                  {!meeting.mine && (
                    <button
                      type="button"
                      onClick={() => {
                        setError("");
                        void setSignup({
                          data: { meetingId: meeting.id, going: !meeting.signedUp },
                        })
                          .then((result) => {
                            if (!result.ok) setError(result.error);
                            else return listMeetings().then(setMeetings);
                          })
                          .catch((err: unknown) =>
                            setError(
                              err instanceof Error ? err.message : "Could not update signup.",
                            ),
                          );
                      }}
                      className={`inline-flex h-11 items-center justify-center rounded-lg border px-4 font-semibold ${meeting.signedUp ? "border-primary text-primary" : "border-border text-fg"}`}
                    >
                      {meeting.signedUp ? "Signed up" : "I'll be there"}
                    </button>
                  )}
                  {closed && !meeting.mine ? (
                    <span className="inline-flex h-11 items-center rounded-lg border border-border px-4 text-sm text-muted">
                      {meeting.joinState === "locked"
                        ? "Joins closed"
                        : meeting.joinState === "full"
                          ? "Full"
                          : "Ended"}
                    </span>
                  ) : (
                    <Link
                      to="/room/$meetingId"
                      params={{ meetingId: meeting.id }}
                      className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-5 font-semibold text-primary-fg"
                    >
                      {meeting.mine ? "Open room" : "Join"}
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}

function ScheduleForm({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [format, setFormat] = useState(FORMATS[0]);
  const [startsAt, setStartsAt] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <form
      className="mt-5 grid gap-3 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        setPending(true);
        setError("");
        void createMeeting({
          data: { title, format, description, startsAt: new Date(startsAt).toISOString() },
        })
          .then((result) => {
            if (!result.ok) setError(result.error);
            else onCreated();
          })
          .catch((err: unknown) =>
            setError(err instanceof Error ? err.message : "Could not schedule."),
          )
          .finally(() => setPending(false));
      }}
    >
      <input
        required
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Meeting title"
        className="h-11 rounded-lg border border-border bg-bg px-3 text-fg"
      />
      <select
        value={format}
        onChange={(event) => setFormat(event.target.value)}
        className="h-11 rounded-lg border border-border bg-bg px-3 text-fg"
      >
        {FORMATS.map((item) => (
          <option key={item}>{item}</option>
        ))}
      </select>
      <input
        required
        type="datetime-local"
        value={startsAt}
        onChange={(event) => setStartsAt(event.target.value)}
        className="h-11 rounded-lg border border-border bg-bg px-3 text-fg"
      />
      <div className="flex h-11 items-center rounded-lg border border-border bg-surface px-3 text-sm text-muted">
        Every meeting is 1 hour
      </div>
      <input
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="Topic (optional)"
        className="h-11 rounded-lg border border-border bg-bg px-3 text-fg"
      />
      {error && <p className="text-sm text-danger sm:col-span-2">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="h-11 rounded-lg border border-border text-fg sm:col-span-2 disabled:opacity-60"
      >
        {pending ? "Scheduling…" : "Put it on the board"}
      </button>
    </form>
  );
}

function Reschedule({ meeting, onDone }: { meeting: Meeting; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const editable = new Date(meeting.startsAt).getTime() - Date.now() >= 48 * 60 * 60 * 1000;

  if (!editable) {
    return (
      <p className="mt-2 text-sm text-muted">
        Time is locked — a change must be made at least 48 hours ahead.
      </p>
    );
  }

  return (
    <div className="mt-2">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          Change the time
        </button>
      ) : (
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            setPending(true);
            setError("");
            void rescheduleMeeting({
              data: { id: meeting.id, startsAt: new Date(value).toISOString() },
            })
              .then((result) => {
                if (!result.ok) setError(result.error);
                else {
                  setOpen(false);
                  onDone();
                }
              })
              .catch((err: unknown) =>
                setError(err instanceof Error ? err.message : "Could not change the time."),
              )
              .finally(() => setPending(false));
          }}
        >
          <input
            type="datetime-local"
            required
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="h-10 flex-1 rounded-lg border border-border bg-bg px-3 text-sm text-fg"
          />
          <button
            type="submit"
            disabled={pending}
            className="h-10 rounded-lg border border-border px-4 text-sm font-semibold text-fg disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save time"}
          </button>
        </form>
      )}
      {error && <p className="mt-1 text-sm text-danger">{error}</p>}
    </div>
  );
}

function ShellLoading() {
  return (
    <main className="grid min-h-screen place-items-center">
      <p className="text-muted">Opening ALL DAY NA…</p>
    </main>
  );
}

function Centered({ children }: { children: string }) {
  return (
    <main className="grid min-h-screen place-items-center px-6 text-center">
      <p className="max-w-md text-danger">{children}</p>
    </main>
  );
}
