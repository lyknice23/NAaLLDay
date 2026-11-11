import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Mic, MicOff, Video, VideoOff, BookOpen } from "lucide-react";
import {
  heartbeat,
  leaveRoom,
  listMessages,
  listPresence,
  pollSignals,
  postMessage,
  postSignal,
  rescheduleMeeting,
  ROOM_CAPACITY,
  roomStateMessage,
  type ChatMessage,
  type Meeting,
  type PresencePeer,
  type RoomAccess,
  type RoomState,
} from "@/lib/meetings.functions";

const ICE = [{ urls: "stun:stun.l.google.com:19302" }];

const GUIDE = [
  "Open with a moment of silence, then the Serenity Prayer in the we form.",
  "Ask who is new, using first names only.",
  "Have trusted members read the group’s chosen literature. Do not record the meeting.",
  "Open sharing. Suggest a few minutes each, and keep the focus on recovery.",
  "Close with gratitude and the reminder: who you see here, what you hear here, let it stay here.",
];

type Payload =
  | { type: "offer"; sdp: RTCSessionDescriptionInit }
  | { type: "answer"; sdp: RTCSessionDescriptionInit }
  | { type: "ice"; candidate: RTCIceCandidateInit };

export function MeetingRoom({
  meeting,
  selfId,
  privateWith,
  access,
}: {
  meeting: Meeting;
  selfId: string;
  privateWith?: { otherName: string; detail: string };
  access?: RoomAccess;
}) {
  const [peers, setPeers] = useState<PresencePeer[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [camError, setCamError] = useState("");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [guideOpen, setGuideOpen] = useState(false);
  const [timeDraft, setTimeDraft] = useState("");
  const [notice, setNotice] = useState("");
  const [joiningMedia, setJoiningMedia] = useState(false);
  const [streamReady, setStreamReady] = useState(false);
  const [remotes, setRemotes] = useState<Record<string, MediaStream>>({});
  const [denied, setDenied] = useState<RoomState | null>(access && access.state !== "open" ? access.state : null);
  const [roomCount, setRoomCount] = useState(access?.count ?? 0);
  const deniedRef = useRef<RoomState | null>(access && access.state !== "open" ? access.state : null);
  const localRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pcs = useRef(new Map<string, RTCPeerConnection>());
  const cursor = useRef("");
  const pendingIce = useRef(new Map<string, RTCIceCandidateInit[]>());

  useEffect(() => {
    const connections = pcs.current;
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      connections.forEach((pc) => pc.close());
      connections.clear();
      void leaveRoom({ data: { meetingId: meeting.id } });
    };
  }, [meeting.id]);

  async function startMedia() {
    setJoiningMedia(true);
    setCamError("");
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = media;
      if (localRef.current) localRef.current.srcObject = media;
      setMicOn(true);
      setCamOn(true);
      setStreamReady(true);
    } catch {
      try {
        const audio = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = audio;
        if (localRef.current) localRef.current.srcObject = audio;
        setMicOn(true);
        setCamOn(false);
        setStreamReady(true);
        setCamError("Camera is blocked. Your microphone is on, and chat still works.");
      } catch {
        setCamError("Camera and microphone stayed off. You can still stay for the sharing and chat. Tap the button again if you want to allow them.");
      }
    } finally {
      setJoiningMedia(false);
    }
  }

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
    const others = peers.filter((peer) => peer.userId !== selfId);
    const live = new Set(others.map((peer) => peer.userId));
    for (const [id, pc] of pcs.current) {
      if (!live.has(id)) {
        pc.close();
        pcs.current.delete(id);
        setRemotes((current) => {
          const next = { ...current };
          delete next[id];
          return next;
        });
      }
    }
    const stream = streamRef.current;
    if (!stream) return;
    for (const peer of others) {
      if (selfId >= peer.userId || pcs.current.has(peer.userId)) continue;
      void connect(peer.userId, true);
    }
    // Re-run when the camera arrives or the set of peers changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peers.map((peer) => peer.userId).join("|"), selfId, streamReady]);

  useEffect(() => {
    let stop = false;
    async function pull() {
      if (stop) return;
      try {
        const batch = await pollSignals({ data: { meetingId: meeting.id, after: cursor.current } });
        for (const signal of batch) {
          cursor.current = signal.id;
          let payload: Payload;
          try {
            payload = JSON.parse(signal.payload) as Payload;
          } catch {
            continue;
          }
          await accept(signal.fromId, payload);
        }
      } catch {
        /* next tick */
      }
    }
    const timer = window.setInterval(() => void pull(), 1200);
    void pull();
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
    // accept closes over refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting.id]);

  function ensurePc(remoteId: string) {
    const existing = pcs.current.get(remoteId);
    if (existing) return existing;
    const pc = new RTCPeerConnection({ iceServers: ICE });
    const stream = streamRef.current;
    stream?.getTracks().forEach((track) => pc.addTrack(track, stream));
    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      void postSignal({
        data: {
          meetingId: meeting.id,
          toId: remoteId,
          payload: JSON.stringify({ type: "ice", candidate: event.candidate.toJSON() } satisfies Payload),
        },
      });
    };
    pc.ontrack = (event) => {
      const incoming = event.streams[0];
      if (incoming) setRemotes((current) => ({ ...current, [remoteId]: incoming }));
    };
    pcs.current.set(remoteId, pc);
    return pc;
  }

  async function connect(remoteId: string, offer: boolean) {
    const pc = ensurePc(remoteId);
    if (!offer || pc.signalingState !== "stable") return;
    const description = await pc.createOffer();
    await pc.setLocalDescription(description);
    const local = pc.localDescription;
    if (!local) return;
    await postSignal({
      data: {
        meetingId: meeting.id,
        toId: remoteId,
        payload: JSON.stringify({
          type: "offer",
          sdp: { type: local.type, sdp: local.sdp },
        } satisfies Payload),
      },
    });
  }

  async function flushIce(remoteId: string, pc: RTCPeerConnection) {
    const queued = pendingIce.current.get(remoteId) ?? [];
    pendingIce.current.set(remoteId, []);
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(candidate);
      } catch {
        /* ignore late candidates */
      }
    }
  }

  async function accept(fromId: string, payload: Payload) {
    if (fromId === selfId) return;
    const pc = ensurePc(fromId);
    if (payload.type === "offer") {
      await pc.setRemoteDescription(payload.sdp);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await flushIce(fromId, pc);
      const local = pc.localDescription;
      if (!local) return;
      await postSignal({
        data: {
          meetingId: meeting.id,
          toId: fromId,
          payload: JSON.stringify({
            type: "answer",
            sdp: { type: local.type, sdp: local.sdp },
          } satisfies Payload),
        },
      });
      return;
    }
    if (payload.type === "answer") {
      if (pc.signalingState === "have-local-offer") {
        await pc.setRemoteDescription(payload.sdp);
        await flushIce(fromId, pc);
      }
      return;
    }
    if (!pc.remoteDescription) {
      const queue = pendingIce.current.get(fromId) ?? [];
      queue.push(payload.candidate);
      pendingIce.current.set(fromId, queue);
      return;
    }
    try {
      await pc.addIceCandidate(payload.candidate);
    } catch {
      /* duplicate */
    }
  }

  function toggleMic() {
    const next = !micOn;
    streamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = next;
    });
    setMicOn(next);
  }

  function toggleCam() {
    const next = !camOn;
    streamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = next;
    });
    setCamOn(next);
  }

  const starts = new Date(meeting.startsAt);
  const canReschedule = meeting.mine && starts.getTime() - Date.now() >= 48 * 60 * 60 * 1000;
  const others = peers.filter((peer) => peer.userId !== selfId);

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
          <h1 className="font-display text-3xl text-fg">{privateWith ? "Private video" : meeting.title}</h1>
          <p className="text-sm text-muted">
            {privateWith
              ? `${privateWith.otherName} · ${privateWith.detail}`
              : `${meeting.format} · ${starts.toLocaleString()} · ${meeting.leaderName}`}
          </p>
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <figure className="overflow-hidden rounded-lg border border-border bg-surface">
              <video ref={localRef} autoPlay playsInline muted className="aspect-video w-full bg-bg object-cover" />
              <figcaption className="px-3 py-2 text-sm text-muted">
                {streamReady
                  ? `You${!micOn ? " · muted" : ""}${!camOn ? " · camera off" : ""}`
                  : "You · camera and mic stay off until you turn them on"}
              </figcaption>
            </figure>
            {others.map((peer) => (
              <RemoteTile key={peer.userId} name={peer.displayName} stream={remotes[peer.userId]} />
            ))}
            {others.length === 0 && (
              <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed border-border px-6 text-center text-sm text-muted">
                {privateWith
                  ? `Waiting for ${privateWith.otherName}. Only the two of you can join this video.`
                  : "Waiting for others. Meetings can run any hour."}
              </div>
            )}
          </div>
          {camError && <p className="text-sm text-danger">{camError}</p>}
          <div className="flex flex-wrap gap-2">
            {!streamReady ? (
              <button
                type="button"
                onClick={() => void startMedia()}
                disabled={joiningMedia}
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-fg disabled:opacity-60"
              >
                <Video className="size-4" />
                {joiningMedia ? "Asking for camera…" : "Turn on camera and mic"}
              </button>
            ) : (
              <>
                <button type="button" onClick={toggleMic} className="inline-flex h-11 items-center gap-2 rounded-lg bg-surface-2 px-4 text-sm text-fg">
                  {micOn ? <Mic className="size-4" /> : <MicOff className="size-4" />}
                  {micOn ? "Mute" : "Unmute"}
                </button>
                <button type="button" onClick={toggleCam} className="inline-flex h-11 items-center gap-2 rounded-lg bg-surface-2 px-4 text-sm text-fg">
                  {camOn ? <Video className="size-4" /> : <VideoOff className="size-4" />}
                  {camOn ? "Camera off" : "Camera on"}
                </button>
              </>
            )}
          </div>
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

        <aside className="flex h-[32rem] flex-col rounded-lg border border-border bg-surface">
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

function RemoteTile({ name, stream }: { name: string; stream?: MediaStream }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream;
  }, [stream]);
  return (
    <figure className="overflow-hidden rounded-lg border border-border bg-surface">
      <video ref={ref} autoPlay playsInline className="aspect-video w-full bg-bg object-cover" />
      <figcaption className="px-3 py-2 text-sm text-muted">{stream ? name : `${name} · connecting`}</figcaption>
    </figure>
  );
}
