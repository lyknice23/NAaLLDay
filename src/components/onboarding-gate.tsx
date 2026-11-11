import type { ReactNode } from "react";
import { Navigate, useRouterState } from "@tanstack/react-router";
import { onboardingPath } from "@/lib/onboarding";
import { useOnboarding } from "@/lib/use-onboarding";

function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/verify-email" ||
    pathname === "/help" ||
    pathname.startsWith("/onboarding/")
  );
}

/**
 * The app shell is only rendered for a signed-in user who has finished
 * verification, terms, profile, and role selection. Public and onboarding
 * routes pass through; those pages enforce their own order.
 */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const { user, isPending, state, error, loading, refresh } =
    useOnboarding(pathname);

  if (isPublicPath(pathname)) return <>{children}</>;

  if (isPending || loading) {
    return (
      <main className="grid min-h-screen place-items-center px-6">
        <p className="text-muted">Opening ALL DAY NA…</p>
      </main>
    );
  }

  if (!user) return <Navigate to="/login" />;

  if (error) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6">
        <h1 className="font-display text-3xl text-fg">We couldn’t open your account.</h1>
        <p className="mt-3 text-sm text-danger">{error}</p>
        <button
          type="button"
          onClick={() => void refresh()}
          className="mt-6 h-12 rounded-lg bg-primary px-4 font-semibold text-primary-fg"
        >
          Try again
        </button>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="grid min-h-screen place-items-center px-6">
        <p className="text-muted">Opening ALL DAY NA…</p>
      </main>
    );
  }

  if (state.step !== "complete") {
    return <Navigate to={onboardingPath(state.step)} />;
  }

  return <>{children}</>;
}
