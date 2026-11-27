-- Clean time is private unless a member deliberately shares it on Community.
-- Sponsor posts gain comments so people can talk before opening a private room.
alter table clean_journals add column if not exists shared boolean not null default false;

create table if not exists sponsor_comments (
  id text primary key,
  sponsor_user_id text not null,
  author_id text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists sponsor_comments_post_idx
  on sponsor_comments (sponsor_user_id, created_at asc);