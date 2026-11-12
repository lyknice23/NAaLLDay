import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import {
  ROOM_CAPACITY,
  buildRoomAccess,
  readMeetingAccess,
  roomStateMessage,
  type RoomAccess,
  type RoomState,
} from "@/lib/room-access";

export type Profile = {
  displayName: string;
  role: "leader" | "attendee";
  wantsSponsor: boolean;
  canSponsor: boolean;
  cleanSince: string | null;
  cleanDays: number;
  leaderBanned: boolean;
  createdAt: string;
  hostedThisWeek: number;
  scheduledThisWeek: number;
};

export type Meeting = {
  id: string;
  leaderId: string;
  leaderName: string;
  title: string;
  format: string;
  description: string;
  startsAt: string;
  endsAt: string;
  hosted: boolean;
  attended: boolean;
  mine: boolean;
  signedUp: boolean;
  signupCount?: number;
  liveCount?: number;
  lockAt?: string;
  joinState?: RoomState;
};

export type SponsorPost = {
  userId: string;
  displayName: string;
  kind: "seeking" | "offering";
  cleanTime: string;
  note: string;
  yearsClean: number | null;
  windowStart: number | null;
  mine: boolean;
};

export type SponsorChatSummary = {
  id: string;
  otherName: string;
  youAreSponsor: boolean;
  yearsClean: number | null;
  windowStart: number | null;
};

export type PresencePeer = { userId: string; displayName: string };
export type ChatMessage = {
  id: string;
  userId: string;
  displayName: string;
  body: string;
  createdAt: string;
};
export type RtcSignal = { id: string; fromId: string; payload: string };

// The rules live in `@/lib/room-access` so they can be tested with a fixed clock.
export { ROOM_CAPACITY, roomStateMessage };
export type { RoomAccess, RoomState };

const FORMATS = ["Discussion", "Speaker", "Step Study", "Literature", "Newcomer"] as const;
const MEETING_MINUTES = 60;

type ProfileRow = {
  display_name: string;
  role: "leader" | "attendee";
  wants_sponsor: boolean;
  can_sponsor: boolean;
  clean_since: string | null;
  clean_days: number;
  leader_banned: boolean;
  created_at: string;
};

function num(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

async function settleMeetings() {
  const sql = await getSql();
  await sql`
    update meetings
    set hosted = true
    where leader_attended = true
      and hosted = false
      and coalesce(ends_at, starts_at + interval '1 hour') <= now()
  `;
}

async function weekStats(userId: string) {
  const sql = await getSql();
  const rows = await sql<{ hosted: number; scheduled: number }>`
    select
      count(*) filter (where hosted)::int as hosted,
      count(*)::int as scheduled
    from meetings
    where leader_id = ${userId}
      and starts_at >= date_trunc('week', now())
      and starts_at < date_trunc('week', now()) + interval '7 days'
  `;
  return { hostedThisWeek: num(rows[0]?.hosted), scheduledThisWeek: num(rows[0]?.scheduled) };
}

async function applyBan(userId: string, profile: ProfileRow) {
  if (profile.role !== "leader" || profile.leader_banned) return profile.leader_banned;
  const sql = await getSql();
  // Only a leader who was already leading before last week began can be judged
  // on last week's count — a brand-new leader gets a full week first.
  const age = await sql<{ mature: boolean }>`
    select (created_at <= date_trunc('week', now()) - interval '7 days') as mature
    from profiles where user_id = ${userId}
  `;
  if (!age[0]?.mature) return false;
  const prev = await sql<{ n: number }>`
    select count(*)::int as n from meetings
    where leader_id = ${userId}
      and hosted = true
      and starts_at >= date_trunc('week', now()) - interval '7 days'
      and starts_at < date_trunc('week', now())
  `;
  if (num(prev[0]?.n) >= 3) return false;
  await sql`update profiles set leader_banned = true where user_id = ${userId}`;
  return true;
}

async function loadProfile(userId: string): Promise<Profile | null> {
  const sql = await getSql();
  const rows = await sql<ProfileRow>`
    select p.display_name,
           p.role,
           p.wants_sponsor,
           p.leader_banned,
           p.created_at::text as created_at,
           cj.clean_since::text as clean_since,
           coalesce((current_date - cj.clean_since)::int, 0) as clean_days,
           (cj.clean_since is not null
             and cj.clean_since <= current_date - interval '2 years') as can_sponsor
    from profiles p
    left join clean_journals cj on cj.user_id = p.user_id
    where p.user_id = ${userId}
  `;
  const row = rows[0];
  if (!row) return null;
  await settleMeetings();
  const leaderBanned = await applyBan(userId, row);
  const stats = await weekStats(userId);
  return {
    displayName: row.display_name,
    role: row.role,
    wantsSponsor: Boolean(row.wants_sponsor),
    canSponsor: Boolean(row.can_sponsor),
    cleanSince: row.clean_since,
    cleanDays: Number(row.clean_days ?? 0),
    leaderBanned,
    createdAt: row.created_at,
    ...stats,
  };
}

export const getMe = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const profile = await loadProfile(context.userId);
    return { profile };
  });

export const saveProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { displayName: string; role: "leader" | "attendee" }) => {
    const displayName = String(input?.displayName ?? "")
      .trim()
      .slice(0, 40);
    const role = input?.role === "leader" ? "leader" : input?.role === "attendee" ? "attendee" : "";
    if (!displayName) throw new Error("Enter a first name.");
    if (!role) throw new Error("Choose leader or attendee.");
    return { displayName, role: role as "leader" | "attendee" };
  })
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const existing = await sql<{ leader_banned: boolean }>`
      select leader_banned from profiles where user_id = ${context.userId}
    `;
    if (existing[0]?.leader_banned && data.role === "leader") {
      return {
        ok: false as const,
        error:
          "Leader access is suspended. You can still attend meetings, but you cannot lead them.",
      };
    }
    await sql`
      insert into profiles (user_id, display_name, role)
      values (${context.userId}, ${data.displayName}, ${data.role})
      on conflict (user_id) do update set
        display_name = excluded.display_name,
        role = excluded.role
    `;
    const profile = await loadProfile(context.userId);
    return { ok: true as const, profile };
  });

export const listMeetings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<Meeting[]> => {
    const sql = await getSql();
    await settleMeetings();
    const rows = await sql<{
      id: string;
      leader_id: string;
      leader_name: string;
      title: string;
      format: string;
      description: string;
      starts_at: string;
      ends_at: string;
      hosted: boolean;
      leader_attended: boolean;
      signed_up: boolean;
      signup_count: number;
      live_count: number;
      joined: boolean;
    }>`
      select m.id, m.leader_id, p.display_name as leader_name, m.title, m.format,
             m.description, m.starts_at::text as starts_at,
             coalesce(m.ends_at, m.starts_at + interval '1 hour')::text as ends_at,
             m.hosted, m.leader_attended,
             (
               m.leader_id = ${context.userId}
               or exists (
                 select 1 from meeting_signups s
                 where s.meeting_id = m.id and s.user_id = ${context.userId}
               )
             ) as signed_up,
             (select count(*)::int from meeting_signups s where s.meeting_id = m.id) as signup_count,
             (select count(*)::int from room_presence r
               where r.meeting_id = m.id and r.last_seen > now() - interval '30 seconds') as live_count,
             exists (select 1 from room_joins j
               where j.meeting_id = m.id and j.user_id = ${context.userId}) as joined
      from meetings m
      join profiles p on p.user_id = m.leader_id
      where coalesce(m.ends_at, m.starts_at + interval '1 hour') > now() - interval '1 hour'
      order by m.starts_at asc
      limit 80
    `;
    const now = new Date().toISOString();
    return rows.map((row) => {
      const mine = row.leader_id === context.userId;
      const access = buildRoomAccess({
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        now,
        liveCount: num(row.live_count),
        signupCount: num(row.signup_count),
        joined: Boolean(row.joined),
        isLeader: mine,
      });
      return {
        id: row.id,
        leaderId: row.leader_id,
        leaderName: row.leader_name,
        title: row.title,
        format: row.format,
        description: row.description,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        hosted: row.hosted,
        attended: row.leader_attended,
        mine,
        signedUp: Boolean(row.signed_up),
        signupCount: access.signupCount,
        liveCount: access.count,
        lockAt: access.lockAt,
        joinState: access.state,
      };
    });
  });

export const loadDemo = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const existing = await sql<{ user_id: string }>`
      select user_id from profiles where user_id = ${context.userId}
    `;
    if (!existing[0]) {
      await sql`
        insert into profiles (user_id, display_name, role)
        values (${context.userId}, 'Jordan', 'leader')
      `;
    }

    const people = [
      ["demo-sam", "Sam", "leader"],
      ["demo-riley", "Riley", "leader"],
      ["demo-morgan", "Morgan", "attendee"],
      ["demo-casey", "Casey", "leader"],
    ] as const;
    for (const [id, name, role] of people) {
      await sql`
        insert into profiles (user_id, display_name, role)
        values (${id}, ${name}, ${role})
        on conflict (user_id) do update set display_name = excluded.display_name, role = excluded.role
      `;
    }

    const soon = (hours: number) => new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    const meetings: Array<{
      id: string;
      leader: string;
      title: string;
      format: string;
      description: string;
      starts: string;
    }> = [
      {
        id: "demo-open-discussion",
        leader: "demo-sam",
        title: "Open discussion",
        format: "Discussion",
        description: "A quiet hour. Share if you want, or just listen.",
        starts: soon(0.25),
      },
      {
        id: "demo-newcomer",
        leader: "demo-riley",
        title: "Newcomer welcome",
        format: "Newcomer",
        description: "For anyone in their first days. Questions are welcome.",
        starts: soon(6),
      },
      {
        id: "demo-step-one",
        leader: "demo-casey",
        title: "Step One",
        format: "Step Study",
        description: "We admitted we were powerless over our addiction.",
        starts: soon(30),
      },
      {
        id: "demo-literature",
        leader: "demo-sam",
        title: "Just for Today",
        format: "Literature",
        description: "A short reading, then sharing.",
        starts: soon(54),
      },
    ];

    const profile = await loadProfile(context.userId);
    if (profile?.role === "leader" && !profile.leaderBanned) {
      meetings.push({
        id: `demo-mine-${context.userId}`,
        leader: context.userId,
        title: "Evening sharing",
        format: "Speaker",
        description: "Your demo meeting. The time stays editable until 48 hours before it starts.",
        starts: soon(72),
      });
    }

    for (const meeting of meetings) {
      await sql`
        insert into meetings (id, leader_id, title, format, description, starts_at, ends_at, hosted, leader_attended)
        values (
          ${meeting.id},
          ${meeting.leader},
          ${meeting.title},
          ${meeting.format},
          ${meeting.description},
          ${meeting.starts}::timestamptz,
          ${meeting.starts}::timestamptz + interval '1 hour',
          false,
          false
        )
        on conflict (id) do update set
          leader_id = excluded.leader_id,
          title = excluded.title,
          format = excluded.format,
          description = excluded.description,
          starts_at = excluded.starts_at,
          ends_at = excluded.ends_at,
          hosted = false,
          leader_attended = false
      `;
    }

    const notes = [
      [
        "demo-msg-1",
        "demo-open-discussion",
        "demo-riley",
        "Glad this one is open. I will mostly listen.",
      ],
      [
        "demo-msg-2",
        "demo-open-discussion",
        "demo-morgan",
        "First time here. Is it okay to just sit?",
      ],
    ] as const;
    for (const [id, meetingId, userId, body] of notes) {
      await sql`
        insert into room_messages (id, meeting_id, user_id, body)
        values (${id}, ${meetingId}, ${userId}, ${body})
        on conflict (id) do nothing
      `;
    }

    const sponsors = [
      {
        userId: "demo-morgan",
        kind: "seeking",
        cleanTime: "11 days",
        note: "Looking for someone who can take a call in the evenings.",
        yearsClean: null as number | null,
        windowStart: null as number | null,
      },
      {
        userId: "demo-casey",
        kind: "offering",
        cleanTime: "4 years",
        note: "I have a couple of spots. A short note is enough to start.",
        yearsClean: 4,
        windowStart: 0,
      },
      {
        userId: "demo-sam",
        kind: "offering",
        cleanTime: "3 years",
        note: "Happy to talk with newcomers after the open discussion.",
        yearsClean: 3,
        windowStart: 8,
      },
    ];
    for (const post of sponsors) {
      await sql`
        insert into sponsors (user_id, kind, clean_time, note, years_clean, window_start)
        values (${post.userId}, ${post.kind}, ${post.cleanTime}, ${post.note}, ${post.yearsClean}, ${post.windowStart})
        on conflict (user_id) do update set
          kind = excluded.kind,
          clean_time = excluded.clean_time,
          note = excluded.note,
          years_clean = excluded.years_clean,
          window_start = excluded.window_start
      `;
    }

    const stories = [
      ["demo-sam", 365 * 3, 365, "A year at a time. Still showing up."],
      ["demo-casey", 365 * 4, 730, "Two years. Grateful for the people who stayed."],
      ["demo-morgan", 11, 7, "Made it a week. That felt far away last Monday."],
    ] as const;
    for (const [userId, daysAgo, milestone, note] of stories) {
      await sql`
        insert into clean_journals (user_id, clean_since)
        values (${userId}, current_date - ${daysAgo}::int)
        on conflict (user_id) do update set clean_since = excluded.clean_since, updated_at = now()
      `;
      await sql`
        insert into shared_achievements (id, user_id, milestone_days, note)
        values (${"share-" + userId}, ${userId}, ${milestone}, ${note})
        on conflict (user_id, milestone_days) do update set note = excluded.note
      `;
    }

    for (const meetingId of ["demo-open-discussion", "demo-newcomer"]) {
      await sql`
        insert into meeting_signups (meeting_id, user_id)
        values (${meetingId}, ${context.userId})
        on conflict (meeting_id, user_id) do nothing
      `;
    }

    return { ok: true as const, profile: await loadProfile(context.userId) };
  });

export const createMeeting = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { title: string; format: string; description: string; startsAt: string }) => {
    const title = String(input?.title ?? "")
      .trim()
      .slice(0, 80);
    const format = FORMATS.includes(input?.format as (typeof FORMATS)[number]) ? input.format : "";
    const description = String(input?.description ?? "")
      .trim()
      .slice(0, 400);
    const starts = new Date(input?.startsAt);
    if (!title) throw new Error("Give the meeting a title.");
    if (!format) throw new Error("Choose a format.");
    if (Number.isNaN(starts.getTime())) throw new Error("Choose a time.");
    return { title, format, description, startsAt: starts.toISOString() };
  })
  .handler(async ({ context, data }) => {
    const profile = await loadProfile(context.userId);
    if (!profile || profile.role !== "leader" || profile.leaderBanned) {
      return { ok: false as const, error: "Only active meeting leaders can schedule." };
    }
    if (new Date(data.startsAt).getTime() < Date.now() - 5 * 60 * 1000) {
      return { ok: false as const, error: "Meetings start in the future. Any hour, any day." };
    }
    const sql = await getSql();
    const id = crypto.randomUUID();
    const endsAt = new Date(
      new Date(data.startsAt).getTime() + MEETING_MINUTES * 60 * 1000,
    ).toISOString();
    await sql`
      insert into meetings (id, leader_id, title, format, description, starts_at, ends_at)
      values (${id}, ${context.userId}, ${data.title}, ${data.format}, ${data.description}, ${data.startsAt}::timestamptz, ${endsAt}::timestamptz)
    `;
    await sql`
      insert into meeting_signups (meeting_id, user_id)
      values (${id}, ${context.userId})
      on conflict (meeting_id, user_id) do nothing
    `;
    return { ok: true as const, id };
  });

export const rescheduleMeeting = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; startsAt: string }) => {
    const id = String(input?.id ?? "");
    const starts = new Date(input?.startsAt);
    if (!id) throw new Error("Missing meeting.");
    if (Number.isNaN(starts.getTime())) throw new Error("Choose a time.");
    return { id, startsAt: starts.toISOString() };
  })
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql<{ starts_at: string }>`
      select starts_at::text as starts_at from meetings
      where id = ${data.id} and leader_id = ${context.userId}
    `;
    const row = rows[0];
    if (!row)
      return { ok: false as const, error: "Only the leader of this meeting can change the time." };
    if (new Date(row.starts_at).getTime() - Date.now() < 48 * 60 * 60 * 1000) {
      return {
        ok: false as const,
        error: "Time changes must be made at least 48 hours before the meeting starts.",
      };
    }
    if (new Date(data.startsAt).getTime() < Date.now()) {
      return { ok: false as const, error: "Pick a future time." };
    }
    await sql`
      update meetings set
        ends_at = ${data.startsAt}::timestamptz + interval '1 hour',
        starts_at = ${data.startsAt}::timestamptz
      where id = ${data.id} and leader_id = ${context.userId}
    `;
    return { ok: true as const };
  });

export const listSponsors = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<SponsorPost[]> => {
    const sql = await getSql();
    const rows = await sql<{
      user_id: string;
      display_name: string;
      kind: "seeking" | "offering";
      clean_time: string;
      note: string;
      years_clean: number | null;
      window_start: number | null;
    }>`
      select s.user_id, p.display_name, s.kind, s.clean_time, s.note, s.years_clean, s.window_start
      from sponsors s
      join profiles p on p.user_id = s.user_id
      order by s.created_at desc
      limit 100
    `;
    return rows.map((row) => ({
      userId: row.user_id,
      displayName: row.display_name,
      kind: row.kind,
      cleanTime: row.clean_time,
      note: row.note,
      yearsClean: row.years_clean == null ? null : num(row.years_clean),
      windowStart: row.window_start == null ? null : num(row.window_start),
      mine: row.user_id === context.userId,
    }));
  });

export const saveSponsor = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      kind: string;
      cleanTime: string;
      note: string;
      yearsClean?: number | null;
      windowStart?: number | null;
      pledged?: boolean;
    }) => {
      const kind =
        input?.kind === "offering" ? "offering" : input?.kind === "seeking" ? "seeking" : "";
      if (!kind) throw new Error("Choose seeking or offering.");
      const years = Number(input?.yearsClean);
      const windowStart = Number(input?.windowStart);
      return {
        kind: kind as "seeking" | "offering",
        cleanTime: String(input?.cleanTime ?? "")
          .trim()
          .slice(0, 40),
        note: String(input?.note ?? "")
          .trim()
          .slice(0, 280),
        yearsClean: Number.isInteger(years) ? years : null,
        windowStart: Number.isInteger(windowStart) ? windowStart : null,
        pledged: input?.pledged === true,
      };
    },
  )
  .handler(async ({ context, data }) => {
    const profile = await loadProfile(context.userId);
    if (!profile) return { ok: false as const, error: "Set up your name first." };
    const sql = await getSql();
    let cleanTime = data.cleanTime;
    let yearsClean: number | null = null;
    let windowStart: number | null = null;
    if (data.kind === "offering") {
      if (!data.pledged) {
        return {
          ok: false as const,
          error: "Confirm that you have 2 years clean and will keep this 12-hour window.",
        };
      }
      if (data.windowStart == null || data.windowStart < 0 || data.windowStart > 23) {
        return { ok: false as const, error: "Pick the 12-hour window you can keep each day." };
      }
      const cleanRows = await sql<{ clean_days: number }>`
        select (current_date - clean_since)::int as clean_days
        from clean_journals where user_id = ${context.userId}
      `;
      const cleanDays = Number(cleanRows[0]?.clean_days ?? 0);
      const actualYears = Math.floor(cleanDays / 365);
      if (!cleanRows[0] || actualYears < 2) {
        return {
          ok: false as const,
          error:
            "Sponsor access needs at least 2 years clean. Add your clean date in the Journal first.",
        };
      }
      yearsClean = actualYears;
      windowStart = data.windowStart;
      cleanTime = `${yearsClean} years`;
    }
    await sql`
      insert into sponsors (user_id, kind, clean_time, note, years_clean, window_start)
      values (${context.userId}, ${data.kind}, ${cleanTime}, ${data.note}, ${yearsClean}, ${windowStart})
      on conflict (user_id) do update set
        kind = excluded.kind,
        clean_time = excluded.clean_time,
        note = excluded.note,
        years_clean = excluded.years_clean,
        window_start = excluded.window_start,
        created_at = now()
    `;
    if (data.kind === "offering") {
      await sql`update profiles set wants_sponsor = true where user_id = ${context.userId}`;
    }
    return { ok: true as const };
  });

export const listSponsorChats = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<SponsorChatSummary[]> => {
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      sponsor_id: string;
      seeker_id: string;
      sponsor_name: string;
      seeker_name: string;
      years_clean: number | null;
      window_start: number | null;
    }>`
      select c.id, c.sponsor_id, c.seeker_id,
             sp.display_name as sponsor_name, sk.display_name as seeker_name,
             s.years_clean, s.window_start
      from sponsor_chats c
      join profiles sp on sp.user_id = c.sponsor_id
      join profiles sk on sk.user_id = c.seeker_id
      left join sponsors s on s.user_id = c.sponsor_id
      where c.sponsor_id = ${context.userId} or c.seeker_id = ${context.userId}
      order by c.created_at desc
    `;
    return rows.map((row) => {
      const youAreSponsor = row.sponsor_id === context.userId;
      return {
        id: row.id,
        otherName: youAreSponsor ? row.seeker_name : row.sponsor_name,
        youAreSponsor,
        yearsClean: row.years_clean == null ? null : num(row.years_clean),
        windowStart: row.window_start == null ? null : num(row.window_start),
      };
    });
  });

export const openSponsorChat = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { sponsorUserId: string }) => ({
    sponsorUserId: String(input?.sponsorUserId ?? ""),
  }))
  .handler(async ({ context, data }) => {
    if (!data.sponsorUserId) return { ok: false as const, error: "Choose a sponsor." };
    if (data.sponsorUserId === context.userId)
      return { ok: false as const, error: "That is your own post." };
    const profile = await loadProfile(context.userId);
    if (!profile) return { ok: false as const, error: "Set up your name first." };
    const sql = await getSql();
    const sponsors = await sql<{
      kind: string;
      years_clean: number | null;
      window_start: number | null;
    }>`
      select kind, years_clean, window_start from sponsors where user_id = ${data.sponsorUserId}
    `;
    const sponsor = sponsors[0];
    if (
      !sponsor ||
      sponsor.kind !== "offering" ||
      num(sponsor.years_clean) < 2 ||
      sponsor.window_start == null
    ) {
      return { ok: false as const, error: "That person is not available as a sponsor." };
    }
    const existing = await sql<{ id: string }>`
      select id from sponsor_chats
      where sponsor_id = ${data.sponsorUserId} and seeker_id = ${context.userId}
    `;
    if (existing[0]) return { ok: true as const, chatId: existing[0].id };
    const id = crypto.randomUUID();
    await sql`
      insert into sponsor_chats (id, sponsor_id, seeker_id)
      values (${id}, ${data.sponsorUserId}, ${context.userId})
    `;
    return { ok: true as const, chatId: id };
  });

export const getSponsorChat = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => ({ id: String(input?.id ?? "") }))
  .handler(async ({ context, data }): Promise<SponsorChatSummary | null> => {
    if (!data.id) return null;
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      sponsor_id: string;
      seeker_id: string;
      sponsor_name: string;
      seeker_name: string;
      years_clean: number | null;
      window_start: number | null;
    }>`
      select c.id, c.sponsor_id, c.seeker_id,
             sp.display_name as sponsor_name, sk.display_name as seeker_name,
             s.years_clean, s.window_start
      from sponsor_chats c
      join profiles sp on sp.user_id = c.sponsor_id
      join profiles sk on sk.user_id = c.seeker_id
      left join sponsors s on s.user_id = c.sponsor_id
      where c.id = ${data.id}
        and (c.sponsor_id = ${context.userId} or c.seeker_id = ${context.userId})
    `;
    const row = rows[0];
    if (!row) return null;
    const youAreSponsor = row.sponsor_id === context.userId;
    return {
      id: row.id,
      otherName: youAreSponsor ? row.seeker_name : row.sponsor_name,
      youAreSponsor,
      yearsClean: row.years_clean == null ? null : num(row.years_clean),
      windowStart: row.window_start == null ? null : num(row.window_start),
    };
  });

type RoomKind = "meeting" | "chat" | "none";

/** Which kind of room this id is, and whether this user may see it at all. */
async function resolveRoom(userId: string, roomId: string): Promise<RoomKind> {
  if (!roomId) return "none";
  const sql = await getSql();
  const chats = await sql<{ sponsor_id: string; seeker_id: string }>`
    select sponsor_id, seeker_id from sponsor_chats where id = ${roomId}
  `;
  const chat = chats[0];
  if (chat) return chat.sponsor_id === userId || chat.seeker_id === userId ? "chat" : "none";
  const meetings = await sql<{ id: string }>`select id from meetings where id = ${roomId}`;
  return meetings[0] ? "meeting" : "none";
}

/** Capacity, 20-minute lock, and whether this person has ever joined. */
async function meetingAccess(
  userId: string,
  meetingId: string,
  now = new Date().toISOString(),
): Promise<RoomAccess | null> {
  const sql = await getSql();
  return readMeetingAccess(sql, { meetingId, userId, now });
}

/** A room this user may read or write right now. */
async function roomWritable(userId: string, roomId: string) {
  const kind = await resolveRoom(userId, roomId);
  if (kind === "none") return false;
  if (kind === "chat") return true;
  const access = await meetingAccess(userId, roomId);
  return access?.state === "open";
}

export const getRoomAccess = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => ({ id: String(input?.id ?? "") }))
  .handler(async ({ context, data }): Promise<RoomAccess | null> => {
    if (!data.id) return null;
    const kind = await resolveRoom(context.userId, data.id);
    if (kind === "none") return null;
    if (kind === "meeting") return meetingAccess(context.userId, data.id);
    const sql = await getSql();
    const counts = await sql<{ n: number }>`
      select count(*)::int as n from room_presence
      where meeting_id = ${data.id} and last_seen > now() - interval '30 seconds'
    `;
    const now = new Date().toISOString();
    return {
      state: "open",
      count: num(counts[0]?.n),
      capacity: 2,
      signupCount: 0,
      startsAt: now,
      endsAt: now,
      lockAt: now,
      joined: true,
      isLeader: false,
    };
  });

export const heartbeat = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { meetingId: string }) => ({ meetingId: String(input?.meetingId ?? "") }))
  .handler(async ({ context, data }) => {
    if (!data.meetingId) {
      return {
        ok: false as const,
        state: "locked" as RoomState,
        message: "Missing room.",
        count: 0,
        capacity: 0,
      };
    }
    const room = await resolveRoom(context.userId, data.meetingId);
    if (room === "none") {
      return {
        ok: false as const,
        state: "locked" as RoomState,
        message: "This room is not open to you.",
        count: 0,
        capacity: 0,
      };
    }
    const profile = await loadProfile(context.userId);
    if (!profile) {
      return {
        ok: false as const,
        state: "locked" as RoomState,
        message: "Set your first name first.",
        count: 0,
        capacity: 0,
      };
    }
    const sql = await getSql();

    if (room === "meeting") {
      const access = await meetingAccess(context.userId, data.meetingId);
      if (!access) {
        return {
          ok: false as const,
          state: "ended" as RoomState,
          message: "This meeting is no longer on the board.",
          count: 0,
          capacity: ROOM_CAPACITY,
        };
      }
      if (access.state !== "open") {
        return {
          ok: false as const,
          state: access.state,
          message: roomStateMessage(access.state),
          count: access.count,
          capacity: ROOM_CAPACITY,
        };
      }
      // Remember the first join so a reload after the 20-minute mark still
      // gets back in; the leader can always open their own room.
      await sql`
        insert into room_joins (meeting_id, user_id)
        values (${data.meetingId}, ${context.userId})
        on conflict (meeting_id, user_id) do nothing
      `;
      await sql`
        insert into room_presence (meeting_id, user_id, last_seen)
        values (${data.meetingId}, ${context.userId}, now())
        on conflict (meeting_id, user_id) do update set last_seen = now()
      `;
      await sql`
        update meetings set leader_attended = true
        where id = ${data.meetingId}
          and leader_id = ${context.userId}
          and starts_at <= now() + interval '15 minutes'
          and coalesce(ends_at, starts_at + interval '1 hour') >= now()
      `;
      await settleMeetings();
      // Recount after the upsert so the person who just joined is included.
      const live = await sql<{ n: number }>`
        select count(*)::int as n from room_presence
        where meeting_id = ${data.meetingId} and last_seen > now() - interval '30 seconds'
      `;
      return {
        ok: true as const,
        state: "open" as RoomState,
        message: "",
        count: num(live[0]?.n),
        capacity: ROOM_CAPACITY,
      };
    }

    await sql`
      insert into room_presence (meeting_id, user_id, last_seen)
      values (${data.meetingId}, ${context.userId}, now())
      on conflict (meeting_id, user_id) do update set last_seen = now()
    `;
    const counts = await sql<{ n: number }>`
      select count(*)::int as n from room_presence
      where meeting_id = ${data.meetingId} and last_seen > now() - interval '30 seconds'
    `;
    return {
      ok: true as const,
      state: "open" as RoomState,
      message: "",
      count: num(counts[0]?.n),
      capacity: 2,
    };
  });

export const leaveRoom = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { meetingId: string }) => ({ meetingId: String(input?.meetingId ?? "") }))
  .handler(async ({ context, data }) => {
    if (!(await roomWritable(context.userId, data.meetingId))) return { ok: false as const };
    const sql = await getSql();
    await sql`delete from room_presence where meeting_id = ${data.meetingId} and user_id = ${context.userId}`;
    return { ok: true as const };
  });

export const listPresence = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { meetingId: string }) => ({ meetingId: String(input?.meetingId ?? "") }))
  .handler(async ({ context, data }): Promise<PresencePeer[]> => {
    if (!(await roomWritable(context.userId, data.meetingId))) return [];
    const sql = await getSql();
    const rows = await sql<{ user_id: string; display_name: string }>`
      select r.user_id, p.display_name
      from room_presence r
      join profiles p on p.user_id = r.user_id
      where r.meeting_id = ${data.meetingId}
        and r.last_seen > now() - interval '20 seconds'
      order by p.display_name
    `;
    return rows.map((row) => ({ userId: row.user_id, displayName: row.display_name }));
  });

export const listMessages = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { meetingId: string }) => ({ meetingId: String(input?.meetingId ?? "") }))
  .handler(async ({ context, data }): Promise<ChatMessage[]> => {
    if (!(await roomWritable(context.userId, data.meetingId))) return [];
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      user_id: string;
      display_name: string;
      body: string;
      created_at: string;
    }>`
      select m.id, m.user_id, p.display_name, m.body, m.created_at::text as created_at
      from room_messages m
      join profiles p on p.user_id = m.user_id
      where m.meeting_id = ${data.meetingId}
      order by m.created_at asc
      limit 200
    `;
    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      displayName: row.display_name,
      body: row.body,
      createdAt: row.created_at,
    }));
  });

export const postMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { meetingId: string; body: string }) => ({
    meetingId: String(input?.meetingId ?? ""),
    body: String(input?.body ?? "")
      .trim()
      .slice(0, 500),
  }))
  .handler(async ({ context, data }) => {
    if (!data.meetingId || !data.body) return { ok: false as const };
    if (!(await roomWritable(context.userId, data.meetingId))) return { ok: false as const };
    const profile = await loadProfile(context.userId);
    if (!profile) return { ok: false as const };
    const sql = await getSql();
    const id = `${Date.now().toString().padStart(15, "0")}-${crypto.randomUUID().slice(0, 8)}`;
    await sql`
      insert into room_messages (id, meeting_id, user_id, body)
      values (${id}, ${data.meetingId}, ${context.userId}, ${data.body})
    `;
    return { ok: true as const };
  });

export const pollSignals = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { meetingId: string; after: string }) => ({
    meetingId: String(input?.meetingId ?? ""),
    after: String(input?.after ?? ""),
  }))
  .handler(async ({ context, data }): Promise<RtcSignal[]> => {
    if (!(await roomWritable(context.userId, data.meetingId))) return [];
    const sql = await getSql();
    await sql`delete from rtc_signals where created_at < now() - interval '15 minutes'`;
    const rows = await sql<{ id: string; from_id: string; payload: string }>`
      select id, from_id, payload from rtc_signals
      where meeting_id = ${data.meetingId}
        and to_id = ${context.userId}
        and id > ${data.after}
      order by id asc
      limit 50
    `;
    return rows.map((row) => ({ id: row.id, fromId: row.from_id, payload: row.payload }));
  });

export const postSignal = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { meetingId: string; toId: string; payload: string }) => ({
    meetingId: String(input?.meetingId ?? ""),
    toId: String(input?.toId ?? ""),
    payload: String(input?.payload ?? "").slice(0, 20000),
  }))
  .handler(async ({ context, data }) => {
    if (!data.meetingId || !data.toId || !data.payload) return { ok: false as const };
    if (data.toId === context.userId) return { ok: false as const };
    if (!(await roomWritable(context.userId, data.meetingId))) return { ok: false as const };
    const sql = await getSql();
    const id = `${Date.now().toString().padStart(15, "0")}-${crypto.randomUUID().slice(0, 8)}`;
    await sql`
      insert into rtc_signals (id, meeting_id, from_id, to_id, payload)
      values (${id}, ${data.meetingId}, ${context.userId}, ${data.toId}, ${data.payload})
    `;
    return { ok: true as const };
  });

export const getMeeting = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => ({ id: String(input?.id ?? "") }))
  .handler(async ({ context, data }): Promise<Meeting | null> => {
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      leader_id: string;
      leader_name: string;
      title: string;
      format: string;
      description: string;
      starts_at: string;
      ends_at: string;
      hosted: boolean;
      leader_attended: boolean;
    }>`
      select m.id, m.leader_id, p.display_name as leader_name, m.title, m.format,
             m.description, m.starts_at::text as starts_at,
             coalesce(m.ends_at, m.starts_at + interval '1 hour')::text as ends_at,
             m.hosted, m.leader_attended
      from meetings m
      join profiles p on p.user_id = m.leader_id
      where m.id = ${data.id}
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      leaderId: row.leader_id,
      leaderName: row.leader_name,
      title: row.title,
      format: row.format,
      description: row.description,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      hosted: row.hosted,
      attended: row.leader_attended,
      mine: row.leader_id === context.userId,
      signedUp: false,
    };
  });
