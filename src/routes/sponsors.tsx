import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { LoginCard } from "@/components/login-card";
import { AppHeader } from "@/components/app-header";
import { SPONSOR_WINDOWS, windowIsOpen, windowLabel } from "@/lib/sponsor-windows";
import {
  getMe,
  listSponsorChats,
  listSponsors,
  openSponsorChat,
  saveSponsor,
  type Profile,
  type SponsorChatSummary,
  type SponsorPost,
} from "@/lib/meetings.functions";

export const Route = createFileRoute("/sponsors")({ component: SponsorsPage });

function SponsorsPage() {
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [posts, setPosts] = useState<SponsorPost[] | null>(null);
  const [chats, setChats] = useState<SponsorChatSummary[]>([]);
  const [kind, setKind] = useState<"seeking" | "offering">("seeking");
  const [cleanTime, setCleanTime] = useState("");
  const [yearsClean, setYearsClean] = useState("2");
  const [windowStart, setWindowStart] = useState("0");
  const [pledged, setPledged] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [opening, setOpening] = useState("");
  const [localHour, setLocalHour] = useState<number | null>(null);
  const userId = user?.id;

  function refreshBoard() {
    return Promise.all([listSponsors().then(setPosts), listSponsorChats().then(setChats)]);
  }

  useEffect(() => {
    setLocalHour(new Date().getHours());
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
    refreshBoard().catch(() => {
      if (!cancelled) setPosts([]);
    });
    return () => {
      cancelled = true;
    };
  }, [profile]);

  if (isPending || (user && profile === undefined)) {
    return (
      <main className="grid min-h-screen place-items-center">
        <p className="text-muted">Opening sponsors…</p>
      </main>
    );
  }
  if (!user) return <LoginCard />;
  if (!profile) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <p className="text-fg">Choose a first name on the meetings page before posting here.</p>
      </main>
    );
  }

  const offering = kind === "offering";

  return (
    <div className="min-h-screen">
      <AppHeader profile={profile} />
      <main className="mx-auto grid max-w-5xl gap-8 px-4 py-8 lg:grid-cols-2">
        <section>
          <h1 className="font-display text-3xl text-fg">Sponsors</h1>
          <p className="mt-2 text-muted">
            Say if you are looking, or if you can sponsor. First names only. A connection is a private video between the two of you.
          </p>
          {!profile.canSponsor ? (
            <p className="mt-4 rounded-lg border border-border bg-surface-2 px-4 py-3 text-sm leading-relaxed text-fg">
              Sponsor access needs at least 2 years clean. Add your clean date in the
              Journal, then come back to offer your time.
            </p>
          ) : null}
          <div className="mt-4 rounded-lg border border-border bg-surface-2 px-4 py-3 text-sm leading-relaxed text-fg">
            <p>To sponsor, you need at least 2 years clean, and you agree to be available for a private video conversation at least 12 hours a day. Pick that 12-hour window, for example 12am–12pm, in your local time.</p>
            <p className="mt-2 text-muted">
              We cannot check clean time. Please do not offer unless this is true. The person who calls is real, and they are trusting you with their life.
            </p>
          </div>
          <form
            className="mt-6 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              setError("");
              void saveSponsor({
                data: {
                  kind,
                  cleanTime,
                  note,
                  yearsClean: offering ? Number(yearsClean) : null,
                  windowStart: offering ? Number(windowStart) : null,
                  pledged: offering ? pledged : false,
                },
              })
                .then((result) => {
                  if (!result.ok) setError(result.error);
                  else return refreshBoard();
                })
                .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not post."));
            }}
          >
            <select value={kind} onChange={(event) => setKind(event.target.value as "seeking" | "offering")} className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-fg">
              <option value="seeking">Looking for a sponsor</option>
              <option value="offering" disabled={!profile.canSponsor}>Available to sponsor</option>
            </select>
            {offering ? (
              <>
                <label className="block text-sm text-muted">
                  Years clean
                  <input
                    type="number"
                    min={2}
                    max={80}
                    required
                    value={yearsClean}
                    onChange={(event) => setYearsClean(event.target.value)}
                    className="mt-1 h-11 w-full rounded-lg border border-border bg-surface px-3 text-fg"
                  />
                </label>
                <label className="block text-sm text-muted">
                  12-hour window, every day (your local time)
                  <select
                    value={windowStart}
                    onChange={(event) => setWindowStart(event.target.value)}
                    className="mt-1 h-11 w-full rounded-lg border border-border bg-surface px-3 text-fg"
                  >
                    {SPONSOR_WINDOWS.map((slot) => (
                      <option key={slot.start} value={slot.start}>
                        {slot.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-start gap-3 text-sm text-fg">
                  <input
                    type="checkbox"
                    checked={pledged}
                    onChange={(event) => setPledged(event.target.checked)}
                    required
                    className="mt-1"
                  />
                  <span>I have at least 2 years clean, and I will be available for private video during this window every day.</span>
                </label>
              </>
            ) : (
              <input value={cleanTime} onChange={(event) => setCleanTime(event.target.value)} placeholder="Clean time, if you want to share it" className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-fg" />
            )}
            <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={4} placeholder="A short note" className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-fg" />
            {error && <p className="text-sm text-danger">{error}</p>}
            <button type="submit" className="h-11 rounded-lg bg-primary px-4 font-semibold text-primary-fg">
              {offering ? "Offer to sponsor" : "Post"}
            </button>
          </form>
        </section>
        <div className="space-y-8">
          {chats.length > 0 && (
            <section>
              <h2 className="font-display text-2xl text-fg">Your private videos</h2>
              <ul className="mt-3 space-y-3">
                {chats.map((chat) => (
                  <li key={chat.id} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-fg">{chat.otherName}</p>
                      <p className="text-sm text-muted">
                        {chat.youAreSponsor ? "You are the sponsor" : `${chat.yearsClean ?? "?"} years · ${windowLabel(chat.windowStart)}`}
                      </p>
                    </div>
                    <Link
                      to="/sponsor-chat/$chatId"
                      params={{ chatId: chat.id }}
                      className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-4 font-semibold text-primary-fg"
                    >
                      Open video
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <ul className="space-y-3">
            {posts === null && <li className="text-muted">Loading…</li>}
            {posts?.length === 0 && <li className="text-muted">No posts yet.</li>}
            {posts?.map((post) => {
              const canConnect = post.kind === "offering" && !post.mine && (post.yearsClean ?? 0) >= 2 && post.windowStart != null;
              return (
                <li key={post.userId} className="rounded-lg border border-border bg-surface p-4">
                  <p className="font-semibold text-fg">
                    {post.displayName}
                    <span className="font-normal text-muted"> · {post.kind === "seeking" ? "looking" : "available"}</span>
                    {post.mine ? <span className="font-normal text-primary"> · you</span> : null}
                  </p>
                  {post.kind === "offering" && post.windowStart != null ? (
                    <p className="mt-1 text-sm text-muted">
                      {post.yearsClean} years clean · private video {windowLabel(post.windowStart)}
                      {localHour != null && windowIsOpen(post.windowStart, localHour) ? (
                        <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
                          Available now
                        </span>
                      ) : null}
                    </p>
                  ) : (
                    post.cleanTime && <p className="mt-1 text-sm text-muted">{post.cleanTime}</p>
                  )}
                  {post.note && <p className="mt-2 text-sm text-fg">{post.note}</p>}
                  {canConnect && (
                    <button
                      type="button"
                      disabled={opening === post.userId}
                      onClick={() => {
                        setOpening(post.userId);
                        setError("");
                        void openSponsorChat({ data: { sponsorUserId: post.userId } })
                          .then((result) => {
                            if (!result.ok) {
                              setError(result.error);
                              return;
                            }
                            return navigate({ to: "/sponsor-chat/$chatId", params: { chatId: result.chatId } });
                          })
                          .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not open the video."))
                          .finally(() => setOpening(""));
                      }}
                      className="mt-3 h-11 rounded-lg bg-primary px-4 font-semibold text-primary-fg disabled:opacity-60"
                    >
                      {opening === post.userId ? "Opening…" : "Private video"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </main>
    </div>
  );
}
