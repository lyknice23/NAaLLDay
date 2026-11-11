import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { signOut } from "@/lib/auth/client";
import { onboardingPath } from "@/lib/onboarding";
import { requestEmailCode, verifyEmailCode } from "@/lib/onboarding.functions";
import { useOnboarding } from "@/lib/use-onboarding";

export const Route = createFileRoute("/verify-email")({
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const navigate = useNavigate();
  const { user, isPending, state, loading, refresh } = useOnboarding();
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    try {
      const problem = window.sessionStorage.getItem("verify-problem");
      if (problem) {
        setError(problem);
        window.sessionStorage.removeItem("verify-problem");
      }
      const saved = window.sessionStorage.getItem("verify-dev-code");
      if (saved) setDevCode(saved);
    } catch {
      /* storage unavailable */
    }
  }, []);

  useEffect(() => {
    if (isPending) return;
    if (!user) {
      void navigate({ to: "/login" });
      return;
    }
    if (state && state.step !== "verify-email") {
      void navigate({ to: onboardingPath(state.step) });
    }
  }, [isPending, user, state, navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(
      () => setCooldown((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function resend() {
    setError("");
    setMessage("");
    setSending(true);
    try {
      const result = await requestEmailCode();
      if (!result.ok) {
        setError(result.error);
        if (result.retryAfter) setCooldown(result.retryAfter);
        return;
      }
      if ("alreadyVerified" in result && result.alreadyVerified) {
        await refresh();
        await navigate({ to: "/onboarding/terms" });
        return;
      }
      if (result.devCode) {
        setDevCode(result.devCode);
        try {
          window.sessionStorage.setItem("verify-dev-code", result.devCode);
        } catch {
          /* storage unavailable */
        }
      }
      setMessage("A new code is on its way.");
      setCooldown(result.retryAfter ?? 60);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send a new code.");
    } finally {
      setSending(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setPending(true);
    try {
      const result = await verifyEmailCode({ data: { code } });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      try {
        window.sessionStorage.removeItem("verify-dev-code");
      } catch {
        /* storage unavailable */
      }
      await refresh();
      const next = result.state?.step ?? "terms";
      await navigate({ to: onboardingPath(next) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify that code.");
    } finally {
      setPending(false);
    }
  }

  if (loading && !state) {
    return (
      <main className="grid min-h-screen place-items-center px-6">
        <p className="text-muted">Opening verification…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
      <p className="text-sm font-medium tracking-wide text-primary">ALL DAY NA</p>
      <h1 className="mt-3 font-display text-4xl leading-tight text-fg">
        Check your email.
      </h1>
      <p className="mt-4 text-base leading-relaxed text-muted">
        We sent a 6-digit code to{" "}
        <span className="text-fg">{state?.email ?? user?.primaryEmail ?? "your email"}</span>.
        Enter it below to continue. The code expires in 10 minutes.
      </p>

      <form className="mt-8 space-y-3" onSubmit={submit}>
        <label className="block text-sm text-muted">
          Verification code
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            required
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            className="mt-1 h-14 w-full rounded-lg border border-border bg-surface px-3 text-center font-display text-2xl tracking-[0.4em] text-fg"
          />
        </label>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {message ? <p className="text-sm text-primary">{message}</p> : null}
        {devCode ? (
          <p className="rounded-lg border border-border bg-surface-2 px-4 py-3 text-sm text-muted">
            Local preview code: <span className="font-semibold text-fg">{devCode}</span>
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending || code.length !== 6}
          className="h-12 w-full rounded-lg bg-primary px-4 font-semibold text-primary-fg disabled:opacity-60"
        >
          {pending ? "Verifying…" : "Verify email"}
        </button>
      </form>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
        <button
          type="button"
          disabled={sending || cooldown > 0}
          onClick={() => void resend()}
          className="text-primary underline-offset-4 hover:underline disabled:text-muted disabled:no-underline"
        >
          {sending
            ? "Sending…"
            : cooldown > 0
              ? `Resend in ${cooldown}s`
              : "Resend code"}
        </button>
        <button
          type="button"
          onClick={() => void signOut("/login")}
          className="text-muted underline-offset-4 hover:underline"
        >
          Use another account
        </button>
      </div>
    </main>
  );
}
