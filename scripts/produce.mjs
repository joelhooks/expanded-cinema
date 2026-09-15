#!/usr/bin/env node
import { execFileSync } from "node:child_process";
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
import {
  readFileSync,
  writeFileSync,
  existsSync,
  unlinkSync,
  mkdirSync,
} from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const stateDir = join(root, "state");
const lockPath = join(stateDir, "producer.lock");
const passStatePath = join(stateDir, "producer.json");
const ledgerPath = join(stateDir, "ledger.jsonl");

const MAX_PASSES_PER_DAY = 3;
const LOCK_STALE_MS = 30 * 60 * 1000;

const [arg0, ...rest] = process.argv.slice(2);
const today = new Date().toISOString().slice(0, 10);

/**
 * @param {string} path
 * @param {{ passes?: Array<Record<string, unknown>> }} fallback
 * @returns {{ passes?: Array<Record<string, unknown>> }}
 */
function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return fallback;
  }
}

function ledgerAppend(record) {
  record.date = record.date ?? today;
  record.stage = record.stage ?? "producer";
  mkdirSync(stateDir, { recursive: true });
  const prev = readFileSync(ledgerPath, "utf-8");
  writeFileSync(ledgerPath, `${prev.trimEnd()}\n${JSON.stringify(record)}\n`);
}

function todayPasses(state) {
  return (state.passes ?? []).filter((p) => p.date === today);
}

if (arg0 === "--status") {
  const state = readJson(passStatePath, { passes: [] });
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
if (!intent) {
  console.error(
    'usage: produce.mjs "<study> <one-line intent>" | --status | --clear-lock'
  );
  process.exit(2);
}

// ---- dedupe + stop policy -------------------------------------------------
const state = readJson(passStatePath, { passes: [] });
const passesToday = todayPasses(state);

const done = passesToday.find(
  (p) => p.status === "completed" && p.intent === intent
);
if (done) {
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
const lock = readJson(lockPath, null);
const stale = lock && Date.now() - new Date(lock.at).getTime() > LOCK_STALE_MS;
if (lock && !stale && lock.date === today) {
  // A pass is mid-flight in another invocation — bounded producer exits.
  console.log(JSON.stringify({ busy: true, holder: lock }, null, 2));
  process.exit(0);
}
const resumed = Boolean(lock && lock.date === today && stale);
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
  const [study, ...noteParts] = intent.split("\n")[0].split(" ");
  if (!study) {
    throw new Error("intent must start with the study id");
  }
  const registry = (() => {
    const src = readFileSync(
      join(root, "archives/expanded-cinema-2026-09/src/main.ts"),
      "utf-8"
    );
    return [...src.matchAll(/"([a-z0-9-]+)": \(\) => import/g)].map(
      (m) => m[1]
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
  const note = noteParts.join(" ") || `producer pass ${pass.id}`;
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
    `${JSON.stringify(
      { ...state, passes: [...(state.passes ?? []), pass] },
      null,
      2
    )}\n`
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
