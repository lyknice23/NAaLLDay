import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import {
  finalizeAttendance,
  getLetterForVerification,
  listAttendanceForUser,
  recordAttendanceHeartbeat,
  recordAttendanceLetterRequest,
} from "./attendance.server.ts";

const MIGRATIONS_DIR = join(fileURLToPath(new URL("../../", import.meta.url)), "migrations");
const MEETING = "attendance-test-meeting";
const USER = "attendance-test-user";

type AttendanceSql = Parameters<typeof recordAttendanceHeartbeat>[0];
type AttendanceRow = {
  duration_seconds: number;
  left_at: string | null;
};

let pg: PGlite;
let sql: AttendanceSql;

async function seedAttendance(durationSeconds: number, secondsAgo: number) {
  await pg.query(
    `insert into meeting_attendance
       (meeting_id, user_id, first_joined_at, last_seen_at, duration_seconds)
     values ($1, $2, now(), now() - ($3::int * interval '1 second'), $4)`,
    [MEETING, USER, secondsAgo, durationSeconds],
  );
}

async function readAttendance(): Promise<AttendanceRow | undefined> {
  const result = await pg.query<AttendanceRow>(
    `select duration_seconds, left_at::text
     from meeting_attendance
     where meeting_id = $1 and user_id = $2`,
    [MEETING, USER],
  );
  return result.rows[0];
}

before(async () => {
  pg = new PGlite();
  await pg.waitReady;
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((file) => /^\d{4}_.*\.sql$/.test(file))
    .sort();
  for (const file of files) {
    await pg.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
  }
  sql = (async (strings, ...values) => {
    let text = strings[0];
    for (let index = 0; index < values.length; index += 1) {
      text += `$${index + 1}${strings[index + 1]}`;
    }
    const result = await pg.query(text, values);
    return result.rows;
  }) as AttendanceSql;
});

after(async () => {
  await pg?.close();
});

beforeEach(async () => {
  await pg.query("delete from meeting_attendance");
  await pg.query("delete from attendance_verification_requests");
  await pg.query("delete from meetings");
});

describe("recordAttendanceHeartbeat", () => {
  it("creates a zero-duration record on the first heartbeat", async () => {
    await recordAttendanceHeartbeat(sql, MEETING, USER);

    const row = await readAttendance();
    assert.ok(row);
    assert.equal(row.duration_seconds, 0);
    assert.equal(row.left_at, null);
  });

  it("adds elapsed time between heartbeats", async () => {
    await seedAttendance(10, 10);
    await recordAttendanceHeartbeat(sql, MEETING, USER);

    const row = await readAttendance();
    assert.ok(row);
    assert.ok(row.duration_seconds >= 19 && row.duration_seconds <= 40);
  });

  it("caps a long heartbeat gap at 30 seconds", async () => {
    await seedAttendance(10, 300);
    await recordAttendanceHeartbeat(sql, MEETING, USER);

    const row = await readAttendance();
    assert.ok(row);
    assert.equal(row.duration_seconds, 40);
  });
});

describe("finalizeAttendance", () => {
  it("records the final interval and leave time once", async () => {
    await seedAttendance(10, 10);
    await finalizeAttendance(sql, MEETING, USER);

    const first = await readAttendance();
    assert.ok(first);
    assert.ok(first.duration_seconds >= 19 && first.duration_seconds <= 40);
    assert.ok(first.left_at);

    await finalizeAttendance(sql, MEETING, USER);
    const second = await readAttendance();
    assert.ok(second);
    assert.equal(second.duration_seconds, first.duration_seconds);
    assert.equal(second.left_at, first.left_at);
  });
});

describe("rejoin behavior", () => {
  it("does not count time away after an explicit leave", async () => {
    await seedAttendance(10, 10);
    await finalizeAttendance(sql, MEETING, USER);

    const beforeRejoin = await readAttendance();
    assert.ok(beforeRejoin);
    assert.ok(beforeRejoin.left_at);

    // Simulate time passing after the leave without another heartbeat.
    await pg.query(
      `update meeting_attendance
       set last_seen_at = now() - interval '2 minutes'
       where meeting_id = $1 and user_id = $2`,
      [MEETING, USER],
    );
    await recordAttendanceHeartbeat(sql, MEETING, USER);

    const afterRejoin = await readAttendance();
    assert.ok(afterRejoin);
    assert.equal(afterRejoin.duration_seconds, beforeRejoin.duration_seconds);
    assert.equal(afterRejoin.left_at, null);
  });
});

describe("attendance letter records", () => {
  const REFERENCE = "6f1c2b7a-4d31-4a0e-9f2c-2b6f0d8c1a53";

  it("snapshots the issued letter and reads it back for verification", async () => {
    const snapshot = {
      reference: REFERENCE,
      participantName: "Jordan Ellis",
      meetingTitle: "Midday Discussion",
      meetingFormat: "Discussion",
      leaderName: "Sam",
      startsAt: "2026-11-27T17:00:00.000Z",
      durationSeconds: 2760,
      issuedAt: "2026-11-27T18:30:00.000Z",
    };

    await recordAttendanceLetterRequest(sql, {
      reference: REFERENCE,
      userId: USER,
      meetingId: MEETING,
      recipientEmail: "jordan@example.com",
      status: "sent",
      letterText: "letter body",
      snapshot,
    });

    const found = await getLetterForVerification(sql, REFERENCE);
    assert.ok(found);
    assert.equal(found.reference, REFERENCE);
    assert.equal(found.participantName, "Jordan Ellis");
    assert.equal(found.meetingTitle, "Midday Discussion");
    assert.equal(found.durationSeconds, 2760);
    assert.match(found.startsAt, /2026-11-27/);
  });

  it("returns null for an unknown reference", async () => {
    const found = await getLetterForVerification(
      sql,
      "00000000-0000-4000-8000-000000000000",
    );
    assert.equal(found, null);
  });
});

describe("listAttendanceForUser", () => {
  it("marks ended meetings eligible only after 45 minutes", async () => {
    await pg.query(
      `insert into meetings (id, leader_id, title, format, starts_at, ends_at)
       values
         ('past-eligible', 'leader', 'Past eligible', 'Discussion',
          now() - interval '2 hours', now() - interval '1 hour'),
         ('past-too-short', 'leader', 'Past too short', 'Discussion',
          now() - interval '2 hours', now() - interval '1 hour'),
         ('future', 'leader', 'Future', 'Discussion',
          now() + interval '1 hour', now() + interval '2 hours')`,
    );
    await pg.query(
      `insert into meeting_attendance
         (meeting_id, user_id, first_joined_at, last_seen_at, duration_seconds)
       values
         ('past-eligible', $1, now() - interval '2 hours', now() - interval '1 hour', 2700),
         ('past-too-short', $1, now() - interval '2 hours', now() - interval '1 hour', 2699),
         ('future', $1, now(), now(), 2700)`,
      [USER],
    );

    const records = await listAttendanceForUser(sql, USER);
    const byMeeting = new Map(records.map((record) => [record.meetingId, record]));

    assert.equal(byMeeting.get("past-eligible")?.eligible, true);
    assert.equal(byMeeting.get("past-too-short")?.eligible, false);
    assert.equal(byMeeting.get("future")?.eligible, false);
  });
});
