import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { authClient } from "@/lib/auth/client";

type ResetSearch = { token?: string; error?: string };

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search: Record<string, unknown>): ResetSearch => ({
    token: typeof search.token === "string" ? search.token : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { token, error: linkError } = Route.useSearch();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      if (!token) throw new Error("This reset link is missing its token.");
      if (password.length < 8) {
        throw new Error("Use at least 8 characters for your new password.");
      }
      if (password !== confirm) throw new Error("The passwords do not match.");
      const { error: resetError } = await authClient.resetPassword({
        newPassword: password,
        token,
      });
      if (resetError) {
        throw new Error(resetError.message ?? "This reset link is invalid or expired.");
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setPending(false);
    }
  }

  if (!token || linkError) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
        <p className="text-sm font-medium tracking-wide text-primary">ALL DAY NA</p>
        <h1 className="mt-3 font-display text-4xl leading-tight text-fg">
          This link is not valid.
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          Reset links expire after one hour and can only be used once.
        </p>
        <Link
          to="/forgot-password"
          className="mt-8 inline-flex h-12 items-center justify-center rounded-lg bg-primary px-4 font-semibold text-primary-fg"
        >
          Request a new link
        </Link>
      </main>
    );
  }

  if (done) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
        <p className="text-sm font-medium tracking-wide text-primary">ALL DAY NA</p>
        <h1 className="mt-3 font-display text-4xl leading-tight text-fg">Password updated.</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          You can now sign in with your new password. Other sessions have been signed out.
        </p>
        <Link
          to="/login"
          className="mt-8 inline-flex h-12 items-center justify-center rounded-lg bg-primary px-4 font-semibold text-primary-fg"
        >
          Sign in
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
      <p className="text-sm font-medium tracking-wide text-primary">ALL DAY NA</p>
      <h1 className="mt-3 font-display text-4xl leading-tight text-fg">Choose a new password.</h1>
      <p className="mt-4 text-lg leading-relaxed text-muted">
        Use at least 8 characters. Signing in everywhere else will need the new password.
      </p>

      <form className="mt-8 space-y-3" onSubmit={submit}>
        <label className="block text-sm text-muted">
          New password
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 h-12 w-full rounded-lg border border-border bg-surface px-3 text-fg"
          />
        </label>
        <label className="block text-sm text-muted">
          Confirm new password
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
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="h-12 w-full rounded-lg bg-primary px-4 font-semibold text-primary-fg disabled:opacity-60"
        >
          {pending ? "Updating…" : "Update password"}
        </button>
      </form>

      <Link to="/login" className="mt-6 text-sm text-primary underline-offset-4 hover:underline">
        Back to sign in
      </Link>
    </main>
  );
}
