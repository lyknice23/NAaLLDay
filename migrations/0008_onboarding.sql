-- Production onboarding: terms acceptance, email verification codes, and the
-- sponsor role. `profiles.role` stays the leader/attendee flag for existing
-- leader logic; `wants_sponsor` is additive so a leader can also sponsor.

alter table profiles add column if not exists wants_sponsor boolean not null default false;
alter table profiles add column if not exists onboarding_completed_at timestamptz;

create table if not exists user_consents (
  user_id text primary key,
  terms_version text not null,
  accepted_at timestamptz not null default now()
);

create table if not exists email_verification_codes (
  user_id text primary key,
  email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  last_sent_at timestamptz not null default now()
);
