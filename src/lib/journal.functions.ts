import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { MILESTONES } from "@/lib/journal-catalog";

export type JournalEntry = {
  id: string;
  body: string;
  cleanDays: number;
  entryDate: string;
};

export type SharedAchievement = {
  id: string;
  displayName: string;
  milestoneDays: number;
  note: string;
  mine: boolean;
};

export type JournalState = {
  cleanSince: string | null;
  daysClean: number;
  today: string;
  /** The month these entries belong to, as YYYY-MM. */
  month: string;
  entries: JournalEntry[];
  sharedMine: number[];
};

function num(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function validMonth(month: string | undefined) {
  return month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? `${month}-01` : null;
}

async function loadJournal(userId: string, month?: string): Promise<JournalState> {
  const sql = await getSql();
  const todayRows = await sql<{ today: string; month: string }>`
    select current_date::text as today, to_char(current_date, 'YYYY-MM') as month
  `;
  const fallbackMonth = todayRows[0]?.month ? `${todayRows[0].month}-01` : "";
  const requested = validMonth(month) ?? fallbackMonth;
  const rows = await sql<{ clean_since: string; days: number }>`
    select clean_since::text as clean_since, (current_date - clean_since)::int as days
    from clean_journals
    where user_id = ${userId}
  `;
  const entries = requested
    ? await sql<{ id: string; body: string; clean_days: number; entry_date: string }>`
        select id, body, clean_days, entry_date::text as entry_date
        from journal_entries
        where user_id = ${userId}
          and entry_date >= ${requested}::date
          and entry_date < ${requested}::date + interval '1 month'
        order by entry_date asc
      `
    : [];
  const shares = await sql<{ milestone_days: number }>`
    select milestone_days from shared_achievements where user_id = ${userId}
  `;
  return {
    cleanSince: rows[0]?.clean_since ?? null,
    daysClean: rows[0] ? num(rows[0].days) : 0,
    today: todayRows[0]?.today ?? "",
    month: requested ? requested.slice(0, 7) : "",
    entries: entries.map((row) => ({
      id: row.id,
      body: row.body,
      cleanDays: num(row.clean_days),
      entryDate: row.entry_date,
    })),
    sharedMine: shares.map((row) => num(row.milestone_days)),
  };
}

export const getJournal = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { month?: string } | undefined) => ({ month: String(input?.month ?? "") }))
  .handler(async ({ context, data }) => loadJournal(context.userId, data.month || undefined));

export const setCleanDate = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { date: string }) => {
    const date = String(input?.date ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Choose a date.");
    return { date };
  })
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const ok = await sql<{ fine: boolean }>`
      select (${data.date}::date <= current_date) as fine
    `;
    if (!ok[0]?.fine) return { ok: false as const, error: "The clean date cannot be in the future." };
    await sql`
      insert into clean_journals (user_id, clean_since)
      values (${context.userId}, ${data.date}::date)
      on conflict (user_id) do update set clean_since = excluded.clean_since, updated_at = now()
    `;
    await sql`
      delete from shared_achievements
      where user_id = ${context.userId}
        and milestone_days > (select (current_date - clean_since) from clean_journals where user_id = ${context.userId})
    `;
    return { ok: true as const, journal: await loadJournal(context.userId) };
  });

/** Mark any day from the clean date through today, with an optional note. */
export const saveDay = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { date: string; body?: string; marked?: boolean; month?: string }) => {
    const date = String(input?.date ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Choose a day.");
    return {
      date,
      body: String(input?.body ?? "").trim().slice(0, 1000),
      marked: input?.marked !== false,
      month: String(input?.month ?? ""),
    };
  })
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const journal = await sql<{ clean_since: string; allowed: boolean }>`
      select clean_since::text as clean_since,
             (${data.date}::date >= clean_since and ${data.date}::date <= current_date) as allowed
      from clean_journals
      where user_id = ${context.userId}
    `;
    const row = journal[0];
    if (!row) return { ok: false as const, error: "Set your clean date first." };
    if (!row.allowed) return { ok: false as const, error: "Pick a day between your clean date and today." };
    if (!data.marked) {
      await sql`
        delete from journal_entries
        where user_id = ${context.userId} and entry_date = ${data.date}::date
      `;
      return { ok: true as const, journal: await loadJournal(context.userId, data.month || undefined) };
    }
    const id = crypto.randomUUID();
    await sql`
      insert into journal_entries (id, user_id, body, clean_days, entry_date)
      values (
        ${id},
        ${context.userId},
        ${data.body},
        (${data.date}::date - ${row.clean_since}::date),
        ${data.date}::date
      )
      on conflict (user_id, entry_date) do update set
        body = excluded.body,
        clean_days = excluded.clean_days
    `;
    return { ok: true as const, journal: await loadJournal(context.userId, data.month || undefined) };
  });

export const shareAchievement = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { days: number; note: string }) => {
    const days = Number(input?.days);
    if (!MILESTONES.some((item) => item.days === days)) throw new Error("That goal is not on the list.");
    return { days, note: String(input?.note ?? "").trim().slice(0, 160) };
  })
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const profile = await sql<{ display_name: string }>`
      select display_name from profiles where user_id = ${context.userId}
    `;
    if (!profile[0]) return { ok: false as const, error: "Set your first name before sharing." };
    const journal = await sql<{ days: number }>`
      select (current_date - clean_since)::int as days from clean_journals where user_id = ${context.userId}
    `;
    if (!journal[0] || num(journal[0].days) < data.days) {
      return { ok: false as const, error: "You can share a goal after you reach it." };
    }
    const id = crypto.randomUUID();
    await sql`
      insert into shared_achievements (id, user_id, milestone_days, note)
      values (${id}, ${context.userId}, ${data.days}, ${data.note})
      on conflict (user_id, milestone_days) do update set note = excluded.note
    `;
    return { ok: true as const, journal: await loadJournal(context.userId) };
  });

export const listShared = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<SharedAchievement[]> => {
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      user_id: string;
      display_name: string;
      milestone_days: number;
      note: string;
    }>`
      select s.id, s.user_id, p.display_name, s.milestone_days, s.note
      from shared_achievements s
      join profiles p on p.user_id = s.user_id
      order by s.created_at desc
      limit 40
    `;
    return rows.map((row) => ({
      id: row.id,
      displayName: row.display_name,
      milestoneDays: num(row.milestone_days),
      note: row.note,
      mine: row.user_id === context.userId,
    }));
  });
