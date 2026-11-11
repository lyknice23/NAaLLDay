create table if not exists clean_journals (
  user_id text primary key,
  clean_since date not null,
  updated_at timestamptz not null default now()
);

create table if not exists journal_entries (
  id text primary key,
  user_id text not null,
  body text not null default '',
  clean_days integer not null,
  entry_date date not null,
  created_at timestamptz not null default now(),
  unique (user_id, entry_date)
);

create table if not exists shared_achievements (
  id text primary key,
  user_id text not null,
  milestone_days integer not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, milestone_days)
);
