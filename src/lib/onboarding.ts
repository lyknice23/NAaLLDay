/** Client-safe onboarding constants, types, and the pure step resolver. */

/** Bump this whenever the terms text changes; users must re-accept the new version. */
export const CURRENT_TERMS_VERSION = "2026-11-11";

export const SPONSOR_MIN_YEARS = 2;

export type OnboardingStep =
  | "verify-email"
  | "terms"
  | "profile"
  | "roles"
  | "complete";

export type OnboardingProfile = {
  displayName: string;
  role: "leader" | "attendee";
  wantsSponsor: boolean;
  cleanSince: string | null;
  cleanDays: number;
  canSponsor: boolean;
  completedAt: string | null;
};

export type OnboardingState = {
  email: string | null;
  emailVerified: boolean;
  termsAccepted: boolean;
  termsVersion: string;
  profile: OnboardingProfile | null;
  step: OnboardingStep;
};

const ONBOARDING_PATHS: Record<Exclude<OnboardingStep, "complete">, string> = {
  "verify-email": "/verify-email",
  terms: "/onboarding/terms",
  profile: "/onboarding/profile",
  roles: "/onboarding/roles",
};

export function onboardingPath(step: OnboardingStep): string {
  return step === "complete" ? "/" : ONBOARDING_PATHS[step];
}

export function resolveOnboardingStep(input: {
  emailVerified: boolean;
  termsAccepted: boolean;
  hasProfile: boolean;
  onboardingCompleted: boolean;
}): OnboardingStep {
  if (!input.emailVerified) return "verify-email";
  if (!input.termsAccepted) return "terms";
  if (!input.hasProfile) return "profile";
  if (!input.onboardingCompleted) return "roles";
  return "complete";
}

/** Short, human label for a clean-day count; zero means no clean time entered. */
export function cleanTimeLabel(days: number): string {
  if (!Number.isFinite(days) || days <= 0) return "No clean time yet";
  if (days === 1) return "1 day";
  if (days < 30) return `${Math.floor(days)} days`;
  if (days < 365) {
    const months = Math.floor(days / 30);
    return `${months} month${months === 1 ? "" : "s"}`;
  }
  const years = Math.floor(days / 365);
  const months = Math.floor((days - years * 365) / 30);
  return `${years} year${years === 1 ? "" : "s"}${months > 0 ? ` ${months} mo` : ""}`;
}
