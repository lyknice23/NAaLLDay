import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { OnboardingLayout } from "@/components/onboarding-layout";
import { CURRENT_TERMS_VERSION, onboardingPath } from "@/lib/onboarding";
import { acceptTerms } from "@/lib/onboarding.functions";
import { useOnboarding } from "@/lib/use-onboarding";

export const Route = createFileRoute("/onboarding/terms")({
  component: TermsPage,
});

function TermsPage() {
  const navigate = useNavigate();
  const { user, isPending, state, loading, refresh } = useOnboarding();
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (isPending || loading) return;
    if (!user) {
      void navigate({ to: "/login" });
      return;
    }
    if (!state) return;
    if (state.step !== "terms") {
      void navigate({ to: onboardingPath(state.step) });
    }
  }, [isPending, loading, user, state, navigate]);

  async function submit() {
    if (!accepted) {
      setError("Please accept the terms to continue.");
      return;
    }
    setError("");
    setPending(true);
    try {
      const result = await acceptTerms();
      if (!result.ok) {
        setError("Could not save your acceptance. Try again.");
        return;
      }
      await refresh();
      await navigate({ to: onboardingPath(result.state.step) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your acceptance.");
    } finally {
      setPending(false);
    }
  }

  if (loading && !state) {
    return (
      <main className="grid min-h-screen place-items-center px-6">
        <p className="text-muted">Opening the terms…</p>
      </main>
    );
  }

  return (
    <OnboardingLayout
      step={1}
      eyebrow="Before you enter"
      title="Terms of use"
      subtitle="Please read this before joining the rooms."
    >
      <div className="space-y-4 rounded-lg border border-border bg-surface p-5 text-sm leading-relaxed text-fg">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          Version {CURRENT_TERMS_VERSION}
        </p>
        <p>
          ALL DAY NA is a peer-support space for people who want
          Narcotics-Anonymous-style meetings online. It is not a treatment
          provider, a crisis service, or an emergency line. If you are in
          immediate danger, contact local emergency services.
        </p>
        <p>
          Be respectful of other people in meetings and private conversations.
          Do not record, screenshot, or share what someone shares here. Use a
          first name or a name you are comfortable being called. Do not post
          someone else’s personal information.
        </p>
        <p>
          Sponsor availability and clean time are self-reported. ALL DAY NA
          cannot verify them. Please be honest, and use your own judgment when
          connecting with someone.
        </p>
        <p>
          You are responsible for keeping your account password private and for
          what happens under your account. We may suspend access for harmful
          behavior or misuse of the service.
        </p>
        <p className="text-muted">
          These terms are being finalized. By accepting, you agree to the
          expectations above and to review the final terms when they are
          published.
        </p>
      </div>

      <label className="mt-6 flex items-start gap-3 text-sm leading-relaxed text-fg">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(event) => setAccepted(event.target.checked)}
          className="mt-1"
        />
        <span>I have read and agree to these terms of use.</span>
      </label>
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      <button
        type="button"
        disabled={pending || !accepted}
        onClick={() => void submit()}
        className="mt-6 h-12 w-full rounded-lg bg-primary px-4 font-semibold text-primary-fg disabled:opacity-60"
      >
        {pending ? "Saving…" : "Accept and continue"}
      </button>
    </OnboardingLayout>
  );
}
