import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { AppHeader } from "@/components/app-header";
import { getMe, type Profile } from "@/lib/meetings.functions";

const LOCATOR = "https://www.samhsa.gov/find-help/locators";

export const Route = createFileRoute("/help")({ component: HelpPage });

function HelpPage() {
  const { user, isPending } = useCurrentUserState();
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
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
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (isPending || (user && profile === undefined)) {
    return (
      <main className="grid min-h-screen place-items-center">
        <p className="text-muted">Opening find help…</p>
      </main>
    );
  }
  return (
    <div className="min-h-screen">
      {profile ? (
        <AppHeader profile={profile} />
      ) : (
        <header className="border-b border-border">
          <div className="mx-auto flex max-w-5xl items-center px-4 py-4">
            <Link to="/" className="font-display text-xl text-fg">
              ALL DAY NA
            </Link>
          </div>
        </header>
      )}
      <main className="mx-auto max-w-xl px-4 py-10">
        <p className="text-sm font-medium text-primary">If you need treatment</p>
        <h1 className="mt-2 font-display text-4xl text-fg">Find a rehab</h1>
        <p className="mt-4 text-muted">
          SAMHSA keeps a public list of treatment programs. You can search there for a rehab, then call the place yourself. ALL DAY NA does not run these programs, and a listing is not a promise of a bed.
        </p>
        <a
          href={LOCATOR}
          target="_blank"
          rel="noreferrer"
          className="mt-8 flex h-12 items-center justify-center rounded-lg bg-primary px-4 font-semibold text-primary-fg"
        >
          Look up treatment on SAMHSA
        </a>
        <p className="mt-3 break-all text-sm text-muted">{LOCATOR}</p>
      </main>
    </div>
  );
}
