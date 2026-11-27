-- A verification letter needs a full legal name, while `display_name` is a
-- first name or nickname used in rooms. The legal name is entered when the
-- member requests a letter (and may be reused on later letters), so it lives on
-- the profile.
alter table profiles add column if not exists legal_name text;

-- Each request snapshots exactly what was issued. A later profile change,
-- meeting edit, or meeting deletion must not alter a letter that is already in
-- someone's hands, so the PDF and the public verification page read these
-- columns instead of live rows. Rows written before this migration are null
-- and the verification lookup falls back to the linked profile and meeting.
alter table attendance_verification_requests
  add column if not exists participant_name text,
  add column if not exists meeting_title text,
  add column if not exists meeting_format text,
  add column if not exists leader_name text,
  add column if not exists meeting_starts_at timestamptz,
  add column if not exists duration_seconds integer;
