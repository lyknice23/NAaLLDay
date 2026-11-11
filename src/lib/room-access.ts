/**
 * Room access rules, kept free of server-only imports so they can be tested
 * directly: the 50-seat capacity, the 20-minute join lock, and the end cutoff.
 *
 * The server reads the facts from Postgres and passes them through
 * `buildRoomAccess`, which is the single place the rules live.
 */

/** A room holds 50 people. */
export const ROOM_CAPACITY = 50;
/** Joining closes this many minutes after the scheduled start. */
export const JOIN_LOCK_MINUTES = 20;
/** A heartbeat older than this no longer counts as being in the room. */
export const PRESENCE_WINDOW_SECONDS = 30;

export type RoomState = "open" | "locked" | "full" | "ended";

export type RoomAccess = {
  state: RoomState;
  count: number;
  capacity: number;
  signupCount: number;
  startsAt: string;
  endsAt: string;
  lockAt: string;
  joined: boolean;
  isLeader: boolean;
};

const ROOM_MESSAGES: Record<RoomState, string> = {
  open: "",
  locked: "Joining closes 20 minutes after the start. You can still sign up for another meeting.",
  full: "This meeting is full — 50 people are already in the room.",
  ended: "This meeting has ended.",
};

export function roomStateMessage(state: RoomState) {
  return ROOM_MESSAGES[state];
}

export type RoomFacts = {
  startsAt: string | Date;
  endsAt: string | Date;
  now: string | Date;
  liveCount: number;
  signupCount: number;
  joined: boolean;
  isLeader: boolean;
  capacity?: number;
  lockMinutes?: number;
};

function millis(value: string | Date) {
  return new Date(value).getTime();
}

/**
 * The decision, in order:
 *   1. past the end   -> ended (for everyone)
 *   2. at/after start + 20 minutes, never joined, not the leader -> locked
 *   3. room at capacity, never joined, not the leader -> full
 *   4. otherwise -> open
 *
 * Someone who joined before the lock keeps access after it, and a leader can
 * always open their own room.
 */
export function resolveRoomState(facts: RoomFacts): RoomState {
  const starts = millis(facts.startsAt);
  const ends = millis(facts.endsAt);
  const now = millis(facts.now);
  if (!Number.isFinite(starts) || !Number.isFinite(ends) || !Number.isFinite(now)) return "open";

  const capacity = facts.capacity ?? ROOM_CAPACITY;
  const lockMinutes = facts.lockMinutes ?? JOIN_LOCK_MINUTES;

  if (now > ends) return "ended";
  if (now >= starts + lockMinutes * 60_000 && !facts.joined && !facts.isLeader) return "locked";
  if (facts.liveCount >= capacity && !facts.joined && !facts.isLeader) return "full";
  return "open";
}

export function lockTime(startsAt: string | Date, lockMinutes = JOIN_LOCK_MINUTES) {
  return new Date(millis(startsAt) + lockMinutes * 60_000).toISOString();
}

export function buildRoomAccess(facts: RoomFacts): RoomAccess {
  return {
    state: resolveRoomState(facts),
    count: facts.liveCount,
    capacity: facts.capacity ?? ROOM_CAPACITY,
    signupCount: facts.signupCount,
    startsAt: new Date(facts.startsAt).toISOString(),
    endsAt: new Date(facts.endsAt).toISOString(),
    lockAt: lockTime(facts.startsAt, facts.lockMinutes),
    joined: facts.joined,
    isLeader: facts.isLeader,
  };
}

/** Minimal tagged-template surface shared by the app's `Sql` and PGlite. */
export interface AccessSql {
  <T = Record<string, unknown>>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]>;
}

export type MeetingAccessQuery = {
  meetingId: string;
  userId: string;
  now: string | Date;
  capacity?: number;
  lockMinutes?: number;
};

/**
 * Read the facts for one meeting at a fixed instant. `now` is a parameter
 * rather than `now()` so the exact lock boundary can be tested.
 */
export async function readMeetingAccess(sql: AccessSql, query: MeetingAccessQuery): Promise<RoomAccess | null> {
  const now = new Date(query.now).toISOString();
  const rows = await sql<{
    leader_id: string;
    starts_at: string;
    ends_at: string;
    live_count: number | bigint;
    signup_count: number | bigint;
    joined: boolean;
  }>`
    select m.leader_id,
           m.starts_at::text as starts_at,
           coalesce(m.ends_at, m.starts_at + interval '1 hour')::text as ends_at,
           (select count(*)::int from room_presence r
             where r.meeting_id = m.id
               and r.last_seen > ${now}::timestamptz
                 - ${PRESENCE_WINDOW_SECONDS}::double precision * interval '1 second') as live_count,
           (select count(*)::int from meeting_signups s where s.meeting_id = m.id) as signup_count,
           exists (select 1 from room_joins j
             where j.meeting_id = m.id and j.user_id = ${query.userId}) as joined
    from meetings m
    where m.id = ${query.meetingId}
  `;
  const row = rows[0];
  if (!row) return null;
  return buildRoomAccess({
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    now,
    liveCount: Number(row.live_count ?? 0),
    signupCount: Number(row.signup_count ?? 0),
    joined: Boolean(row.joined),
    isLeader: row.leader_id === query.userId,
    capacity: query.capacity,
    lockMinutes: query.lockMinutes,
  });
}
