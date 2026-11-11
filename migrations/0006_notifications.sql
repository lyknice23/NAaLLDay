create table if not exists meeting_signups (
  meeting_id text not null,
  user_id text not null,
  created_at timestamptz not null default now(),
  primary key (meeting_id, user_id)
);

create table if not exists notifications (
  id text primary key,
  user_id text not null,
  kind text not null,
  title text not null,
  body text not null,
  href text not null,
  dedupe_key text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
