-- Meetings are always one hour long. Normalize any existing ninety-minute
-- meetings so the stored end time matches the room rules and board display.
update meetings
set ends_at = starts_at + interval '1 hour'
where ends_at is distinct from starts_at + interval '1 hour';
