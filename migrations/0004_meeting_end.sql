alter table meetings add column if not exists ends_at timestamptz;
alter table meetings add column if not exists leader_attended boolean not null default false;
update meetings set ends_at = starts_at + interval '1 hour' where ends_at is null;
