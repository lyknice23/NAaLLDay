import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { OnboardingLayout } from "@/components/onboarding-layout";
import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
  onboardingPath,
} from "@/lib/onboarding";
import { acceptTerms } from "@/lib/onboarding.functions";
import { useOnboarding } from "@/lib/use-onboarding";

export const Route = createFileRoute("/onboarding/terms")({
  component: TermsPage,
});

function PolicyLink({
  to,
  children,
}: {
  to: "/terms" | "/privacy";
  children: string;
}) {
  return (
    <Link
      to={to}
      target="_blank"
      rel="noreferrer"
      className="mt-4 inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
    >
      {children} <span aria-hidden="true" className="ml-1">↗</span>
    </Link>
  );
}

function TermsPage() {
  const navigate = useNavigate();
  const { user, isPending, state, loading, refresh } = useOnboarding();
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
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

  const existingTermsAccepted = state?.termsAccepted ?? false;
  const existingPrivacyAccepted = state?.privacyAccepted ?? false;

  useEffect(() => {
    setAcceptedTerms(existingTermsAccepted);
    setAcceptedPrivacy(existingPrivacyAccepted);
  }, [existingTermsAccepted, existingPrivacyAccepted]);

  async function submit() {
    if (!acceptedTerms || !acceptedPrivacy) {
      setError(
        "Please agree to both the Terms of Service and the Privacy Policy to continue.",
      );
      return;
    }
    setError("");
    setPending(true);
    try {
      const result = await acceptTerms({
        data: { terms: acceptedTerms, privacy: acceptedPrivacy },
      });
      if (!result.ok) {
        setError(result.error);
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
        <p className="text-muted">Opening the policies…</p>
      </main>
    );
  }

  return (
    <OnboardingLayout
      step={1}
      eyebrow="Before you enter"
      title="Terms and privacy"
      subtitle="Read both policies and agree to each one before joining the rooms."
    >
      <div className="space-y-4">
        <section
          aria-labelledby="terms-heading"
          className="rounded-xl border border-border bg-surface p-5"
        >
          <div className="flex items-start justify-between gap-3">
            <h2 id="terms-heading" className="font-display text-xl text-fg">
              Terms of use
            </h2>
            <span className="shrink-0 rounded-full bg-bg px-2.5 py-1 text-xs text-muted">
              {CURRENT_TERMS_VERSION}
            </span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-fg">
            ALL DAY NA is a peer-support space for people who want
            Narcotics-Anonymous-style meetings online. It is not a treatment
            provider, a crisis service, or an emergency line. If you are in
            immediate danger, contact local emergency services.
          </p>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
            <li>
              Be respectful in meetings and private conversations. Do not record,
              screenshot, or share what someone shares here.
            </li>
            <li>
              Use a first name or a name you are comfortable being called. Do not
              post someone else’s personal information.
            </li>
            <li>
              Sponsor availability and clean time are self-reported. ALL DAY NA
              cannot verify them, so use your own judgment.
            </li>
            <li>
              Keep your password private. We may suspend access for harmful
              behavior or misuse of the service.
            </li>
          </ul>
          <PolicyLink to="/terms">Read the full Terms of Service</PolicyLink>
          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-bg p-3 text-sm leading-relaxed text-fg">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(event) => setAcceptedTerms(event.target.checked)}
              className="mt-1"
            />
            <span>
              <span className="font-medium">I agree to the Terms of Service.</span>
              <span className="mt-0.5 block text-muted">
                I have read and accept the rules above.
              </span>
            </span>
          </label>
        </section>

        <section
          aria-labelledby="privacy-heading"
          className="rounded-xl border border-border bg-surface p-5"
        >
          <div className="flex items-start justify-between gap-3">
            <h2 id="privacy-heading" className="font-display text-xl text-fg">
              Privacy Policy
            </h2>
            <span className="shrink-0 rounded-full bg-bg px-2.5 py-1 text-xs text-muted">
              {CURRENT_PRIVACY_VERSION}
            </span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-fg">
            We collect the information you give us — your email, account and
            profile details, and the journal, room, sponsor, and milestone content
            you choose to share — plus basic technical information needed to run
            the service.
          </p>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
            <li>
              We use it to run meetings, video rooms, chat, sponsor connections,
              your journal, and account security.
            </li>
            <li>
              We do not sell your personal information or use advertising trackers.
              We share it only with the providers that host and operate ALL DAY NA,
              or when the law requires it.
            </li>
            <li>
              Audio and video are relayed through LiveKit Cloud and are not recorded
              by ALL DAY NA. Other people in a room can still see and hear what you
              share.
            </li>
            <li>
              You can ask to access or delete your account data by emailing{" "}
              <a
                href="mailto:support@alldayna.xyz"
                className="text-primary underline-offset-4 hover:underline"
              >
                support@alldayna.xyz
              </a>
              .
            </li>
          </ul>
          <PolicyLink to="/privacy">Read the full Privacy Policy</PolicyLink>
          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-bg p-3 text-sm leading-relaxed text-fg">
            <input
              type="checkbox"
              checked={acceptedPrivacy}
              onChange={(event) => setAcceptedPrivacy(event.target.checked)}
              className="mt-1"
            />
            <span>
              <span className="font-medium">I agree to the Privacy Policy.</span>
              <span className="mt-0.5 block text-muted">
                I have read how my information is collected, used, and shared.
              </span>
            </span>
          </label>
        </section>
      </div>

      {error ? (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        disabled={pending || !acceptedTerms || !acceptedPrivacy}
        onClick={() => void submit()}
        className="mt-6 h-12 w-full rounded-lg bg-primary px-4 font-semibold text-primary-fg disabled:opacity-60"
      >
        {pending ? "Saving…" : "Agree to both and continue"}
      </button>
      <p className="mt-3 text-center text-xs leading-relaxed text-muted">
        You need to agree to both policies to use ALL DAY NA.
      </p>
    </OnboardingLayout>
  );
}
