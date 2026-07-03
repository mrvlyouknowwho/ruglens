import { readFileSync, writeFileSync, renameSync, mkdirSync, appendFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DATA_DIR = process.env.DATA_DIR || './data';
const DB_PATH = join(DATA_DIR, 'users.json');
const LEDGER_PATH = join(DATA_DIR, 'purchases.jsonl');

mkdirSync(DATA_DIR, { recursive: true });

let db = { users: {} };
if (existsSync(DB_PATH)) {
  try { db = JSON.parse(readFileSync(DB_PATH, 'utf8')); } catch { db = { users: {} }; }
}
if (!db.users) db.users = {};

let dirty = false;
function persist() {
  if (!dirty) return;
  dirty = false;
  const tmp = DB_PATH + '.tmp';
  writeFileSync(tmp, JSON.stringify(db));
  renameSync(tmp, DB_PATH);
}
setInterval(persist, 5_000).unref();
process.on('beforeExit', persist);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { persist(); process.exit(0); });

function utcDay() {
  return new Date().toISOString().slice(0, 10);
}

export function getUser(id) {
  const key = String(id);
  let u = db.users[key];
  if (!u) {
    u = db.users[key] = { credits: 0, day: utcDay(), usedToday: 0, totalChecks: 0, firstSeen: new Date().toISOString() };
    dirty = true;
  }
  if (u.day !== utcDay()) {
    u.day = utcDay();
    u.usedToday = 0;
    dirty = true;
  }
  return u;
}

export function freeLimit() {
  return Number(process.env.FREE_PER_DAY || 5);
}

// Returns {ok, source} and consumes one check; free quota first, then paid credits.
export function consumeCheck(id) {
  const u = getUser(id);
  if (u.usedToday < freeLimit()) {
    u.usedToday += 1;
    u.totalChecks += 1;
    dirty = true;
    return { ok: true, source: 'free', freeLeft: freeLimit() - u.usedToday, credits: u.credits };
  }
  if (u.credits > 0) {
    u.credits -= 1;
    u.totalChecks += 1;
    dirty = true;
    return { ok: true, source: 'credit', freeLeft: 0, credits: u.credits };
  }
  return { ok: false, freeLeft: 0, credits: 0 };
}

// Give back a check consumed by a scan that failed on our side.
export function refundCheck(id, source) {
  const u = getUser(id);
  if (source === 'credit') u.credits += 1;
  else if (u.usedToday > 0) u.usedToday -= 1;
  if (u.totalChecks > 0) u.totalChecks -= 1;
  dirty = true;
}

export function addCredits(id, n) {
  const u = getUser(id);
  u.credits += n;
  dirty = true;
  return u.credits;
}

export function recordPurchase(entry) {
  appendFileSync(LEDGER_PATH, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n');
}

export function stats() {
  const users = Object.values(db.users);
  return {
    users: users.length,
    totalChecks: users.reduce((a, u) => a + (u.totalChecks || 0), 0),
    paidCreditsOutstanding: users.reduce((a, u) => a + (u.credits || 0), 0),
    starsEarned: existsSync(LEDGER_PATH)
      ? readFileSync(LEDGER_PATH, 'utf8').trim().split('\n').filter(Boolean)
          .reduce((a, l) => { try { return a + (JSON.parse(l).stars || 0); } catch { return a; } }, 0)
      : 0,
  };
}
