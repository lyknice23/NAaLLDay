/** Client-safe attendance types and formatting. */

/** Recorded time a member needs before an attendance letter can be requested. */
export const MIN_ATTENDANCE_MINUTES = 45;
export const MIN_ATTENDANCE_SECONDS = MIN_ATTENDANCE_MINUTES * 60;
export const ATTENDANCE_LETTER_COOLDOWN_SECONDS = 60;

/** Longest legal name accepted on a letter; the request form uses the same limit. */
export const LEGAL_NAME_MAX_LENGTH = 80;

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

/** Long, unambiguous UTC timestamp: a letter may be read in any time zone. */
export function formatUtcDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date)} UTC`;
}

/**
 * Clean up a legal name typed for a letter. The meeting display name is often a
 * first name or nickname, so a letter needs a full name the member enters on
 * purpose: letters plus the punctuation real names use (hyphens, apostrophes,
 * periods), and at least two words.
 */
function stripControlCharacters(value: string): string {
  let out = "";
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    out += code < 32 || code === 127 ? " " : character;
  }
  return out;
}

export function normalizeLegalName(raw: unknown): string | null {
  const value = stripControlCharacters(String(raw ?? ""))
    .replace(/\s+/g, " ")
    .trim();
  if (value.length < 3 || value.length > LEGAL_NAME_MAX_LENGTH) return null;
  if (!/^[\p{L}\p{M}'.\- ]+$/u.test(value)) return null;
  const words = value.split(" ").filter((word) => /\p{L}{2}/u.test(word));
  if (words.length < 2) return null;
  return value;
}

const LETTER_REFERENCE_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** References are UUIDs generated when a letter is issued. */
export function isValidLetterReference(value: unknown): value is string {
  return typeof value === "string" && LETTER_REFERENCE_PATTERN.test(value.trim());
}

/** Public page where anyone holding the reference can check the letter. */
export function attendanceLetterPath(reference: string): string {
  return `/verify/${encodeURIComponent(reference)}`;
}

/** Direct PDF copy, rendered from the stored record on each request. */
export function attendanceLetterPdfPath(reference: string): string {
  return `/api/attendance-letter?reference=${encodeURIComponent(reference)}`;
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
