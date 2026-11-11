create table if not exists profiles (
  user_id text primary key,
  display_name text not null,
  role text not null check (role in ('leader', 'attendee')),
  leader_banned boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists meetings (
  id text primary key,
  leader_id text not null,
  title text not null,
  format text not null,
  description text not null default '',
  starts_at timestamptz not null,
  hosted boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists meetings_starts_idx on meetings (starts_at);
create index if not exists meetings_leader_idx on meetings (leader_id, starts_at);

create table if not exists sponsors (
  user_id text primary key,
  kind text not null check (kind in ('seeking', 'offering')),
  clean_time text not null default '',
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists room_presence (
  meeting_id text not null,
  user_id text not null,
  last_seen timestamptz not null default now(),
  primary key (meeting_id, user_id)
);

create table if not exists room_messages (
  id text primary key,
  meeting_id text not null,
  user_id text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists room_messages_meeting_idx on room_messages (meeting_id, created_at);

create table if not exists rtc_signals (
  id text primary key,
  meeting_id text not null,
  from_id text not null,
  to_id text not null,
  payload text not null,
  created_at timestamptz not null default now()
);

create index if not exists rtc_signals_to_idx on rtc_signals (meeting_id, to_id, id);
