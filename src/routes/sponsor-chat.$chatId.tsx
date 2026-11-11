import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { LoginCard } from "@/components/login-card";
import { MeetingRoom } from "@/components/meeting-room";
import { windowLabel } from "@/lib/sponsor-windows";
import { getMe, getSponsorChat, type Meeting, type Profile, type SponsorChatSummary } from "@/lib/meetings.functions";

export const Route = createFileRoute("/sponsor-chat/$chatId")({ component: SponsorChatPage });

function SponsorChatPage() {
  const { chatId } = Route.useParams();
  const { user, isPending } = useCurrentUserState();
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [chat, setChat] = useState<SponsorChatSummary | null | undefined>(undefined);
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
    getSponsorChat({ data: { id: chatId } })
      .then((row) => {
        if (!cancelled) setChat(row);
      })
      .catch(() => {
        if (!cancelled) setChat(null);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, chatId]);

  if (isPending || (user && (profile === undefined || chat === undefined))) {
    return (
      <main className="grid min-h-screen place-items-center">
        <p className="text-muted">Opening the private video…</p>
      </main>
    );
  }
  if (!user) return <LoginCard />;
  if (!profile) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <p className="text-fg">Set a first name on the home page first.</p>
        <Link to="/" className="mt-4 inline-block text-primary">
          Back
        </Link>
      </main>
    );
  }
  if (!chat) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <p className="text-fg">That private conversation is not yours.</p>
        <Link to="/sponsors" className="mt-4 inline-block text-primary">
          Sponsors
        </Link>
      </main>
    );
  }

  const meeting: Meeting = {
    id: chat.id,
    leaderId: "",
    leaderName: chat.otherName,
    title: "Private video",
    format: "Sponsor",
    description: "",
    startsAt: new Date().toISOString(),
    endsAt: new Date().toISOString(),
    hosted: false,
    attended: false,
    mine: false,
    signedUp: false,
  };

  return (
    <MeetingRoom
      meeting={meeting}
      selfId={user.id}
      privateWith={{
        otherName: chat.otherName,
        detail: chat.youAreSponsor
          ? "You are the sponsor. Only the two of you are here."
          : `${chat.yearsClean ?? "?"} years clean · available ${windowLabel(chat.windowStart)}`,
      }}
    />
  );
}
