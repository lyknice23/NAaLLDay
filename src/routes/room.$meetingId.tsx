import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { LoginCard } from "@/components/login-card";
import { MeetingRoom } from "@/components/meeting-room";
import {
  getMe,
  getMeeting,
  getRoomAccess,
  type Meeting,
  type Profile,
  type RoomAccess,
} from "@/lib/meetings.functions";

export const Route = createFileRoute("/room/$meetingId")({ component: RoomPage });

function RoomPage() {
  const { meetingId } = Route.useParams();
  const { user, isPending } = useCurrentUserState();
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [meeting, setMeeting] = useState<Meeting | null | undefined>(undefined);
  const [access, setAccess] = useState<RoomAccess | null | undefined>(undefined);
  const userId = user?.id;

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
    getMeeting({ data: { id: meetingId } })
      .then((row) => {
        if (!cancelled) setMeeting(row);
      })
      .catch(() => {
        if (!cancelled) setMeeting(null);
      });
    getRoomAccess({ data: { id: meetingId } })
      .then((row) => {
        if (!cancelled) setAccess(row);
      })
      .catch(() => {
        if (!cancelled) setAccess(null);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, meetingId]);

  if (isPending || (user && (profile === undefined || meeting === undefined || access === undefined))) {
    return (
      <main className="grid min-h-screen place-items-center">
        <p className="text-muted">Joining the meeting…</p>
      </main>
    );
  }
  if (!user) return <LoginCard />;
  if (!profile) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <p className="text-fg">Set a first name on the home page before joining.</p>
        <Link to="/" className="mt-4 inline-block text-primary">
          Back
        </Link>
      </main>
    );
  }
  if (!meeting) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <p className="text-fg">That meeting is not on the board.</p>
        <Link to="/" className="mt-4 inline-block text-primary">
          All meetings
        </Link>
      </main>
    );
  }
  return <MeetingRoom meeting={meeting} selfId={user.id} access={access ?? undefined} />;
}
