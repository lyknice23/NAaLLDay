-- Room access: remembers the first time a person entered a meeting room so the
-- 20-minute join lock does not eject someone who briefly reloaded or stepped
-- out. Presence (live count) stays in room_presence.

create table if not exists room_joins (
  meeting_id text not null,
  user_id text not null,
  first_joined_at timestamptz not null default now(),
  primary key (meeting_id, user_id)
);

create index if not exists room_presence_meeting_seen_idx on room_presence (meeting_id, last_seen);
