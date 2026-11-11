import { Link } from "@tanstack/react-router";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { useUnreadCount } from "@/lib/alerts-store";
import type { Profile } from "@/lib/meetings.functions";

export function AppHeader({ profile }: { profile: Profile }) {
  const account = useCurrentUser();
  const unread = useUnreadCount();
  const leading = profile.role === "leader" && !profile.leaderBanned;
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 pb-4 pt-10">
        <Link to="/" className="shrink-0 whitespace-nowrap font-display text-xl text-fg">
          ALL DAY NA
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-1 sm:gap-2">
          <Link to="/" className="rounded-lg px-3 py-2 text-sm text-muted hover:text-fg">
            Meetings
          </Link>
          <Link to="/journal" className="rounded-lg px-3 py-2 text-sm text-muted hover:text-fg">
            Journal
          </Link>
          <Link to="/sponsors" className="rounded-lg px-3 py-2 text-sm text-muted hover:text-fg">
            Sponsors
          </Link>
          <Link to="/help" className="rounded-lg px-3 py-2 text-sm text-muted hover:text-fg">
            Rehabs
          </Link>
          <Link to="/notifications" className="rounded-lg px-3 py-2 text-sm text-muted hover:text-fg">
            Alerts
            {unread > 0 ? <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-semibold text-primary-fg">{unread}</span> : null}
          </Link>
          <span className="text-sm text-fg">
            {profile.displayName}
            <span className="text-muted">
              {" "}
              · {leading ? "Leader" : "Attendee"}
              {profile.wantsSponsor ? " · Sponsor" : ""}
            </span>
          </span>
          {account && !account.isDevFallback && <UserButton />}
        </nav>
      </div>
    </header>
  );
}