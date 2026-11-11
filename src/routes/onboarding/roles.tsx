import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { OnboardingLayout } from "@/components/onboarding-layout";
import { cleanTimeLabel, onboardingPath } from "@/lib/onboarding";
import { saveOnboardingRoles } from "@/lib/onboarding.functions";
import { useOnboarding } from "@/lib/use-onboarding";

export const Route = createFileRoute("/onboarding/roles")({
  component: RolesPage,
});

function Choice({
  selected,
  disabled,
  title,
  detail,
  onClick,
}: {
  selected: boolean;
  disabled?: boolean;
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`w-full rounded-lg border p-4 text-left disabled:cursor-not-allowed disabled:opacity-50 ${
        selected
          ? "border-primary bg-surface-2"
          : "border-border bg-surface hover:border-primary/60"
      }`}
    >
      <span className="flex items-center justify-between gap-3">
        <span className="font-semibold text-fg">{title}</span>
        <span
          className={`grid h-5 w-5 place-items-center rounded-full border text-xs ${
            selected ? "border-primary bg-primary text-primary-fg" : "border-border text-transparent"
          }`}
          aria-hidden="true"
        >
          ✓
        </span>
      </span>
      <span className="mt-1 block text-sm leading-relaxed text-muted">{detail}</span>
    </button>
  );
}

function RolesPage() {
  const navigate = useNavigate();
  const { user, isPending, state, loading, refresh } = useOnboarding();
  const [wantsLeader, setWantsLeader] = useState(false);
  const [wantsSponsor, setWantsSponsor] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const savedRole = state?.profile?.role;
  const savedSponsor = state?.profile?.wantsSponsor;
  const canSponsor = state?.profile?.canSponsor ?? false;

  useEffect(() => {
    if (savedRole !== undefined) setWantsLeader(savedRole === "leader");
    if (savedSponsor !== undefined) setWantsSponsor(savedSponsor && canSponsor);
  }, [savedRole, savedSponsor, canSponsor]);

  useEffect(() => {
    if (isPending || loading) return;
    if (!user) {
      void navigate({ to: "/login" });
      return;
    }
    if (!state) return;
    if (state.step !== "roles") {
      void navigate({ to: onboardingPath(state.step) });
    }
  }, [isPending, loading, user, state, navigate]);

  async function submit() {
    setError("");
    setPending(true);
    try {
      const result = await saveOnboardingRoles({
        data: { wantsLeader, wantsSponsor },
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await refresh();
      await navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your roles.");
    } finally {
      setPending(false);
    }
  }

  if (loading && !state) {
    return (
      <main className="grid min-h-screen place-items-center px-6">
        <p className="text-muted">Opening role choices…</p>
      </main>
    );
  }

  const cleanLabel = state?.profile ? cleanTimeLabel(state.profile.cleanDays) : "";

  return (
    <OnboardingLayout
      step={3}
      eyebrow="How you’ll take part"
      title="Choose your roles."
      subtitle="You can lead meetings, sponsor someone, or both. You can also just attend."
    >
      <div className="space-y-3">
        <Choice
          selected={wantsLeader}
          title="Leader"
          detail="Schedule meetings, open your room, and guide at least 3 meetings a week after your first week."
          onClick={() => setWantsLeader((value) => !value)}
        />
        <Choice
          selected={wantsSponsor}
          disabled={!canSponsor}
          title="Sponsor"
          detail={
            canSponsor
              ? "Be available for private video conversations during a 12-hour daily window. Requires at least 2 years clean."
              : "Sponsor access needs at least 2 years clean. You can still attend or lead, and add a clean date in your journal later."
          }
          onClick={() => setWantsSponsor((value) => !value)}
        />
        <button
          type="button"
          onClick={() => {
            setWantsLeader(false);
            setWantsSponsor(false);
          }}
          className={`w-full rounded-lg border p-4 text-left ${
            !wantsLeader && !wantsSponsor
              ? "border-primary bg-surface-2"
              : "border-border bg-surface hover:border-primary/60"
          }`}
        >
          <span className="font-semibold text-fg">Just attendee</span>
          <span className="mt-1 block text-sm leading-relaxed text-muted">
            Join meetings, keep a journal, and connect with a sponsor.
          </span>
        </button>
      </div>

      <p className="mt-4 text-sm text-muted">
        {state?.profile?.cleanSince
          ? `Your clean time: ${cleanLabel}.`
          : "You didn’t enter clean time, so sponsor access is unavailable for now."}
      </p>
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      <button
        type="button"
        disabled={pending}
        onClick={() => void submit()}
        className="mt-6 h-12 w-full rounded-lg bg-primary px-4 font-semibold text-primary-fg disabled:opacity-60"
      >
        {pending ? "Saving…" : "Enter ALL DAY NA"}
      </button>
    </OnboardingLayout>
  );
}
