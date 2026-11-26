import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { authClient } from "@/lib/auth/client";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail) throw new Error("Enter your email address.");
      const { error: resetError } = await authClient.requestPasswordReset({
        email: cleanEmail,
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetError) {
        throw new Error(resetError.message ?? "Could not send the reset email.");
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
      <p className="text-sm font-medium tracking-wide text-primary">ALL DAY NA</p>
      <h1 className="mt-3 font-display text-4xl leading-tight text-fg">Reset your password.</h1>
      <p className="mt-4 text-lg leading-relaxed text-muted">
        Enter the email you use for ALL DAY NA and we will send a one-time reset link. It expires in
        one hour.
      </p>

      {sent ? (
        <div className="mt-8 rounded-lg border border-border bg-surface-2 px-4 py-4 text-sm leading-relaxed text-fg">
          If an account exists for that email, a reset link is on its way. Check your inbox and spam
          folder.
        </div>
      ) : (
        <form className="mt-8 space-y-3" onSubmit={submit}>
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
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <button
            type="submit"
            disabled={pending}
            className="h-12 w-full rounded-lg bg-primary px-4 font-semibold text-primary-fg disabled:opacity-60"
          >
            {pending ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-4 text-sm">
        <Link to="/login" className="text-primary underline-offset-4 hover:underline">
          Back to sign in
        </Link>
        {sent ? (
          <button
            type="button"
            onClick={() => {
              setSent(false);
              setError("");
            }}
            className="text-muted underline-offset-4 hover:underline"
          >
            Use a different email
          </button>
        ) : null}
      </div>
    </main>
  );
}
