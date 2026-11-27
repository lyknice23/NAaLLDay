import type { Sql } from "@/lib/db";
import {
  attendanceEligibility,
  formatDuration,
  formatUtcDateTime,
  type AttendanceRecord,
} from "./attendance.ts";

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
  legalName: string | null;
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
  legal_name: string | null;
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
           participant_profile.legal_name,
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
    legalName: row.legal_name ?? null,
    lastRequestedAt: row.last_requested_at,
  };
}

/**
 * What a letter says, frozen at the moment it is issued. The PDF and the public
 * verification page are rendered from this snapshot, so later edits to a
 * profile or meeting cannot change a letter already handed to someone.
 */
export type AttendanceLetterSnapshot = {
  reference: string;
  participantName: string;
  meetingTitle: string;
  meetingFormat: string;
  leaderName: string;
  startsAt: string;
  durationSeconds: number;
  issuedAt: string;
};

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

export function buildAttendanceLetter(
  input: AttendanceLetterSnapshot & { accountEmail: string; verifyUrl: string },
): AttendanceLetter {
  const duration = formatDuration(input.durationSeconds);
  const subject = `Attendance verification letter — ${input.meetingTitle}`;
  const text = [
    "ALL DAY NA",
    "Attendance verification",
    "",
    `Issued: ${formatUtcDateTime(input.issuedAt)}`,
    `Reference: ${input.reference}`,
    `Verify online: ${input.verifyUrl}`,
    "",
    `Participant: ${input.participantName}`,
    `Account email: ${input.accountEmail}`,
    `Meeting: ${input.meetingTitle}`,
    `Format: ${input.meetingFormat}`,
    `Meeting leader: ${input.leaderName}`,
    `Scheduled start: ${formatUtcDateTime(input.startsAt)}`,
    `Recorded attendance: approximately ${duration}`,
    "",
    `Our records show that the account holder joined this online meeting and was present for approximately ${duration}. Attendance is recorded automatically from room presence and may not include time when the connection was lost, the tab was closed, or the person stepped away.`,
    "",
    "This letter confirms platform attendance only. It does not verify identity, recovery status, or completion of any court, parole, or treatment requirement. ALL DAY NA is peer-led and is not affiliated with Narcotics Anonymous World Services.",
    "",
    "Anyone holding the reference above can confirm this letter at the verification link, and can download a PDF copy there.",
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

/** Store an issued letter with the snapshot its PDF and verification page use. */
export async function recordAttendanceLetterRequest(
  sql: Sql,
  input: {
    reference: string;
    userId: string;
    meetingId: string;
    recipientEmail: string;
    status: string;
    letterText: string;
    snapshot: AttendanceLetterSnapshot;
  },
): Promise<void> {
  const sentAt = input.status === "sent" ? new Date().toISOString() : null;
  await sql`
    insert into attendance_verification_requests
      (id, user_id, meeting_id, recipient_email, status, letter_text, sent_at,
       participant_name, meeting_title, meeting_format, leader_name,
       meeting_starts_at, duration_seconds, created_at)
    values (
      ${input.reference},
      ${input.userId},
      ${input.meetingId},
      ${input.recipientEmail},
      ${input.status},
      ${input.letterText},
      ${sentAt}::timestamptz,
      ${input.snapshot.participantName},
      ${input.snapshot.meetingTitle},
      ${input.snapshot.meetingFormat},
      ${input.snapshot.leaderName},
      ${input.snapshot.startsAt}::timestamptz,
      ${input.snapshot.durationSeconds},
      ${input.snapshot.issuedAt}::timestamptz
    )
  `;
}

type LetterRow = {
  participant_name: string;
  meeting_title: string;
  meeting_format: string;
  leader_name: string;
  starts_at: string;
  duration_seconds: number;
  issued_at: string;
};

/**
 * Public lookup by reference. The snapshotted values win; the profile, meeting,
 * and attendance joins are only fallbacks for letters issued before the
 * snapshot columns existed. The account email is deliberately not returned.
 */
export async function getLetterForVerification(
  sql: Sql,
  reference: string,
): Promise<AttendanceLetterSnapshot | null> {
  const rows = await sql<LetterRow>`
    select coalesce(r.participant_name, p.legal_name, p.display_name, 'ALL DAY NA member')
             as participant_name,
           coalesce(r.meeting_title, m.title, 'ALL DAY NA meeting') as meeting_title,
           coalesce(r.meeting_format, m.format, 'Online meeting') as meeting_format,
           coalesce(r.leader_name, lp.display_name, 'ALL DAY NA leader') as leader_name,
           coalesce(r.meeting_starts_at, m.starts_at, r.created_at)::text as starts_at,
           coalesce(r.duration_seconds, a.duration_seconds, 0) as duration_seconds,
           r.created_at::text as issued_at
    from attendance_verification_requests r
    left join profiles p on p.user_id = r.user_id
    left join meetings m on m.id = r.meeting_id
    left join profiles lp on lp.user_id = m.leader_id
    left join meeting_attendance a
      on a.meeting_id = r.meeting_id and a.user_id = r.user_id
    where r.id = ${reference}
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    reference,
    participantName: row.participant_name,
    meetingTitle: row.meeting_title,
    meetingFormat: row.meeting_format,
    leaderName: row.leader_name,
    startsAt: row.starts_at,
    durationSeconds: Number(row.duration_seconds ?? 0),
    issuedAt: row.issued_at,
  };
}
