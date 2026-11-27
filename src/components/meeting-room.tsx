import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { BookOpen, Loader2 } from "lucide-react";
import {
  ConnectionStateToast,
  ControlBar,
  GridLayout,
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  StartAudio,
  useTracks,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import "@livekit/components-styles";
import {
  getVideoToken,
  heartbeat,
  leaveRoom,
  listMessages,
  listPresence,
  postMessage,
  rescheduleMeeting,
  ROOM_CAPACITY,
  roomStateMessage,
  type ChatMessage,
  type Meeting,
  type PresencePeer,
  type RoomAccess,
  type RoomState,
} from "@/lib/meetings.functions";

const GUIDE = [
  "Open with a moment of silence, then the Serenity Prayer in the we form.",
  "Ask who is new, using first names only.",
  "Have trusted members read the group’s chosen literature. Do not record the meeting.",
  "Open sharing. Suggest a few minutes each, and keep the focus on recovery.",
  "Close with gratitude and the reminder: who you see here, what you hear here, let it stay here.",
];

export function MeetingRoom({
  meeting,
  selfId,
  privateWith,
  access,
  focusChat,
}: {
  meeting: Meeting;
  selfId: string;
  privateWith?: { otherName: string; detail: string };
  access?: RoomAccess;
  focusChat?: boolean;
}) {
  const [peers, setPeers] = useState<PresencePeer[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [guideOpen, setGuideOpen] = useState(false);
  const [timeDraft, setTimeDraft] = useState("");
  const [notice, setNotice] = useState("");
  const [denied, setDenied] = useState<RoomState | null>(access && access.state !== "open" ? access.state : null);
  const [roomCount, setRoomCount] = useState(access?.count ?? 0);
  const [videoSession, setVideoSession] = useState<{ token: string; url: string } | null>(null);
  const [videoError, setVideoError] = useState("");
  const [mediaError, setMediaError] = useState("");
  const [videoAttempt, setVideoAttempt] = useState(0);
  const deniedRef = useRef<RoomState | null>(access && access.state !== "open" ? access.state : null);
  const chatPanelRef = useRef<HTMLElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!focusChat) return;
    chatPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    chatInputRef.current?.focus({ preventScroll: true });
  }, [focusChat]);

  useEffect(() => {
    return () => {
      void leaveRoom({ data: { meetingId: meeting.id } });
    };
  }, [meeting.id]);

  useEffect(() => {
    let stop = false;
    async function tick() {
      if (stop) return;
      // A locked or ended meeting will not reopen; stop asking. A full room
      // keeps checking so a freed seat is picked up automatically.
      if (deniedRef.current === "locked" || deniedRef.current === "ended") return;
      try {
        const result = await heartbeat({ data: { meetingId: meeting.id } });
        if (!stop) {
          deniedRef.current = result.ok ? null : result.state;
          setDenied(result.ok ? null : result.state);
          setRoomCount(result.count);
        }
      } catch {
        /* next tick */
      }
      if (stop || deniedRef.current) return;
      try {
        const nextPeers = await listPresence({ data: { meetingId: meeting.id } });
        if (!stop) setPeers(nextPeers);
      } catch {
        /* next tick */
      }
      try {
        const nextMessages = await listMessages({ data: { meetingId: meeting.id } });
        if (!stop) setMessages(nextMessages);
      } catch {
        /* next tick */
      }
    }
    const beat = window.setInterval(() => void tick(), 2500);
    void tick();
    return () => {
      stop = true;
      window.clearInterval(beat);
    };
  }, [meeting.id]);

  useEffect(() => {
    let stop = false;
    setVideoSession(null);
    setVideoError("");
    setMediaError("");
    void getVideoToken({ data: { roomId: meeting.id } })
      .then((result) => {
        if (stop) return;
        if (result.ok) setVideoSession({ token: result.token, url: result.url });
        else setVideoError(result.error);
      })
      .catch(() => {
        if (!stop) setVideoError("Video could not connect. Chat still works.");
      });
    return () => {
      stop = true;
    };
  }, [meeting.id, videoAttempt]);

  const starts = new Date(meeting.startsAt);
  const canReschedule = meeting.mine && starts.getTime() - Date.now() >= 48 * 60 * 60 * 1000;

  if (denied) {
    const title =
      denied === "full" ? "This room is full" : denied === "locked" ? "Joining has closed" : "This meeting has ended";
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-10">
        <Link to={privateWith ? "/sponsors" : "/"} className="text-sm text-muted">
          {privateWith ? "← Sponsors" : "← All meetings"}
        </Link>
        <h1 className="mt-3 font-display text-3xl text-fg">{title}</h1>
        <p className="mt-3 text-muted">{roomStateMessage(denied)}</p>
        {denied === "full" && (
          <p className="mt-2 text-sm text-muted">This page keeps checking, and you will go in if a seat opens.</p>
        )}
        <Link
          to="/"
          className="mt-6 inline-flex h-11 w-fit items-center rounded-lg border border-border px-4 font-semibold text-fg"
        >
          Back to meetings
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-4 px-4 pb-4 pt-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to={privateWith ? "/sponsors" : "/"} className="text-sm text-muted">
            {privateWith ? "← Sponsors" : "← All meetings"}
          </Link>
          <h1 className="font-display text-3xl text-fg">{privateWith ? "Private room" : meeting.title}</h1>
          <p className="text-sm text-muted">
            {privateWith
              ? `${privateWith.otherName} · ${privateWith.detail}`
              : `${meeting.format} · ${starts.toLocaleString()} · ${meeting.leaderName}`}
          </p>
          {privateWith && (
            <p className="mt-1 text-sm text-muted">
              Video and chat are only visible to the two of you. Camera and mic stay off until you turn them on.
            </p>
          )}
          {meeting.mine && !privateWith && (
            <p className="mt-1 text-sm text-primary">
              {meeting.hosted ? "This meeting counted." : "This counts once the meeting is over, if you guide it."}
            </p>
          )}
          {!privateWith && access && (
            <p className="mt-1 text-sm text-muted">
              {roomCount} / {access.capacity} in the room · joins close 20 minutes after the start
            </p>
          )}
        </div>
        {!privateWith && (
          <button
            type="button"
            onClick={() => setGuideOpen((open) => !open)}
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm text-fg"
          >
            <BookOpen className="size-4" />
            Chair guide
          </button>
        )}
      </div>

      {guideOpen && (
        <ol className="list-decimal space-y-2 rounded-lg border border-border bg-surface p-4 pl-8 text-sm leading-relaxed text-fg">
          {GUIDE.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="flex flex-col gap-3">
          <div
            data-lk-theme="default"
            className="h-[32rem] overflow-hidden rounded-lg border border-border bg-surface"
          >
            {videoSession ? (
              <LiveKitRoom
                token={videoSession.token}
                serverUrl={videoSession.url}
                audio={false}
                video={false}
                options={{ adaptiveStream: true, dynacast: true }}
                onMediaDeviceFailure={(failure, kind) => {
                  void failure;
                  setMediaError(
                    kind === "audioinput"
                      ? "Microphone could not start. Check your browser permissions."
                      : "Camera could not start. Check your browser permissions, then try again.",
                  );
                }}
                onError={() => setMediaError("Video could not connect. Chat still works.")}
                className="h-full"
              >
                <LiveKitStage />
              </LiveKitRoom>
            ) : videoError ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                <p className="text-sm text-fg">Video is not available right now.</p>
                <p className="max-w-md text-sm text-muted">{videoError}</p>
                <p className="max-w-md text-sm text-muted">Chat and the participant list still work.</p>
                <button
                  type="button"
                  onClick={() => setVideoAttempt((attempt) => attempt + 1)}
                  className="h-11 rounded-lg border border-border px-4 text-sm font-semibold text-fg"
                >
                  Try video again
                </button>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center gap-2 text-sm text-muted">
                <Loader2 className="size-4 animate-spin" />
                Connecting video…
              </div>
            )}
          </div>
          <p className="text-sm text-muted">
            Everyone in the room can turn on their camera and microphone. Camera and mic stay off until you turn
            them on in the video controls.
          </p>
          {mediaError && <p className="text-sm text-danger">{mediaError}</p>}
          {meeting.mine && !privateWith && (
            <form
              className="rounded-lg border border-border bg-surface p-4"
              onSubmit={(event) => {
                event.preventDefault();
                void rescheduleMeeting({ data: { id: meeting.id, startsAt: new Date(timeDraft).toISOString() } }).then((result) => {
                  if (!result.ok) setNotice(result.error);
                  else setNotice("Time updated.");
                });
              }}
            >
              <p className="text-sm text-muted">
                {canReschedule
                  ? "You can still change this time. The cutoff is 48 hours before start."
                  : "This meeting is inside 48 hours, so the time is locked."}
              </p>
              {canReschedule && (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    type="datetime-local"
                    required
                    value={timeDraft}
                    onChange={(event) => setTimeDraft(event.target.value)}
                    className="h-11 flex-1 rounded-lg border border-border bg-bg px-3 text-fg"
                  />
                  <button type="submit" className="h-11 rounded-lg bg-primary px-4 font-semibold text-primary-fg">
                    Update time
                  </button>
                </div>
              )}
              {notice && <p className="mt-2 text-sm text-fg">{notice}</p>}
            </form>
          )}
        </section>

        <aside ref={chatPanelRef} className="flex h-[32rem] flex-col rounded-lg border border-border bg-surface">
          <h2 className="border-b border-border px-4 py-3 text-sm font-semibold text-fg">
            {privateWith
              ? `Private chat · ${roomCount} / 2`
              : `In the room · ${roomCount} / ${access?.capacity ?? ROOM_CAPACITY}`}
          </h2>
          {!privateWith && peers.length > 0 && (
            <ul className="max-h-28 overflow-y-auto border-b border-border px-4 py-2 text-sm text-muted">
              {peers.map((peer) => (
                <li key={peer.userId} className="truncate py-0.5">
                  {peer.displayName}
                  {peer.userId === selfId ? " (you)" : ""}
                </li>
              ))}
            </ul>
          )}
          <ul className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.map((message) => (
              <li key={message.id}>
                <p className="text-xs text-muted">{message.displayName}</p>
                <p className="text-sm text-fg">{message.body}</p>
              </li>
            ))}
            {messages.length === 0 && (
              <li className="text-sm text-muted">
                {privateWith ? "Only the two of you can see this." : "Chat stays in this meeting."}
              </li>
            )}
          </ul>
          <form
            className="flex gap-2 border-t border-border p-3"
            onSubmit={(event) => {
              event.preventDefault();
              const body = draft.trim();
              if (!body) return;
              setDraft("");
              void postMessage({ data: { meetingId: meeting.id, body } }).then(() =>
                listMessages({ data: { meetingId: meeting.id } }).then(setMessages),
              );
            }}
          >
            <input
              ref={chatInputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Share a line"
              className="h-11 min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 text-sm text-fg"
            />
            <button type="submit" className="h-11 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-fg">
              Send
            </button>
          </form>
        </aside>
      </div>
    </main>
  );
}

function LiveKitStage() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  return (
    <div className="lk-video-conference h-full">
      <div className="lk-video-conference-inner">
        <div className="lk-grid-layout-wrapper">
          <GridLayout tracks={tracks}>
            <ParticipantTile />
          </GridLayout>
        </div>
        <ControlBar controls={{ chat: false, settings: false, leave: false, screenShare: true }} />
      </div>
      <RoomAudioRenderer />
      <StartAudio label="Allow audio" />
      <ConnectionStateToast />
    </div>
  );
}
