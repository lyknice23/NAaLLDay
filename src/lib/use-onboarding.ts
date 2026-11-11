import { useCallback, useEffect, useState } from "react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getOnboardingState } from "@/lib/onboarding.functions";
import type { OnboardingState } from "@/lib/onboarding";

/**
 * Load the signed-in user's place in the onboarding sequence. `refreshKey`
 * lets the root gate re-read the state after a client-side navigation, when
 * the component itself does not remount.
 */
export function useOnboarding(refreshKey = "") {
  const { user, isPending } = useCurrentUserState();
  const userId = user?.id;
  const [state, setState] = useState<OnboardingState | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) {
      setState(null);
      setError("");
      setLoading(false);
      return null;
    }
    setLoading(true);
    try {
      const next = await getOnboardingState();
      setState(next);
      setError("");
      return next;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load your account setup.",
      );
      return null;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh, refreshKey]);

  return {
    user,
    isPending,
    state,
    error,
    loading: isPending || loading,
    refresh,
  };
}
