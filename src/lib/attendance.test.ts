import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ATTENDANCE_LETTER_COOLDOWN_SECONDS,
  attendanceEligibility,
  attendanceLetterPath,
  attendanceLetterPdfPath,
  isValidLetterReference,
  normalizeLegalName,
  secondsUntilLetterAllowed,
} from "./attendance.ts";

const NOW = Date.parse("2026-11-27T12:00:00.000Z");
const ENDED = new Date(NOW - 1_000).toISOString();
const UPCOMING = new Date(NOW + 1_000).toISOString();

describe("attendanceEligibility", () => {
  it("requires both the meeting end and 45 minutes of attendance", () => {
    assert.deepEqual(attendanceEligibility({ durationSeconds: 2700, endsAt: ENDED }, NOW), {
      ended: true,
      longEnough: true,
      eligible: true,
    });
  });

  it("rejects attendance shorter than 45 minutes", () => {
    assert.deepEqual(attendanceEligibility({ durationSeconds: 2699, endsAt: ENDED }, NOW), {
      ended: true,
      longEnough: false,
      eligible: false,
    });
  });

  it("rejects a meeting that has not ended, even with enough attendance", () => {
    assert.deepEqual(attendanceEligibility({ durationSeconds: 2700, endsAt: UPCOMING }, NOW), {
      ended: false,
      longEnough: true,
      eligible: false,
    });
  });

  it("treats an invalid end time as not ended", () => {
    assert.deepEqual(attendanceEligibility({ durationSeconds: 2700, endsAt: "not-a-date" }, NOW), {
      ended: false,
      longEnough: true,
      eligible: false,
    });
  });
});

describe("normalizeLegalName", () => {
  it("accepts a full name and collapses extra whitespace", () => {
    assert.equal(normalizeLegalName("  Jordan   Ellis "), "Jordan Ellis");
  });

  it("keeps hyphens, apostrophes, periods, and accented letters", () => {
    assert.equal(normalizeLegalName("Mary-Jane O'Neil-Smith Jr."), "Mary-Jane O'Neil-Smith Jr.");
    assert.equal(normalizeLegalName("José Álvarez"), "José Álvarez");
  });

  it("rejects a first name or nickname with only one word", () => {
    assert.equal(normalizeLegalName("Buffy"), null);
  });

  it("rejects digits, symbols, control characters, and empty input", () => {
    assert.equal(normalizeLegalName("Jordan Ellis 2"), null);
    assert.equal(normalizeLegalName("Jordan <Ellis>"), null);
    assert.equal(normalizeLegalName("\u0000"), null);
    assert.equal(normalizeLegalName(undefined), null);
  });

  it("rejects names longer than the printed limit", () => {
    assert.equal(normalizeLegalName(`${"a".repeat(79)} b`), null);
  });
});

describe("letter references and paths", () => {
  const reference = "6f1c2b7a-4d31-4a0e-9f2c-2b6f0d8c1a53";

  it("accepts a generated UUID and rejects anything else", () => {
    assert.equal(isValidLetterReference(reference), true);
    assert.equal(isValidLetterReference("not-a-reference"), false);
    assert.equal(isValidLetterReference(undefined), false);
  });

  it("builds the public page and PDF paths", () => {
    assert.equal(attendanceLetterPath(reference), `/verify/${reference}`);
    assert.equal(
      attendanceLetterPdfPath(reference),
      `/api/attendance-letter?reference=${reference}`,
    );
  });
});

describe("secondsUntilLetterAllowed", () => {
  it("allows a letter when no previous request exists", () => {
    assert.equal(secondsUntilLetterAllowed(null, NOW), 0);
  });

  it("returns the remaining cooldown", () => {
    const requestedAt = new Date(NOW - 20_000).toISOString();
    assert.equal(
      secondsUntilLetterAllowed(requestedAt, NOW),
      ATTENDANCE_LETTER_COOLDOWN_SECONDS - 20,
    );
  });

  it("allows another copy once the cooldown has elapsed", () => {
    const requestedAt = new Date(NOW - ATTENDANCE_LETTER_COOLDOWN_SECONDS * 1_000).toISOString();
    assert.equal(secondsUntilLetterAllowed(requestedAt, NOW), 0);
  });

  it("ignores an invalid request timestamp", () => {
    assert.equal(secondsUntilLetterAllowed("not-a-date", NOW), 0);
  });
});
