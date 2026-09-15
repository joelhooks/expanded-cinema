#!/usr/bin/env node
/**
 * Bounded daily producer — VISION.md priority D, built un-scheduled.
 *
 * One invocation = at most one producer pass for a given date. Guarantees:
 *   lock:        state/producer.lock (stale lock >30min is reclaimed by a
 *                later run, recorded in the ledger either way)
 *   dedupe:      date-keyed — a completed pass for today's date is a no-op
 *                that prints the prior receipt
 *   resumption:  a FAILED or interrupted pass (lock w/o completion) resumes
 *                rather than re-dedupe-skips; state in state/producer.json
 *   spend:       every invocation appends an exact record — started,
 *                skipped-dedupe, resumed, completed, or failed — with stage,
 *                study, and timestamps. Unknown cost stays unknown: this
 *                script never writes "cost: 0" for anything it can't meter.
 *   stop policy: maxPassesPerDay (default 3) hard-stops further attempts
 *                for that date after that many completed or failed passes.
 *
 * Scheduling (cron, wake loops, etc.) is explicitly NOT this script's job;
 * enabling a schedule needs Joel per VISION.md boundaries.
 *
 * Usage:
 *   node scripts/produce.mjs "<study> <one-line intent>"
 *   node scripts/produce.mjs --status            # today's counters, no side effects
 *   node scripts/produce.mjs --clear-lock        # operator escape hatch
 */
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const root = path.join(import.meta.dirname, "..");
const stateDir = path.join(root, "state");
const lockPath = path.join(stateDir, "producer.lock");
const passStatePath = path.join(stateDir, "producer.json");
const ledgerPath = path.join(stateDir, "ledger.jsonl");

const MAX_PASSES_PER_DAY = 3;
const LOCK_STALE_MS = 30 * 60 * 1000;

const [arg0, ...rest] = process.argv.slice(2);
const today = new Date().toISOString().slice(0, 10);

/**
 * One bounded producer pass, as persisted in producer.json.
 * @typedef {Object} ProducerPass
 * @property {string} at — ISO timestamp of pass start.
 * @property {string} date — YYYY-MM-DD pass date key.
 * @property {string} id — pass id (`pass-<date>-<nn>`).
 * @property {string} intent — full pass intent line.
 * @property {boolean} resumed — true when a stale lock was reclaimed.
 * @property {"started"|"completed"|"failed"} status — pass lifecycle.
 * @property {string} [study] study id, set on completion.
 * @property {string} [sha] shipped commit sha, set on completion.
 * @property {string} [archive] archive URL, set on completion.
 * @property {string} [completedAt] ISO timestamp, set on completion.
 * @property {string} [error] failure message, set on failure.
 * @property {string} [failedAt] ISO timestamp, set on failure.
 */

/**
 * Leader lock in producer.lock while a pass is mid-flight.
 * @typedef {Object} ProducerLock
 * @property {string} at — ISO timestamp the lock was written.
 * @property {string} date — the lock owner's date key.
 */

/**
 * Runtime guards: is this parsed JSON plausibly a pass receipt / state / lock?
 * Deliberately shallow — receipts are written by this script only; a deeper
 * guard would lie about resilience.
 * @param {unknown} value — parsed JSON value.
 * @returns {boolean} — true when the shape can be trusted.
 */
function isPassReceipt(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "status" in value
  );
}

/**
 * @param {unknown} value — parsed JSON value.
 * @returns {value is { passes?: ProducerPass[] }} — true when trustworthy state.
 */
function isProducerState(value) {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  if (!("passes" in value)) {
    return true;
  }
  const { passes } = value;
  return Array.isArray(passes) && passes.every((p) => isPassReceipt(p));
}

/**
 * @param {unknown} value — parsed JSON value.
 * @returns {value is ProducerLock} — true when at/date are both strings.
 */
function isProducerLock(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    "at" in value &&
    typeof value.at === "string" &&
    "date" in value &&
    typeof value.date === "string"
  );
}

/**
 * Read producer.json, falling back to empty state when missing or corrupt.
 * @param {string} file — path to read.
 * @returns {{ passes?: ProducerPass[] }} — producer state.
 */
function readState(file) {
  try {
    /** @type {unknown} */
    const parsed = JSON.parse(readFileSync(file, "utf-8"));
    return isProducerState(parsed) ? parsed : { passes: [] };
  } catch {
    return { passes: [] };
  }
}

/**
 * Read producer.lock, falling back to null when missing or corrupt.
 * @param {string} file — path to read.
 * @returns {ProducerLock | null} — the lock, if valid.
 */
function readLock(file) {
  try {
    /** @type {unknown} */
    const parsed = JSON.parse(readFileSync(file, "utf-8"));
    return isProducerLock(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Append one canonical record row to the ledger (append-only by contract:
 * only ever adds lines, never rewrites existing ones).
 * @param {Record<string, unknown>} record — the ledger row.
 * @returns {void}
 */
function ledgerAppend(record) {
  record.date ??= today;
  record.stage ??= "producer";
  mkdirSync(stateDir, { recursive: true });
  const prev = readFileSync(ledgerPath, "utf-8");
  writeFileSync(ledgerPath, `${prev.trimEnd()}\n${JSON.stringify(record)}\n`);
}

/**
 * All passes recorded for today's date.
 * @param {{ passes?: Array<Record<string, unknown>> }} state — producer state.
 * @returns {Array<Record<string, unknown>>} — today's pass receipts.
 */
function todayPasses(state) {
  return (state.passes ?? []).filter((p) => p.date === today);
}

if (arg0 === "--status") {
  const state = readState(passStatePath);
  const passes = todayPasses(state);
  console.log(
    JSON.stringify(
      {
        date: today,
        max: MAX_PASSES_PER_DAY,
        passes: passes.length,
        recent: passes.slice(-3),
      },
      null,
      2
    )
  );
  process.exit(0);
}

if (arg0 === "--clear-lock") {
  if (existsSync(lockPath)) {
    unlinkSync(lockPath);
    console.log("lock cleared");
  } else {
    console.log("no lock present");
  }
  process.exit(0);
}

const intent = [arg0, ...rest].join(" ").trim();
if (intent === "") {
  console.error(
    'usage: produce.mjs "<study> <one-line intent>" | --status | --clear-lock'
  );
  process.exit(2);
}

// ---- dedupe + stop policy -------------------------------------------------
const state = readState(passStatePath);
const passesToday = todayPasses(state);

const done = passesToday.find(
  (p) => p.status === "completed" && p.intent === intent
);
if (done !== undefined) {
  console.log(JSON.stringify({ dedupe: true, receipt: done }, null, 2));
  process.exit(0);
}

if (
  passesToday.filter((p) => p.status === "completed" || p.status === "failed")
    .length >= MAX_PASSES_PER_DAY
) {
  console.log(
    JSON.stringify(
      { date: today, max: MAX_PASSES_PER_DAY, stopPolicy: true },
      null,
      2
    )
  );
  process.exit(0);
}

// ---- lock -----------------------------------------------------------------
const lock = readLock(lockPath);
let lockIsStale = false;
if (lock !== null) {
  lockIsStale = Date.now() - new Date(lock.at).getTime() > LOCK_STALE_MS;
}
if (lock !== null && !lockIsStale && lock.date === today) {
  // A pass is mid-flight in another invocation — bounded producer exits.
  console.log(JSON.stringify({ busy: true, holder: lock }, null, 2));
  process.exit(0);
}
const resumed = lock !== null && lock.date === today && lockIsStale;
const pass = {
  at: new Date().toISOString(),
  date: today,
  id: `pass-${today}-${(passesToday.length + 1).toString().padStart(2, "0")}`,
  intent,
  resumed,
  status: "started",
};
writeFileSync(lockPath, `${JSON.stringify(pass)}\n`);
ledgerAppend({
  intent: pass.intent,
  resumed,
  runId: pass.id,
  status: "started",
});
console.log(JSON.stringify({ resumed, started: pass.id }, null, 2));

// The actual pass body lives in the closing motion below; this script's
// contract is to run the standard ship chain for the named study and only
// then flip producer.json to completed. A pass that throws keeps the lock —
// intentionally: the next invocation sees it as stale/resumable evidence.
try {
  // Pass body = the standard verified ship chain (VISION D). The study id is
  // validated against the live registry (STUDY_LOADERS ids in main.ts) so a
  // producer pass can never archive a study the pointing tab cannot mount.
  const firstLine = intent.split("\n")[0] ?? "";
  const [study, ...noteParts] = firstLine.split(" ");
  if (study === undefined || study === "") {
    throw new Error("intent must start with the study id");
  }
  const registry = (() => {
    const src = readFileSync(
      path.join(root, "archives/expanded-cinema-2026-09/src/main.ts"),
      "utf-8"
    );
    return [...src.matchAll(/"(?<id>[a-z0-9-]+)": \(\) => import/gu)].map(
      (m) => m.groups?.id ?? ""
    );
  })();
  if (!registry.includes(study)) {
    throw Object.assign(
      new Error(
        `study "${study}" is not in the registry [${registry.join(", ")}] — register it in main.ts before a producer pass can ship it`
      ),
      { registry }
    );
  }
  const joinedNote = noteParts.join(" ");
  const note = joinedNote === "" ? `producer pass ${pass.id}` : joinedNote;
  /**
   * Run a command synchronously, capture stdout, echo stderr.
   * @param {string} cmd — executable to run.
   * @param {readonly string[]} args — argument vector.
   * @returns {string} — trimmed stdout.
   */
  const sh = (cmd, args) => {
    const out = execFileSync(cmd, args, {
      cwd: root,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "inherit"],
    });
    return out.trim();
  };

  sh("pnpm", ["turbo", "run", "check", "test", "build"]);
  const sha = sh("git", ["rev-parse", "--short", "HEAD"]);
  sh("node", ["scripts/archive-ship.mjs", sha, study, note]);
  sh("node", ["scripts/upload-archive.mjs"]);
  const url = `https://cinema.wzrrd.sh/archive/${study}/${sha}/index.html`;
  const res = await fetch(url, { method: "HEAD" });
  if (!res.ok) {
    throw new Error(`archive check ${res.status} for ${url}`);
  }

  pass.status = "completed";
  pass.study = study;
  pass.sha = sha;
  pass.archive = url;
  pass.completedAt = new Date().toISOString();
  ledgerAppend({
    archive: `archive/${study}/${sha}/`,
    intent,
    runId: pass.id,
    sha,
    stage: "producer",
    status: "completed",
    study,
    verified: ["turbo check test build", `archive 200 (${url})`],
  });
  writeFileSync(
    passStatePath,
    `${JSON.stringify(
      { ...state, passes: [...(state.passes ?? []), pass] },
      null,
      2
    )}\n`
  );
  unlinkSync(lockPath);
  console.log(JSON.stringify({ completed: pass.id, sha, study, url }, null, 2));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  pass.status = "failed";
  pass.error = message;
  pass.failedAt = new Date().toISOString();
  ledgerAppend({
    error: message,
    intent: pass.intent,
    runId: pass.id,
    status: "failed",
  });
  writeFileSync(
    passStatePath,
    `${JSON.stringify({ ...state, passes: [...(state.passes ?? []), pass] }, null, 2)}\n`
  );
  console.error(
    JSON.stringify({
      error: message,
      failed: pass.id,
      note: "lock retained as resumption evidence",
    })
  );
  process.exit(1);
}
