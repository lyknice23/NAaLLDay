-- Attendance is accumulated from room heartbeats instead of being inferred
-- from the temporary room_presence rows, which are deleted when a person
-- leaves. One row per person and meeting keeps the first join, latest presence,
-- accumulated seconds, and the last explicit leave.
create table if not exists meeting_attendance (
  meeting_id text not null,
  user_id text not null,
  first_joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  left_at timestamptz,
  duration_seconds integer not null default 0,
  primary key (meeting_id, user_id)
);

create index if not exists meeting_attendance_user_idx
  on meeting_attendance (user_id, first_joined_at desc);

-- A request is written only after a letter is generated. The letter text is
-- retained so the user and support can tell exactly what was sent.
create table if not exists attendance_verification_requests (
  id text primary key,
  user_id text not null,
  meeting_id text not null,
  recipient_email text not null,
  status text not null,
  letter_text text not null,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists attendance_requests_user_idx
  on attendance_verification_requests (user_id, created_at desc);
