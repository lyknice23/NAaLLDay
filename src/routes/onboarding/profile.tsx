import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { OnboardingLayout } from "@/components/onboarding-layout";
import { onboardingPath } from "@/lib/onboarding";
import { saveOnboardingProfile } from "@/lib/onboarding.functions";
import { useOnboarding } from "@/lib/use-onboarding";

export const Route = createFileRoute("/onboarding/profile")({
  component: ProfilePage,
});

const TODAY = new Date().toISOString().slice(0, 10);

function ProfilePage() {
  const navigate = useNavigate();
  const { user, isPending, state, loading, refresh } = useOnboarding();
  const [displayName, setDisplayName] = useState("");
  const [cleanDate, setCleanDate] = useState("");
  const [noCleanTime, setNoCleanTime] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const savedName = state?.profile?.displayName;
  const savedCleanDate = state?.profile?.cleanSince;

  useEffect(() => {
    if (savedName !== undefined) setDisplayName(savedName);
    if (savedCleanDate !== undefined) {
      setCleanDate(savedCleanDate ?? "");
      setNoCleanTime(!savedCleanDate);
    }
  }, [savedName, savedCleanDate]);

  useEffect(() => {
    if (isPending || loading) return;
    if (!user) {
      void navigate({ to: "/login" });
      return;
    }
    if (!state) return;
    if (state.step === "verify-email" || state.step === "terms") {
      void navigate({ to: onboardingPath(state.step) });
      return;
    }
    if (state.step === "roles" || state.step === "complete") {
      void navigate({ to: onboardingPath(state.step) });
    }
  }, [isPending, loading, user, state, navigate]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!noCleanTime && !cleanDate) {
      setError("Add a clean date, or check that you don’t have one yet.");
      return;
    }
    setPending(true);
    try {
      const result = await saveOnboardingProfile({
        data: {
          displayName,
          cleanDate: noCleanTime ? null : cleanDate,
        },
      });
      if (!result.ok) {
        setError("Could not save that. Try again.");
        return;
      }
      await refresh();
      await navigate({ to: "/onboarding/roles" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that.");
    } finally {
      setPending(false);
    }
  }

  if (loading && !state) {
    return (
      <main className="grid min-h-screen place-items-center px-6">
        <p className="text-muted">Opening your profile…</p>
      </main>
    );
  }

  return (
    <OnboardingLayout
      step={2}
      eyebrow="About you"
      title="What should we call you?"
      subtitle="This is the name other people will see in meetings. A first name is enough."
    >
      <form className="space-y-5" onSubmit={submit}>
        <label className="block text-sm text-muted">
          Name
          <input
            required
            maxLength={40}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="First name or nickname"
            className="mt-1 h-12 w-full rounded-lg border border-border bg-surface px-3 text-fg"
          />
        </label>

        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-sm font-medium text-fg">Clean time</p>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            This is optional. It helps us show the right support options. You
            can change it later in your journal.
          </p>
          <label className="mt-4 flex items-start gap-3 text-sm text-fg">
            <input
              type="checkbox"
              checked={noCleanTime}
              onChange={(event) => {
                setNoCleanTime(event.target.checked);
                if (event.target.checked) setCleanDate("");
              }}
              className="mt-1"
            />
            <span>I don’t have clean time yet.</span>
          </label>
          <label className="mt-4 block text-sm text-muted">
            Clean date
            <input
              type="date"
              max={TODAY}
              min="1900-01-01"
              disabled={noCleanTime}
              value={cleanDate}
              onChange={(event) => setCleanDate(event.target.value)}
              className="mt-1 h-12 w-full rounded-lg border border-border bg-bg px-3 text-fg disabled:opacity-50"
            />
          </label>
        </div>

        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="h-12 w-full rounded-lg bg-primary px-4 font-semibold text-primary-fg disabled:opacity-60"
        >
          {pending ? "Saving…" : "Continue"}
        </button>
      </form>
    </OnboardingLayout>
  );
}
