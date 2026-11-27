import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ATTENDANCE_LETTER_COOLDOWN_SECONDS,
  attendanceEligibility,
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
