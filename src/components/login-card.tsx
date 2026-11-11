import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  GROK_PROVIDERS,
  authClient,
  keepLocalSessionToken,
  signIn,
} from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { onboardingPath } from "@/lib/onboarding";
import { getOnboardingState, requestEmailCode } from "@/lib/onboarding.functions";

type Mode = "signin" | "signup";

function remember(key: string, value: string) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}

export function LoginCard() {
  const navigate = useNavigate();
  const { user } = useCurrentUserState();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [providerPending, setProviderPending] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    const cleanEmail = email.trim().toLowerCase();
    try {
      if (!cleanEmail) throw new Error("Enter your email address.");
      if (password.length < 8) throw new Error("Use at least 8 characters for your password.");

      if (mode === "signup") {
        if (password !== confirm) throw new Error("The passwords do not match.");
        const { error: signUpError } = await authClient.signUp.email({
          email: cleanEmail,
          password,
          name: cleanEmail.split("@")[0] || "Member",
        });
        if (signUpError) {
          throw new Error(signUpError.message ?? "Could not create your account.");
        }
        // Sign-up does not always establish a session in this setup. A normal
        // sign-in also gives us the local-preview bearer token when loopback
        // cookies are unavailable.
        const { data: signInData, error: signInError } = await authClient.signIn.email({
          email: cleanEmail,
          password,
        });
        if (signInError) {
          throw new Error(signInError.message ?? "Could not sign you in after creating the account.");
        }
        keepLocalSessionToken(signInData?.token ?? null);
        const session = await authClient.getSession();
        if (!session.data?.user) {
          throw new Error("Could not start your session. Try signing in again.");
        }
        const sent = await requestEmailCode();
        if (!sent.ok) remember("verify-problem", sent.error);
        else if (sent.devCode) remember("verify-dev-code", sent.devCode);
        const next = await getOnboardingState();
        await navigate({ to: onboardingPath(next.step) });
        return;
      }

      const { data: signInData, error: signInError } = await authClient.signIn.email({
        email: cleanEmail,
        password,
      });
      if (signInError) {
        throw new Error(signInError.message ?? "Email or password is not right.");
      }
      keepLocalSessionToken(signInData?.token ?? null);
      const session = await authClient.getSession();
      if (!session.data?.user) {
        throw new Error("Could not start your session. Try again.");
      }
      const next = await getOnboardingState();
      await navigate({ to: onboardingPath(next.step) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
      <p className="text-sm font-medium tracking-wide text-primary">ALL DAY NA</p>
      <h1 className="mt-3 font-display text-4xl leading-tight text-fg">
        Meetings that stay open.
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-muted">
        Create an account with your email, or sign back in. First names only
        inside the rooms.
      </p>

      {user ? (
        <p className="mt-6 rounded-lg border border-border bg-surface-2 px-4 py-3 text-sm text-fg">
          You are already signed in.{" "}
          <Link to="/" className="text-primary underline-offset-4 hover:underline">
            Go to the meetings
          </Link>
          .
        </p>
      ) : null}

      <div className="mt-8 grid grid-cols-2 gap-2 rounded-lg border border-border bg-surface-2 p-1">
        {(["signin", "signup"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => {
              setMode(item);
              setError("");
            }}
            className={`h-11 rounded-md text-sm font-semibold ${
              mode === item ? "bg-surface text-fg shadow-sm" : "text-muted"
            }`}
          >
            {item === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <form className="mt-5 space-y-3" onSubmit={submit}>
        <label className="block text-sm text-muted">
          Email
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 h-12 w-full rounded-lg border border-border bg-surface px-3 text-fg"
          />
        </label>
        <label className="block text-sm text-muted">
          Password
          <input
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 h-12 w-full rounded-lg border border-border bg-surface px-3 text-fg"
          />
        </label>
        {mode === "signup" ? (
          <label className="block text-sm text-muted">
            Confirm password
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              className="mt-1 h-12 w-full rounded-lg border border-border bg-surface px-3 text-fg"
            />
          </label>
        ) : null}
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="h-12 w-full rounded-lg bg-primary px-4 font-semibold text-primary-fg disabled:opacity-60"
        >
          {pending
            ? mode === "signup"
              ? "Creating account…"
              : "Signing in…"
            : mode === "signup"
              ? "Create account"
              : "Sign in"}
        </button>
      </form>

      {mode === "signup" ? (
        <p className="mt-3 text-sm leading-relaxed text-muted">
          We’ll email you a 6-digit code. Next you’ll review the terms, choose a
          name, and tell us how you want to take part.
        </p>
      ) : null}

      <div className="mt-8 flex items-center gap-3 text-xs uppercase tracking-wide text-muted">
        <span className="h-px flex-1 bg-border" />
        or continue with
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="mt-4 flex flex-col gap-2">
        {GROK_PROVIDERS.map((provider) => (
          <button
            key={provider.providerId}
            type="button"
            disabled={providerPending !== null || pending}
            onClick={() => {
              setError("");
              setProviderPending(provider.providerId);
              void signIn(provider.providerId, { callbackURL: "/" })
                .catch((err: unknown) => {
                  setError(
                    err instanceof Error ? err.message : "Sign-in failed. Try again.",
                  );
                })
                .finally(() => setProviderPending(null));
            }}
            className="h-11 rounded-lg border border-border px-4 text-sm font-semibold text-fg disabled:opacity-60"
          >
            {providerPending === provider.providerId
              ? "Opening sign-in…"
              : `Continue with ${provider.label}`}
          </button>
        ))}
      </div>

      <Link
        to="/help"
        className="mt-6 text-sm text-primary underline-offset-4 hover:underline"
      >
        Need treatment now? Find a rehab with SAMHSA
      </Link>
      <p className="mt-8 text-sm leading-relaxed text-muted">
        Independent tool for people who want Narcotics Anonymous style meetings
        online. Not affiliated with Narcotics Anonymous World Services.
      </p>
    </main>
  );
}
