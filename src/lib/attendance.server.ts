import type { Sql } from "@/lib/db";
import { attendanceEligibility, formatDuration, type AttendanceRecord } from "./attendance.ts";

const ATTENDANCE_GAP_CAP_SECONDS = 30;

/**
 * Heartbeats arrive every few seconds. Capping a gap at 30 seconds prevents a
 * closed tab or lost connection from being counted as meeting time, while
 * still leaving a small buffer around the heartbeat interval. A row's
 * `left_at` marks an explicit leave, so a later rejoin does not accrue the
 * time spent away.
 */
export async function recordAttendanceHeartbeat(
  sql: Sql,
  meetingId: string,
  userId: string,
): Promise<void> {
  await sql`
    insert into meeting_attendance
      (meeting_id, user_id, first_joined_at, last_seen_at, duration_seconds)
    values (${meetingId}, ${userId}, now(), now(), 0)
    on conflict (meeting_id, user_id) do update set
      duration_seconds = meeting_attendance.duration_seconds +
        case
          when meeting_attendance.left_at is null then
            least(
              ${ATTENDANCE_GAP_CAP_SECONDS},
              greatest(
                0,
                floor(extract(epoch from (now() - meeting_attendance.last_seen_at)))
              )
            )::int
          else 0
        end,
      last_seen_at = now(),
      left_at = null
  `;
}

/** Close the current attendance window once. Repeated leave calls are no-ops. */
export async function finalizeAttendance(
  sql: Sql,
  meetingId: string,
  userId: string,
): Promise<void> {
  await sql`
    update meeting_attendance
    set duration_seconds = duration_seconds +
          least(
            ${ATTENDANCE_GAP_CAP_SECONDS},
            greatest(
              0,
              floor(extract(epoch from (now() - last_seen_at)))
            )
          )::int,
        last_seen_at = now(),
        left_at = now()
    where meeting_id = ${meetingId}
      and user_id = ${userId}
      and left_at is null
  `;
}

export async function listAttendanceForUser(sql: Sql, userId: string): Promise<AttendanceRecord[]> {
  const rows = await sql<{
    meeting_id: string;
    title: string;
    starts_at: string;
    ends_at: string;
    duration_seconds: number;
  }>`
    select a.meeting_id,
           m.title,
           m.starts_at::text as starts_at,
           coalesce(m.ends_at, m.starts_at + interval '1 hour')::text as ends_at,
           a.duration_seconds
    from meeting_attendance a
    join meetings m on m.id = a.meeting_id
    where a.user_id = ${userId}
    order by m.starts_at desc
    limit 20
  `;
  return rows.map((row) => {
    const durationSeconds = Number(row.duration_seconds ?? 0);
    return {
      meetingId: row.meeting_id,
      title: row.title,
      startsAt: row.starts_at,
      durationSeconds,
      eligible: attendanceEligibility({ durationSeconds, endsAt: row.ends_at }).eligible,
    };
  });
}

export type AttendanceForMeeting = {
  durationSeconds: number;
  title: string;
  format: string;
  leaderName: string;
  startsAt: string;
  endsAt: string;
  email: string;
  emailVerified: boolean;
  oauth: boolean;
  participantName: string;
  lastRequestedAt: string | null;
};

type AttendanceRow = {
  duration_seconds: number;
  title: string;
  format: string;
  leader_name: string;
  starts_at: string;
  ends_at: string;
  email: string;
  email_verified: boolean;
  oauth: boolean;
  participant_name: string;
  last_requested_at: string | null;
};

/** Load everything needed to decide eligibility and build a letter. */
export async function getAttendanceForMeeting(
  sql: Sql,
  meetingId: string,
  userId: string,
): Promise<AttendanceForMeeting | null> {
  const rows = await sql<AttendanceRow>`
    select attendance.duration_seconds,
           m.title,
           m.format,
           leader_profile.display_name as leader_name,
           m.starts_at::text as starts_at,
           coalesce(m.ends_at, m.starts_at + interval '1 hour')::text as ends_at,
           u.email,
           u."emailVerified" as email_verified,
           exists (
             select 1 from "account" account
             where account."userId" = u.id and account."providerId" <> 'credential'
           ) as oauth,
           participant_profile.display_name as participant_name,
           (select max(r.created_at)::text
              from attendance_verification_requests r
              where r.user_id = attendance.user_id
                and r.meeting_id = attendance.meeting_id) as last_requested_at
    from meeting_attendance attendance
    join meetings m on m.id = attendance.meeting_id
    join profiles participant_profile on participant_profile.user_id = attendance.user_id
    join profiles leader_profile on leader_profile.user_id = m.leader_id
    join "user" u on u.id = attendance.user_id
    where attendance.meeting_id = ${meetingId}
      and attendance.user_id = ${userId}
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    durationSeconds: Number(row.duration_seconds ?? 0),
    title: row.title,
    format: row.format,
    leaderName: row.leader_name,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    email: row.email,
    emailVerified: Boolean(row.email_verified),
    oauth: Boolean(row.oauth),
    participantName: row.participant_name,
    lastRequestedAt: row.last_requested_at,
  };
}

function utcDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date)} UTC`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

export type AttendanceLetter = {
  subject: string;
  text: string;
  html: string;
};

export function buildAttendanceLetter(input: {
  reference: string;
  participantName: string;
  accountEmail: string;
  meetingTitle: string;
  meetingFormat: string;
  leaderName: string;
  startsAt: string;
  durationSeconds: number;
}): AttendanceLetter {
  const duration = formatDuration(input.durationSeconds);
  const subject = `Attendance verification letter — ${input.meetingTitle}`;
  const text = [
    "ALL DAY NA",
    "Attendance verification",
    "",
    `Issued: ${utcDate(new Date().toISOString())}`,
    `Reference: ${input.reference}`,
    "",
    `Participant: ${input.participantName}`,
    `Account email: ${input.accountEmail}`,
    `Meeting: ${input.meetingTitle}`,
    `Format: ${input.meetingFormat}`,
    `Meeting leader: ${input.leaderName}`,
    `Scheduled start: ${utcDate(input.startsAt)}`,
    `Recorded attendance: approximately ${duration}`,
    "",
    `Our records show that the account holder joined this online meeting and was present for approximately ${duration}. Attendance is recorded automatically from room presence and may not include time when the connection was lost, the tab was closed, or the person stepped away.`,
    "",
    "This letter confirms platform attendance only. It does not verify identity, recovery status, or completion of any court, parole, or treatment requirement. ALL DAY NA is peer-led and is not affiliated with Narcotics Anonymous World Services.",
    "",
    "Questions about this letter: support@alldayna.xyz",
  ].join("\n");

  return {
    subject,
    text,
    html: [
      '<div style="font-family:system-ui,sans-serif;line-height:1.6;color:#1c2118">',
      '<h1 style="font-size:24px;margin:0 0 4px">ALL DAY NA</h1>',
      '<p style="margin:0 0 20px;font-weight:600">Attendance verification</p>',
      `<pre style="white-space:pre-wrap;font-family:inherit;font-size:14px;margin:0">${escapeHtml(text)}</pre>`,
      "</div>",
    ].join(""),
  };
}
