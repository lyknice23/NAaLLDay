import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { sendAttendanceLetterEmail } from "@/lib/email.server";
import {
  buildAttendanceLetter,
  getAttendanceForMeeting,
  listAttendanceForUser,
} from "@/lib/attendance.server";
import {
  MIN_ATTENDANCE_MINUTES,
  attendanceEligibility,
  secondsUntilLetterAllowed,
} from "@/lib/attendance";

export const listAttendance = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    return listAttendanceForUser(sql, context.userId);
  });

export const requestAttendanceLetter = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { meetingId?: string }) => ({
    meetingId: String(input?.meetingId ?? "").slice(0, 120),
  }))
  .handler(
    async ({
      context,
      data,
    }): Promise<
      | {
          ok: true;
          sentTo: string;
          reference: string;
          preview: string | null;
        }
      | { ok: false; error: string }
    > => {
      if (!data.meetingId) return { ok: false as const, error: "Choose a meeting first." };

      const sql = await getSql();
      const attendance = await getAttendanceForMeeting(sql, data.meetingId, context.userId);
      if (!attendance) {
        return {
          ok: false as const,
          error: "We do not have an attendance record for that meeting.",
        };
      }

      const eligibility = attendanceEligibility(attendance);
      if (!eligibility.ended) {
        return {
          ok: false as const,
          error: "You can request a verification letter after the meeting ends.",
        };
      }
      if (!eligibility.longEnough) {
        return {
          ok: false as const,
          error: `We only issue a letter after at least ${MIN_ATTENDANCE_MINUTES} minutes of recorded attendance.`,
        };
      }
      if (!attendance.email) {
        return { ok: false as const, error: "Add an email address to your account first." };
      }
      if (!attendance.emailVerified && !attendance.oauth) {
        return {
          ok: false as const,
          error: "Verify your account email before requesting a verification letter.",
        };
      }

      const waitSeconds = secondsUntilLetterAllowed(attendance.lastRequestedAt);
      if (waitSeconds > 0) {
        return {
          ok: false as const,
          error: `Wait ${waitSeconds} seconds before requesting another copy of this letter.`,
        };
      }

      const reference = crypto.randomUUID();
      const letter = buildAttendanceLetter({
        reference,
        participantName: attendance.participantName,
        accountEmail: attendance.email,
        meetingTitle: attendance.title,
        meetingFormat: attendance.format,
        leaderName: attendance.leaderName,
        startsAt: attendance.startsAt,
        durationSeconds: attendance.durationSeconds,
      });
      const sent = await sendAttendanceLetterEmail(attendance.email, letter);
      if (!sent.ok) return { ok: false as const, error: sent.error };

      const status = sent.devPreview ? "preview" : "sent";
      await sql`
        insert into attendance_verification_requests
          (id, user_id, meeting_id, recipient_email, status, letter_text, sent_at)
        values (
          ${reference},
          ${context.userId},
          ${data.meetingId},
          ${attendance.email},
          ${status},
          ${letter.text},
          ${status === "sent" ? new Date().toISOString() : null}::timestamptz
        )
      `;

      return {
        ok: true as const,
        sentTo: attendance.email,
        reference,
        preview: sent.devPreview ? letter.text : null,
      };
    },
  );
