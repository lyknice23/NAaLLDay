-- First-time onboarding now requires accepting both the terms and the privacy
-- policy. Existing rows keep their terms acceptance and will be prompted for
-- the privacy policy on their next visit.
alter table user_consents
  add column if not exists privacy_version text,
  add column if not exists privacy_accepted_at timestamptz;
