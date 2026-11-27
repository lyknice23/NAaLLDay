import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { sendAttendanceLetterEmail } from "@/lib/email.server";
import { renderAttendanceLetterPdf } from "@/lib/attendance-letter-pdf.server";
import {
  buildAttendanceLetter,
  getAttendanceForMeeting,
  getLetterForVerification,
  listAttendanceForUser,
  recordAttendanceLetterRequest,
  type AttendanceLetterSnapshot,
} from "@/lib/attendance.server";
import {
  MIN_ATTENDANCE_MINUTES,
  attendanceEligibility,
  attendanceLetterPath,
  isValidLetterReference,
  normalizeLegalName,
  secondsUntilLetterAllowed,
} from "@/lib/attendance";
import { absoluteUrl } from "@/lib/site-origin";
import { siteOrigin } from "@/lib/site-origin.server";

export const listAttendance = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const [records, profiles] = await Promise.all([
      listAttendanceForUser(sql, context.userId),
      sql<{ legal_name: string | null }>`
        select legal_name from profiles where user_id = ${context.userId}
      `,
    ]);
    return { records, legalName: profiles[0]?.legal_name ?? null };
  });

export type AttendanceLetterVerification =
  | { found: true; letter: AttendanceLetterSnapshot }
  | { found: false };

/**
 * Public: anyone holding the reference printed on a letter may check it. Only
 * the issued snapshot is returned — never the account email.
 */
export const getAttendanceLetterVerification = createServerFn({ method: "GET" })
  .validator((input: { reference?: string }) => ({
    reference: String(input?.reference ?? "").slice(0, 64),
  }))
  .handler(async ({ data }): Promise<AttendanceLetterVerification> => {
    if (!isValidLetterReference(data.reference)) return { found: false };
    const letter = await getLetterForVerification(await getSql(), data.reference);
    return letter ? { found: true, letter } : { found: false };
  });

export const requestAttendanceLetter = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { meetingId?: string; legalName?: string }) => ({
    meetingId: String(input?.meetingId ?? "").slice(0, 120),
    legalName: String(input?.legalName ?? "").slice(0, 200),
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

      const legalName = normalizeLegalName(data.legalName);
      if (!legalName) {
        return {
          ok: false as const,
          error:
            "Enter your full legal name — first and last — exactly as it should appear on the letter.",
        };
      }

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
      const verifyUrl = absoluteUrl(siteOrigin(), attendanceLetterPath(reference));
      const snapshot: AttendanceLetterSnapshot = {
        reference,
        participantName: legalName,
        meetingTitle: attendance.title,
        meetingFormat: attendance.format,
        leaderName: attendance.leaderName,
        startsAt: attendance.startsAt,
        durationSeconds: attendance.durationSeconds,
        issuedAt: new Date().toISOString(),
      };
      const letter = buildAttendanceLetter({
        ...snapshot,
        accountEmail: attendance.email,
        verifyUrl,
      });

      let attachments: { filename: string; content: string }[] | undefined;
      try {
        const pdf = await renderAttendanceLetterPdf(snapshot, { verifyUrl });
        attachments = [
          {
            filename: `attendance-letter-${reference.slice(0, 8)}.pdf`,
            content: Buffer.from(pdf).toString("base64"),
          },
        ];
      } catch (error) {
        // A PDF failure must not cost the member their letter; the verification
        // page can still render one from the stored snapshot.
        console.error("[attendance] could not render the letter PDF", error);
      }

      const sent = await sendAttendanceLetterEmail(attendance.email, { ...letter, attachments });
      if (!sent.ok) return { ok: false as const, error: sent.error };

      const status = sent.devPreview ? "preview" : "sent";
      await Promise.all([
        recordAttendanceLetterRequest(sql, {
          reference,
          userId: context.userId,
          meetingId: data.meetingId,
          recipientEmail: attendance.email,
          status,
          letterText: letter.text,
          snapshot,
        }),
        sql`
          update profiles set legal_name = ${legalName} where user_id = ${context.userId}
        `,
      ]);

      return {
        ok: true as const,
        sentTo: attendance.email,
        reference,
        preview: sent.devPreview ? letter.text : null,
      };
    },
  );
