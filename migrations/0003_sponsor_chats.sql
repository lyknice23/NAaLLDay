alter table sponsors add column if not exists years_clean integer;
alter table sponsors add column if not exists window_start smallint;

create table if not exists sponsor_chats (
  id text primary key,
  sponsor_id text not null,
  seeker_id text not null,
  created_at timestamptz not null default now(),
  unique (sponsor_id, seeker_id)
);
