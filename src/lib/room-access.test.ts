import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import {
  JOIN_LOCK_MINUTES,
  ROOM_CAPACITY,
  buildRoomAccess,
  readMeetingAccess,
  resolveRoomState,
  roomStateMessage,
  type AccessSql,
} from "./room-access.ts";

const MIGRATIONS_DIR = join(fileURLToPath(new URL("../../", import.meta.url)), "migrations");
const START = "2026-05-01T18:00:00.000Z";
const END = "2026-05-01T19:00:00.000Z";
const LEADER = "leader-1";
const MEETING = "m1";

let pg: PGlite;
let sql: AccessSql;

/** A clock N minutes after the scheduled start. */
function at(minutes: number) {
  return new Date(new Date(START).getTime() + minutes * 60_000).toISOString();
}

function facts(now: string, overrides: Partial<Parameters<typeof resolveRoomState>[0]> = {}) {
  return {
    startsAt: START,
    endsAt: END,
    now,
    liveCount: 0,
    signupCount: 0,
    joined: false,
    isLeader: false,
    ...overrides,
  };
}

async function resetMeeting() {
  for (const table of ["room_presence", "room_joins", "meeting_signups", "meetings"]) {
    await pg.query(`delete from ${table}`);
  }
  await pg.query(
    `insert into meetings (id, leader_id, title, format, description, starts_at, ends_at)
     values ($1, $2, $3, $4, $5, $6::timestamptz, $7::timestamptz)`,
    [MEETING, LEADER, "Test meeting", "Discussion", "", START, END],
  );
}

/** Add `count` other people, each with a heartbeat `offsetSeconds` old. */
async function addPresence(count: number, asOf: string, offsetSeconds = 0) {
  const seen = new Date(new Date(asOf).getTime() - offsetSeconds * 1000).toISOString();
  for (let i = 0; i < count; i += 1) {
    await pg.query(
      `insert into room_presence (meeting_id, user_id, last_seen)
       values ($1, $2, $3::timestamptz)`,
      [MEETING, `guest-${i}`, seen],
    );
  }
}

async function addJoin(userId: string) {
  await pg.query("insert into room_joins (meeting_id, user_id) values ($1, $2)", [MEETING, userId]);
}

function accessFor(userId: string, now: string) {
  return readMeetingAccess(sql, { meetingId: MEETING, userId, now });
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
  }) as AccessSql;
});

after(async () => {
  await pg?.close();
});

beforeEach(async () => {
  await resetMeeting();
});

describe("resolveRoomState", () => {
  it("keeps the room open just before the 20-minute mark", () => {
    assert.equal(resolveRoomState(facts(at(JOIN_LOCK_MINUTES - 0.01))), "open");
  });

  it("locks at exactly 20 minutes for someone who never joined", () => {
    assert.equal(resolveRoomState(facts(at(JOIN_LOCK_MINUTES))), "locked");
  });

  it("keeps a seat for someone who joined before the lock", () => {
    assert.equal(resolveRoomState(facts(at(45), { joined: true })), "open");
  });

  it("always lets the leader open their own room", () => {
    assert.equal(resolveRoomState(facts(at(45), { isLeader: true })), "open");
  });

  it("treats the 50th person as the last one in, not the 51st", () => {
    assert.equal(resolveRoomState(facts(at(5), { liveCount: ROOM_CAPACITY - 1 })), "open");
    assert.equal(resolveRoomState(facts(at(5), { liveCount: ROOM_CAPACITY })), "full");
    assert.equal(resolveRoomState(facts(at(5), { liveCount: ROOM_CAPACITY + 5 })), "full");
  });

  it("lets a returning participant back into a full room", () => {
    assert.equal(resolveRoomState(facts(at(5), { liveCount: ROOM_CAPACITY, joined: true })), "open");
  });

  it("ends the room after the scheduled end, even for the leader", () => {
    assert.equal(resolveRoomState(facts(at(59.99), { isLeader: true })), "open");
    assert.equal(resolveRoomState(facts(at(60.01), { isLeader: true })), "ended");
  });

  it("builds the public access shape with the lock time", () => {
    const access = buildRoomAccess(facts(at(5), { liveCount: 12, signupCount: 19 }));
    assert.equal(access.state, "open");
    assert.equal(access.count, 12);
    assert.equal(access.capacity, ROOM_CAPACITY);
    assert.equal(access.signupCount, 19);
    assert.equal(access.lockAt, at(JOIN_LOCK_MINUTES));
    assert.equal(roomStateMessage("locked").length > 0, true);
  });
});

describe("readMeetingAccess against the real schema", () => {
  it("counts 50 simulated participants and stops a 51st at the door", async () => {
    await addPresence(50, at(5));
    const access = await accessFor("newcomer", at(5));
    assert.equal(access?.count, 50);
    assert.equal(access?.capacity, ROOM_CAPACITY);
    assert.equal(access?.state, "full");
  });

  it("admits the 50th participant when 49 are present", async () => {
    await addPresence(49, at(5));
    const access = await accessFor("fiftieth", at(5));
    assert.equal(access?.count, 49);
    assert.equal(access?.state, "open");
  });

  it("locks a late arrival 20 minutes in but keeps an earlier joiner in", async () => {
    await addJoin("returning");
    const late = await accessFor("late", at(JOIN_LOCK_MINUTES));
    assert.equal(late?.state, "locked");
    assert.equal(late?.joined, false);
    assert.equal(late?.lockAt, at(JOIN_LOCK_MINUTES));

    const returning = await accessFor("returning", at(JOIN_LOCK_MINUTES));
    assert.equal(returning?.state, "open");
    assert.equal(returning?.joined, true);
  });

  it("lets the leader in after the lock", async () => {
    const access = await accessFor(LEADER, at(30));
    assert.equal(access?.state, "open");
    assert.equal(access?.isLeader, true);
  });

  it("counts only heartbeats inside the presence window", async () => {
    await addPresence(50, at(5), 45);
    const access = await accessFor("newcomer", at(5));
    assert.equal(access?.count, 0);
    assert.equal(access?.state, "open");
  });

  it("reports signups separately from people in the room", async () => {
    await pg.query("insert into meeting_signups (meeting_id, user_id) values ($1, $2)", [MEETING, "signed-1"]);
    await pg.query("insert into meeting_signups (meeting_id, user_id) values ($1, $2)", [MEETING, "signed-2"]);
    await addPresence(1, at(5));
    const access = await accessFor("newcomer", at(5));
    assert.equal(access?.signupCount, 2);
    assert.equal(access?.count, 1);
  });

  it("closes the room after the end", async () => {
    await addJoin("returning");
    const access = await accessFor("returning", at(60.01));
    assert.equal(access?.state, "ended");
  });

  it("returns null for a meeting that is not on the board", async () => {
    const access = await readMeetingAccess(sql, { meetingId: "missing", userId: "someone", now: at(0) });
    assert.equal(access, null);
  });
});
