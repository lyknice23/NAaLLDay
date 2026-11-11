import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { ROOM_CAPACITY } from "@/lib/meetings.functions";

export type AppNotification = {
  id: string;
  kind: "meeting" | "clean";
  title: string;
  body: string;
  href: string;
  read: boolean;
  createdAt: string;
};

function num(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

async function ensureNotice(
  userId: string,
  notice: { dedupe: string; kind: "meeting" | "clean"; title: string; body: string; href: string },
) {
  const sql = await getSql();
  const id = crypto.randomUUID();
  await sql`
    insert into notifications (id, user_id, kind, title, body, href, dedupe_key)
    values (${id}, ${userId}, ${notice.kind}, ${notice.title}, ${notice.body}, ${notice.href}, ${notice.dedupe})
    on conflict (user_id, dedupe_key) do nothing
  `;
}

async function syncReminders(userId: string) {
  const sql = await getSql();
  const meetings = await sql<{ id: string; title: string; starts_at: string; ends_at: string }>`
    select m.id, m.title, m.starts_at::text as starts_at,
           coalesce(m.ends_at, m.starts_at + interval '1 hour')::text as ends_at
    from meetings m
    where coalesce(m.ends_at, m.starts_at + interval '1 hour') > now()
      and (
        m.leader_id = ${userId}
        or exists (
          select 1 from meeting_signups s
          where s.meeting_id = m.id and s.user_id = ${userId}
        )
      )
  `;
  const now = Date.now();
  for (const meeting of meetings) {
    const start = new Date(meeting.starts_at).getTime();
    const end = new Date(meeting.ends_at).getTime();
    if (Number.isNaN(start) || Number.isNaN(end)) continue;
    const href = `/room/${meeting.id}`;
    if (start - now <= 15 * 60 * 1000 && end > now) {
      await ensureNotice(userId, {
        dedupe: `meeting:${meeting.id}:live`,
        kind: "meeting",
        title: `${meeting.title} is starting`,
        body: "You signed up for this meeting. The room is open.",
        href,
      });
    } else if (start > now && start - now <= 24 * 60 * 60 * 1000) {
      await ensureNotice(userId, {
        dedupe: `meeting:${meeting.id}:soon`,
        kind: "meeting",
        title: `${meeting.title} is coming up`,
        body: "You're signed up. It starts within a day.",
        href,
      });
    }
  }

  const todayRows = await sql<{ today: string }>`select current_date::text as today`;
  const today = todayRows[0]?.today ?? "";
  const journal = await sql<{ days: number; checked: boolean }>`
    select (current_date - j.clean_since)::int as days,
           exists (
             select 1 from journal_entries e
             where e.user_id = j.user_id and e.entry_date = current_date
           ) as checked
    from clean_journals j
    where j.user_id = ${userId}
  `;
  const row = journal[0];
  if (row?.checked) {
    await sql`
      update notifications
      set read_at = coalesce(read_at, now())
      where user_id = ${userId} and dedupe_key = ${`clean:${today}`}
    `;
    return;
  }
  const days = row ? num(row.days) : null;
  await ensureNotice(userId, {
    dedupe: `clean:${today}`,
    kind: "clean",
    title: "Remember to stay clean",
    body:
      days == null
        ? "Today counts. Your journal is there when you want to mark it."
        : `Day ${days}. Stay clean today, and mark it in your journal.`,
    href: "/journal",
  });
}

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<AppNotification[]> => {
    await syncReminders(context.userId);
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      kind: "meeting" | "clean";
      title: string;
      body: string;
      href: string;
      read_at: string | null;
      created_at: string;
    }>`
      select id, kind, title, body, href, read_at::text as read_at, created_at::text as created_at
      from notifications
      where user_id = ${context.userId}
      order by created_at desc
      limit 40
    `;
    return rows.map((row) => ({
      id: row.id,
      kind: row.kind === "clean" ? "clean" : "meeting",
      title: row.title,
      body: row.body,
      href: row.href,
      read: row.read_at != null,
      createdAt: row.created_at,
    }));
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id?: string }) => ({ id: String(input?.id ?? "") }))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    if (data.id) {
      await sql`
        update notifications set read_at = coalesce(read_at, now())
        where user_id = ${context.userId} and id = ${data.id}
      `;
    } else {
      await sql`
        update notifications set read_at = coalesce(read_at, now())
        where user_id = ${context.userId} and read_at is null
      `;
    }
    return { ok: true as const };
  });

export const setSignup = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { meetingId: string; going: boolean }) => ({
    meetingId: String(input?.meetingId ?? ""),
    going: input?.going === true,
  }))
  .handler(async ({ context, data }) => {
    if (!data.meetingId) return { ok: false as const, error: "Missing meeting." };
    const sql = await getSql();
    const found = await sql<{ id: string; ends_at: string }>`
      select id, coalesce(ends_at, starts_at + interval '1 hour')::text as ends_at
      from meetings where id = ${data.meetingId}
    `;
    if (!found[0]) return { ok: false as const, error: "That meeting is not on the board." };
    if (data.going) {
      if (new Date(found[0].ends_at).getTime() < Date.now()) {
        return { ok: false as const, error: "That meeting has ended." };
      }
      const seats = await sql<{ n: number }>`
        select count(*)::int as n from meeting_signups where meeting_id = ${data.meetingId}
      `;
      if (num(seats[0]?.n) >= ROOM_CAPACITY) {
        return { ok: false as const, error: "This meeting is full (50 seats)." };
      }
      await sql`
        insert into meeting_signups (meeting_id, user_id)
        values (${data.meetingId}, ${context.userId})
        on conflict (meeting_id, user_id) do nothing
      `;
    } else {
      await sql`
        delete from meeting_signups
        where meeting_id = ${data.meetingId} and user_id = ${context.userId}
      `;
    }
    return { ok: true as const };
  });
