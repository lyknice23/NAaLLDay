import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanTimeLabel,
  onboardingPath,
  resolveOnboardingStep,
} from "./onboarding.ts";

test("onboarding resolves each gate in order", () => {
  const complete = {
    emailVerified: true,
    termsAccepted: true,
    hasProfile: true,
    onboardingCompleted: true,
  };

  assert.equal(
    resolveOnboardingStep({ ...complete, emailVerified: false }),
    "verify-email",
  );
  assert.equal(
    resolveOnboardingStep({ ...complete, termsAccepted: false }),
    "terms",
  );
  assert.equal(resolveOnboardingStep({ ...complete, hasProfile: false }), "profile");
  assert.equal(
    resolveOnboardingStep({ ...complete, onboardingCompleted: false }),
    "roles",
  );
  assert.equal(resolveOnboardingStep(complete), "complete");
});

test("onboarding pages have stable paths", () => {
  assert.equal(onboardingPath("verify-email"), "/verify-email");
  assert.equal(onboardingPath("terms"), "/onboarding/terms");
  assert.equal(onboardingPath("profile"), "/onboarding/profile");
  assert.equal(onboardingPath("roles"), "/onboarding/roles");
  assert.equal(onboardingPath("complete"), "/");
});

test("clean time labels are readable", () => {
  assert.equal(cleanTimeLabel(0), "No clean time yet");
  assert.equal(cleanTimeLabel(1), "1 day");
  assert.equal(cleanTimeLabel(11), "11 days");
  assert.equal(cleanTimeLabel(60), "2 months");
  assert.equal(cleanTimeLabel(365), "1 year");
  assert.equal(cleanTimeLabel(800), "2 years 2 mo");
});
