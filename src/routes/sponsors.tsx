import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { LoginCard } from "@/components/login-card";
import { AppHeader } from "@/components/app-header";
import {
  SPONSOR_WINDOWS,
  connectionSummary,
  windowIsOpen,
  windowLabel,
} from "@/lib/sponsor-windows";
import {
  addSponsorComment,
  getMe,
  listSponsorChats,
  listSponsorComments,
  listSponsors,
  openSponsorConnection,
  saveSponsor,
  type Profile,
  type SponsorChatSummary,
  type SponsorComment,
  type SponsorPost,
} from "@/lib/meetings.functions";

export const Route = createFileRoute("/sponsors")({ component: SponsorsPage });

function connectionDetail(chat: SponsorChatSummary) {
  return chat.youAreSponsor
    ? "You are the sponsor"
    : connectionSummary(chat.yearsClean, chat.windowStart);
}

function SponsorsPage() {
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [posts, setPosts] = useState<SponsorPost[] | null>(null);
  const [chats, setChats] = useState<SponsorChatSummary[]>([]);
  const [comments, setComments] = useState<Record<string, SponsorComment[] | undefined>>({});
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentPending, setCommentPending] = useState("");
  const [kind, setKind] = useState<"seeking" | "offering">("seeking");
  const [cleanTime, setCleanTime] = useState("");
  const [yearsClean, setYearsClean] = useState("2");
  const [windowStart, setWindowStart] = useState("0");
  const [pledged, setPledged] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [boardError, setBoardError] = useState("");
  const [opening, setOpening] = useState<{ userId: string; mode: "video" | "chat" } | null>(null);
  const [localHour, setLocalHour] = useState<number | null>(null);
  const userId = user?.id;

  function refreshBoard() {
    return Promise.all([listSponsors().then(setPosts), listSponsorChats().then(setChats)]);
  }

  function loadComments(postUserId: string) {
    setBoardError("");
    return listSponsorComments({ data: { postUserId } })
      .then((rows) => setComments((current) => ({ ...current, [postUserId]: rows })))
      .catch((err: unknown) => {
        setComments((current) => ({ ...current, [postUserId]: [] }));
        setBoardError(err instanceof Error ? err.message : "Could not load comments.");
      });
  }

  function toggleComments(postUserId: string) {
    const willOpen = !openComments[postUserId];
    setOpenComments((current) => ({ ...current, [postUserId]: willOpen }));
    if (willOpen && comments[postUserId] === undefined) void loadComments(postUserId);
  }

  function submitComment(postUserId: string) {
    const body = (commentDrafts[postUserId] ?? "").trim();
    if (!body) return;
    setCommentPending(postUserId);
    setBoardError("");
    void addSponsorComment({ data: { postUserId, body } })
      .then((result) => {
        if (!result.ok) {
          setBoardError(result.error);
          return;
        }
        setCommentDrafts((current) => ({ ...current, [postUserId]: "" }));
        return Promise.all([
          loadComments(postUserId),
          listSponsors().then(setPosts),
        ]);
      })
      .catch((err: unknown) =>
        setBoardError(err instanceof Error ? err.message : "Could not post your comment."),
      )
      .finally(() => setCommentPending(""));
  }

  function connect(postUserId: string, mode: "video" | "chat") {
    setOpening({ userId: postUserId, mode });
    setBoardError("");
    void openSponsorConnection({ data: { postUserId } })
      .then((result) => {
        if (!result.ok) {
          setBoardError(result.error);
          return;
        }
        return navigate({
          to: "/sponsor-chat/$chatId",
          params: { chatId: result.chatId },
          search: { mode },
        });
      })
      .catch((err: unknown) =>
        setBoardError(err instanceof Error ? err.message : "Could not open the private room."),
      )
      .finally(() => setOpening(null));
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
            Say if you are looking, or if you can sponsor. First names only. People can comment on
            your post, then open a private room with video and chat.
          </p>
          {!profile.canSponsor ? (
            <p className="mt-4 rounded-lg border border-border bg-surface-2 px-4 py-3 text-sm leading-relaxed text-fg">
              Sponsor access needs at least 2 years clean. Add your clean date in the Journal, then
              come back to offer your time.
            </p>
          ) : null}
          <div className="mt-4 rounded-lg border border-border bg-surface-2 px-4 py-3 text-sm leading-relaxed text-fg">
            <p>
              To sponsor, you need at least 2 years clean, and you agree to be available for a
              private conversation at least 12 hours a day. Pick that 12-hour window, for example
              12am–12pm, in your local time.
            </p>
            <p className="mt-2 text-muted">
              We cannot check clean time. Please do not offer unless this is true. The person who
              calls is real, and they are trusting you with their life.
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
                .catch((err: unknown) =>
                  setError(err instanceof Error ? err.message : "Could not post."),
                );
            }}
          >
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value as "seeking" | "offering")}
              className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-fg"
            >
              <option value="seeking">Looking for a sponsor</option>
              <option value="offering" disabled={!profile.canSponsor}>
                Available to sponsor
              </option>
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
                  <span>
                    I have at least 2 years clean, and I will be available for private video or
                    chat during this window every day.
                  </span>
                </label>
              </>
            ) : (
              <input
                value={cleanTime}
                onChange={(event) => setCleanTime(event.target.value)}
                placeholder="Clean time, if you want to share it"
                className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-fg"
              />
            )}
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={4}
              placeholder="A short note"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-fg"
            />
            {error && <p className="text-sm text-danger">{error}</p>}
            <button
              type="submit"
              className="h-11 rounded-lg bg-primary px-4 font-semibold text-primary-fg"
            >
              {offering ? "Offer to sponsor" : "Post"}
            </button>
          </form>
        </section>
        <div className="space-y-8">
          {chats.length > 0 && (
            <section>
              <h2 className="font-display text-2xl text-fg">Your private connections</h2>
              <p className="mt-1 text-sm text-muted">
                Video and chat are only visible to the two people in the room.
              </p>
              <ul className="mt-3 space-y-3">
                {chats.map((chat) => (
                  <li
                    key={chat.id}
                    className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-semibold text-fg">{chat.otherName}</p>
                      <p className="text-sm text-muted">{connectionDetail(chat)}</p>
                    </div>
                    <Link
                      to="/sponsor-chat/$chatId"
                      params={{ chatId: chat.id }}
                      search={{ mode: "video" }}
                      className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-4 font-semibold text-primary-fg"
                    >
                      Open room
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {boardError && <p className="text-sm text-danger">{boardError}</p>}
          <ul className="space-y-3">
            {posts === null && <li className="text-muted">Loading…</li>}
            {posts?.length === 0 && <li className="text-muted">No posts yet.</li>}
            {posts?.map((post) => {
              const canConnect =
                !post.mine &&
                (post.kind === "offering"
                  ? (post.yearsClean ?? 0) >= 2 && post.windowStart != null
                  : profile.canSponsor);
              const postComments = comments[post.userId];
              const showingComments = Boolean(openComments[post.userId]);
              return (
                <li key={post.userId} className="rounded-lg border border-border bg-surface p-4">
                  <p className="font-semibold text-fg">
                    {post.displayName}
                    <span className="font-normal text-muted">
                      {" "}
                      · {post.kind === "seeking" ? "looking" : "available"}
                    </span>
                    {post.mine ? <span className="font-normal text-primary"> · you</span> : null}
                  </p>
                  {post.kind === "offering" && post.windowStart != null ? (
                    <p className="mt-1 text-sm text-muted">
                      {post.yearsClean} years clean · private video or chat ·{" "}
                      {windowLabel(post.windowStart)}
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
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {canConnect && (
                      <>
                        <button
                          type="button"
                          disabled={opening !== null}
                          onClick={() => connect(post.userId, "video")}
                          className="h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-fg disabled:opacity-60"
                        >
                          {opening?.userId === post.userId && opening.mode === "video"
                            ? "Opening…"
                            : "Video"}
                        </button>
                        <button
                          type="button"
                          disabled={opening !== null}
                          onClick={() => connect(post.userId, "chat")}
                          className="h-11 rounded-lg border border-border px-4 text-sm font-semibold text-fg disabled:opacity-60"
                        >
                          {opening?.userId === post.userId && opening.mode === "chat"
                            ? "Opening…"
                            : "Chat"}
                        </button>
                        <span className="text-xs text-muted">
                          Camera stays off until you turn it on. Chat opens first when you choose
                          Chat.
                        </span>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleComments(post.userId)}
                      aria-expanded={showingComments}
                      className="h-11 rounded-lg border border-border px-4 text-sm font-semibold text-fg"
                    >
                      Comments{post.commentCount > 0 ? ` (${post.commentCount})` : ""}
                    </button>
                  </div>

                  {showingComments && (
                    <div className="mt-3 space-y-3 border-t border-border pt-3">
                      {postComments === undefined && (
                        <p className="text-sm text-muted">Loading comments…</p>
                      )}
                      {postComments?.length === 0 && (
                        <p className="text-sm text-muted">No comments yet.</p>
                      )}
                      {postComments && postComments.length > 0 && (
                        <ul className="space-y-2">
                          {postComments.map((comment) => (
                            <li key={comment.id} className="rounded-lg bg-surface-2 px-3 py-2">
                              <p className="text-xs font-medium text-muted">
                                {comment.displayName}
                                {comment.mine ? " · you" : ""}
                              </p>
                              <p className="mt-0.5 text-sm text-fg">{comment.body}</p>
                            </li>
                          ))}
                        </ul>
                      )}
                      {!post.mine ? (
                        <form
                          className="flex gap-2"
                          onSubmit={(event) => {
                            event.preventDefault();
                            submitComment(post.userId);
                          }}
                        >
                          <input
                            value={commentDrafts[post.userId] ?? ""}
                            onChange={(event) =>
                              setCommentDrafts((current) => ({
                                ...current,
                                [post.userId]: event.target.value,
                              }))
                            }
                            maxLength={500}
                            placeholder="Write a comment"
                            className="h-11 min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 text-sm text-fg"
                          />
                          <button
                            type="submit"
                            disabled={commentPending === post.userId}
                            className="h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-fg disabled:opacity-60"
                          >
                            {commentPending === post.userId ? "Sending…" : "Comment"}
                          </button>
                        </form>
                      ) : (
                        <p className="text-sm text-muted">
                          This is your post. Other members can comment here.
                        </p>
                      )}
                    </div>
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
