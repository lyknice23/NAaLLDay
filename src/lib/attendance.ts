/** Client-safe attendance types and formatting. */

/** Recorded time a member needs before an attendance letter can be requested. */
export const MIN_ATTENDANCE_MINUTES = 45;
export const MIN_ATTENDANCE_SECONDS = MIN_ATTENDANCE_MINUTES * 60;
export const ATTENDANCE_LETTER_COOLDOWN_SECONDS = 60;

/** The small shape the homepage needs; the letter request loads the rest. */
export type AttendanceRecord = {
  meetingId: string;
  title: string;
  startsAt: string;
  durationSeconds: number;
  eligible: boolean;
};

export function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.round(Number(seconds) || 0));
  if (safe < 60) return safe === 1 ? "1 second" : `${safe} seconds`;
  const totalMinutes = Math.round(safe / 60);
  if (totalMinutes < 60) {
    return `${totalMinutes} minute${totalMinutes === 1 ? "" : "s"}`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours} hour${hours === 1 ? "" : "s"}${minutes ? ` ${minutes} minute${minutes === 1 ? "" : "s"}` : ""}`;
}

export function attendanceEligibility(
  input: { durationSeconds: number; endsAt: string },
  now = Date.now(),
): { ended: boolean; longEnough: boolean; eligible: boolean } {
  const endsAt = new Date(input.endsAt).getTime();
  const ended = Number.isFinite(endsAt) && endsAt <= now;
  const longEnough = Number(input.durationSeconds) >= MIN_ATTENDANCE_SECONDS;
  return { ended, longEnough, eligible: ended && longEnough };
}

export function secondsUntilLetterAllowed(
  lastRequestedAt: string | null,
  now = Date.now(),
): number {
  if (!lastRequestedAt) return 0;
  const requestedAt = new Date(lastRequestedAt).getTime();
  if (!Number.isFinite(requestedAt)) return 0;
  return Math.max(
    0,
    Math.ceil((ATTENDANCE_LETTER_COOLDOWN_SECONDS * 1000 - (now - requestedAt)) / 1000),
  );
}
