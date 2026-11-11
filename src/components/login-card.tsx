import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { GROK_PROVIDERS, signIn } from "@/lib/auth/client";

export function LoginCard() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState<string | null>(null);

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
      <p className="text-sm font-medium tracking-wide text-primary">ALL DAY NA</p>
      <h1 className="mt-3 font-display text-4xl leading-tight text-fg">Meetings that stay open.</h1>
      <p className="mt-4 text-lg leading-relaxed text-muted">
        Sign in, then choose whether you lead meetings or simply attend. First names only inside the rooms.
      </p>
      <div className="mt-8 flex flex-col gap-3">
        {GROK_PROVIDERS.map((provider) => (
          <button
            key={provider.providerId}
            type="button"
            disabled={pending !== null}
            onClick={() => {
              setError("");
              setPending(provider.providerId);
              void signIn(provider.providerId, { callbackURL: "/" })
                .catch((err: unknown) => {
                  setError(err instanceof Error ? err.message : "Sign-in failed. Try again.");
                })
                .finally(() => setPending(null));
            }}
            className="h-12 rounded-lg bg-primary px-4 text-base font-semibold text-primary-fg disabled:opacity-60"
          >
            {pending === provider.providerId ? "Opening sign-in…" : `Continue with ${provider.label}`}
          </button>
        ))}
      </div>
      {error && <p className="mt-4 text-sm text-danger">{error}</p>}
      <Link to="/help" className="mt-6 text-sm text-primary underline-offset-4 hover:underline">
        Need treatment now? Find a rehab with SAMHSA
      </Link>
      <p className="mt-8 text-sm leading-relaxed text-muted">
        Independent tool for people who want Narcotics Anonymous style meetings online. Not affiliated with
        Narcotics Anonymous World Services.
      </p>
    </main>
  );
}