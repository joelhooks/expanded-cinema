/**
 * cinema-loop: the iteration loop enforced at the hook level.
 *
 * Every rule below was broken by a model at least once during the 2026-09
 * run, so each is enforced here rather than in prose:
 *
 * 1. A pointer cut (PUT /mcp/content/current or make-cut.mjs) is blocked
 *    unless state/verdicts/<sha>.json exists, says pass, and is fresh.
 * 2. The ledger is append-only: commits that delete ledger lines are
 *    blocked, write/edit on the ledger is blocked; use cinema_ledger_append.
 * 3. Doctrine (VISION.md, AGENTS.md, .pi/**) is read-only for the loop agent.
 *    Set CINEMA_ROLE=director to edit it.
 * 4. Ship, then start: when the agent goes idle in loop mode it is kicked
 *    with the next iteration (rate limited).
 * 5. cinema_verify captures frames and runs the vision critic. The builder
 *    never grades its own screenshot.
 *
 * State: state/loop.json. Verdicts: state/verdicts/<sha>.json. Frames: critiques/.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { execFileSync, execSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = process.cwd();
const LOOP_FILE = join(ROOT, "state", "loop.json");
const VERDICT_DIR = join(ROOT, "state", "verdicts");
const LEDGER = join(ROOT, "state", "ledger.jsonl");
const FRAME_DIR = join(ROOT, "critiques");
const ARCHIVE_ROOT = "https://cinema.wzrrd.sh";
const VL_MODEL = "mlx-community/Qwen2.5-VL-7B-Instruct-4bit";
const VERDICT_MAX_AGE_MS = 45 * 60 * 1000;
const KICK_MIN_GAP_MS = 90 * 1000;
const KICK_MAX_PER_HOUR = 20;

type LoopState = {
  mode: "loop" | "paused";
  study: string;
  lastVerifiedSha?: string;
  lastCutSha?: string;
  kicks: number[];
  note?: string;
};

type Verdict = {
  study: string;
  sha: string;
  at: string;
  frames: string[];
  framesDiffer: boolean;
  titleCard: boolean;
  operationVisible: string;
  floor: Record<string, boolean>;
  pass: boolean;
  critic: string;
  raw: string;
};

function isDirector(): boolean {
  return process.env.CINEMA_ROLE === "director";
}

function readLoop(): LoopState {
  try {
    return JSON.parse(readFileSync(LOOP_FILE, "utf8")) as LoopState;
  } catch {
    return { mode: "paused", study: "", kicks: [] };
  }
}

function writeLoop(s: LoopState): void {
  mkdirSync(join(ROOT, "state"), { recursive: true });
  writeFileSync(LOOP_FILE, `${JSON.stringify(s, null, 2)}\n`);
}

function verdictPath(sha: string): string {
  return join(VERDICT_DIR, `${sha}.json`);
}

function freshPassingVerdict(sha: string): { ok: boolean; reason: string } {
  const p = verdictPath(sha);
  if (!existsSync(p)) return { ok: false, reason: `no verdict for ${sha}; run cinema_verify first` };
  const age = Date.now() - statSync(p).mtimeMs;
  if (age > VERDICT_MAX_AGE_MS) {
    return { ok: false, reason: `verdict for ${sha} is ${Math.round(age / 60000)} min old; re-run cinema_verify` };
  }
  const v = JSON.parse(readFileSync(p, "utf8")) as Verdict;
  if (!v.pass) return { ok: false, reason: `verdict for ${sha} is FAIL: ${v.critic.slice(0, 200)}` };
  return { ok: true, reason: "" };
}

function shaFrom(text: string): string | undefined {
  const m = text.match(/\b[0-9a-f]{7,40}\b/);
  return m?.[0];
}

function stagedLedgerDeletions(): number {
  try {
    const out = execSync("git diff --cached --numstat -- state/ledger.jsonl", { cwd: ROOT, encoding: "utf8" });
    const line = out.trim().split("\n")[0];
    if (!line) return 0;
    const [, del] = line.split("\t");
    return Number(del) || 0;
  } catch {
    return 0;
  }
}

function stagedDoctrine(): string[] {
  try {
    const out = execSync("git diff --cached --name-only", { cwd: ROOT, encoding: "utf8" });
    return out.split("\n").filter((f) => f === "VISION.md" || f === "AGENTS.md" || f.startsWith(".pi/"));
  } catch {
    return [];
  }
}

function relPath(p: string): string {
  return resolve(ROOT, p).slice(ROOT.length + 1);
}

function isDoctrinePath(p: string): boolean {
  const rel = relPath(p);
  return rel === "VISION.md" || rel === "AGENTS.md" || rel.startsWith(".pi/");
}

function isLedgerPath(p: string): boolean {
  return resolve(ROOT, p) === LEDGER;
}

const CRITIC_PROMPT = `You are judging two screenshots of a WebGPU projection study, taken 5 and 16 seconds after page load. Answer as strict JSON only, no prose outside the JSON:
{"framesDiffer": boolean, "titleCard": boolean, "space": boolean, "apparatus": boolean, "motion": boolean, "filmAsMaterial": boolean, "frameFilled": boolean, "colour": boolean, "operationVisible": "<one sentence pointing to where the study's operation is visible in the second frame, or 'none'>", "notes": "<one sentence>"}
Definitions: framesDiffer = the two frames show a different picture beyond the film's own cut. titleCard = any film title card, credits, or static slate is visible. space = the scene reads as a room with depth. apparatus = a projector, beam, or landing surface with an edge is visible. motion = light, camera, or surface moved between frames. filmAsMaterial = footage is warped, split, delayed, or landed on form rather than shown as a plain rectangle. frameFilled = the frame is not mostly black void. colour = saturated colour is present in the room, not only on a plate.`;

function runCritic(frames: string[]): { parsed: Record<string, unknown> | undefined; raw: string } {
  const args = [
    "--from",
    "mlx-vlm",
    "mlx_vlm.generate",
    "--model",
    VL_MODEL,
    "--image",
    ...frames,
    "--prompt",
    CRITIC_PROMPT,
    "--max-tokens",
    "400",
    "--temperature",
    "0",
  ];
  let raw = "";
  try {
    raw = execFileSync("uvx", args, { cwd: ROOT, encoding: "utf8", timeout: 300_000, stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    raw = `${err.stdout ?? ""}\n${err.stderr ?? ""}\n${err.message ?? ""}`;
  }
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return { parsed: undefined, raw };
  try {
    return { parsed: JSON.parse(m[0]) as Record<string, unknown>, raw };
  } catch {
    return { parsed: undefined, raw };
  }
}

function captureFrames(url: string, study: string, sha: string): string[] {
  mkdirSync(FRAME_DIR, { recursive: true });
  const a = join(FRAME_DIR, `${study}-${sha}-5s.png`);
  const b = join(FRAME_DIR, `${study}-${sha}-16s.png`);
  execFileSync(
    "agent-browser",
    ["--namespace", "cinemaloop", "--session", "verify", "batch", `open ${url}`, "wait 5000", `screenshot ${a}`, "wait 11000", `screenshot ${b}`, "close"],
    { cwd: ROOT, encoding: "utf8", timeout: 120_000, stdio: ["ignore", "pipe", "pipe"] },
  );
  for (const f of [a, b]) {
    if (!existsSync(f) || statSync(f).size < 2000) throw new Error(`frame missing or empty: ${f}`);
  }
  return [a, b];
}

function framesIdentical(a: string, b: string): boolean {
  const x = readFileSync(a);
  const y = readFileSync(b);
  return x.length === y.length && x.equals(y);
}

export default function cinemaLoop(pi: ExtensionAPI) {
  mkdirSync(VERDICT_DIR, { recursive: true });

  pi.on("tool_call", async (event) => {
    const input = event.input as Record<string, unknown>;
    if (event.toolName === "bash") {
      const cmd = String(input.command ?? "");
      if (/--no-verify\b/.test(cmd)) {
        return { block: true, reason: "cinema-loop: hook bypass is not allowed; fix the failing check." };
      }
      if (/mcp\/content\/current|make-cut\.mjs/.test(cmd)) {
        const sha = shaFrom(cmd.replace(/https?:\/\/\S+/g, ""));
        if (!sha) return { block: true, reason: "cinema-loop: a cut must name the sha; run cinema_verify on it first." };
        const v = freshPassingVerdict(sha);
        if (!v.ok) return { block: true, reason: `cinema-loop: cut refused. ${v.reason}` };
      }
      if (/\bgit\s+commit\b/.test(cmd)) {
        if (stagedLedgerDeletions() > 0) {
          return {
            block: true,
            reason: "cinema-loop: the ledger is append-only. Unstage the deletion and add a superseding row with cinema_ledger_append.",
          };
        }
        const doctrine = stagedDoctrine();
        if (doctrine.length > 0 && !isDirector()) {
          return {
            block: true,
            reason: `cinema-loop: doctrine is read-only for the loop agent (${doctrine.join(", ")}). Propose the change in a critique instead.`,
          };
        }
      }
      if (/\brm\b[^\n]*ledger\.jsonl/.test(cmd) || /(^|[^>])>\s*state\/ledger\.jsonl/.test(cmd)) {
        return { block: true, reason: "cinema-loop: the ledger is append-only. Use cinema_ledger_append." };
      }
    }
    if (event.toolName === "write" || event.toolName === "edit") {
      const p = String(input.path ?? "");
      if (isLedgerPath(p)) return { block: true, reason: "cinema-loop: the ledger is append-only. Use cinema_ledger_append." };
      if (isDoctrinePath(p) && !isDirector()) {
        return {
          block: true,
          reason: "cinema-loop: doctrine is read-only for the loop agent. Propose the change in a critique; Joel or the director applies it.",
        };
      }
    }
    return undefined;
  });

  pi.on("agent_settled", async (_event, ctx) => {
    const s = readLoop();
    if (s.mode !== "loop" || !ctx.isIdle()) return;
    const now = Date.now();
    s.kicks = (s.kicks ?? []).filter((t) => now - t < 3_600_000);
    const last = s.kicks[s.kicks.length - 1] ?? 0;
    if (now - last < KICK_MIN_GAP_MS || s.kicks.length >= KICK_MAX_PER_HOUR) return;
    s.kicks.push(now);
    writeLoop(s);
    pi.sendUserMessage(
      `Loop tick (${s.kicks.length}/${KICK_MAX_PER_HOUR} this hour). You went idle in loop mode. Read state/loop.json, .brain/resources/direction.svx, and the iteration-loop skill, then start the next iteration now: one variable, build, archive-ship, cinema_verify, then cut or record the fail with cinema_ledger_append. Do not end the turn without a ledger row.`,
    );
  });

  pi.on("session_start", async (_event, ctx) => {
    const s = readLoop();
    ctx.ui.setStatus("cinema-loop", `loop ${s.mode}${s.study ? ` · ${s.study}` : ""}${isDirector() ? " · director" : ""}`);
  });

  pi.registerTool({
    name: "cinema_verify",
    label: "Verify study frames",
    description:
      "Capture 5s and 16s frames of an archived study build in an isolated browser and run the vision critic against the hard floor and the three gates. Writes state/verdicts/<sha>.json. A pointer cut is only allowed after a fresh passing verdict for that sha.",
    promptSnippet: "Capture frames of an archive URL and get a critic verdict for a sha",
    promptGuidelines: [
      "Use cinema_verify on the archive URL of a build before any pointer cut; the cut is blocked without a fresh passing verdict.",
      "cinema_verify frames and verdicts are the evidence of record; do not judge your own screenshots.",
    ],
    parameters: Type.Object({
      study: Type.String({ description: "study id, e.g. colour-01" }),
      sha: Type.String({ description: "git sha of the archived build" }),
      url: Type.Optional(Type.String({ description: "override URL; default <archive root>/archive/<study>/<sha>/index.html" })),
    }),
    async execute(_id, params) {
      const url = params.url ?? `${ARCHIVE_ROOT}/archive/${params.study}/${params.sha}/index.html`;
      let frames: string[];
      try {
        frames = captureFrames(url, params.study, params.sha);
      } catch (e) {
        return { content: [{ type: "text", text: `capture failed: ${(e as Error).message}` }], details: { pass: false } };
      }
      const identical = framesIdentical(frames[0], frames[1]);
      const { parsed, raw } = runCritic(frames);
      const g = (k: string) => Boolean(parsed?.[k]);
      const framesDiffer = !identical && g("framesDiffer");
      const titleCard = g("titleCard");
      const operationVisible = String(parsed?.operationVisible ?? "none");
      const floor = {
        space: g("space"),
        apparatus: g("apparatus"),
        motion: g("motion"),
        filmAsMaterial: g("filmAsMaterial"),
        frameFilled: g("frameFilled"),
        colour: g("colour"),
      };
      const floorPass = floor.space && floor.apparatus && floor.motion && floor.filmAsMaterial && floor.frameFilled;
      const pass = Boolean(parsed) && framesDiffer && !titleCard && operationVisible.toLowerCase() !== "none" && floorPass;
      const verdict: Verdict = {
        study: params.study,
        sha: params.sha,
        at: new Date().toISOString(),
        frames,
        framesDiffer,
        titleCard,
        operationVisible,
        floor,
        pass,
        critic: String(parsed?.notes ?? (parsed ? "" : "critic returned no JSON")),
        raw: raw.slice(0, 4000),
      };
      writeFileSync(verdictPath(params.sha), `${JSON.stringify(verdict, null, 2)}\n`);
      if (pass) {
        const s = readLoop();
        s.lastVerifiedSha = params.sha;
        writeLoop(s);
      }
      const summary = [
        `verdict ${pass ? "PASS" : "FAIL"} for ${params.study} ${params.sha}`,
        `frames: ${frames.join(", ")}${identical ? " (byte-identical)" : ""}`,
        `gates: framesDiffer=${framesDiffer} titleCard=${titleCard} operation="${operationVisible}"`,
        `floor: ${Object.entries(floor)
          .map(([k, v]) => `${k}=${v}`)
          .join(" ")}`,
        `critic: ${verdict.critic}`,
        parsed ? "" : `raw: ${raw.slice(0, 600)}`,
      ]
        .filter(Boolean)
        .join("\n");
      return { content: [{ type: "text", text: summary }], details: verdict };
    },
  });

  pi.registerTool({
    name: "cinema_ledger_append",
    label: "Append ledger row",
    description:
      "Append one JSON row to state/ledger.jsonl. The only sanctioned ledger write; the ledger is append-only and corrections are superseding rows that name the row they replace.",
    promptSnippet: "Append a row to the append-only run ledger",
    promptGuidelines: ["Use cinema_ledger_append for every ledger row; never edit or rewrite state/ledger.jsonl."],
    parameters: Type.Object({
      row: Type.Record(Type.String(), Type.Unknown(), { description: "row fields; runId, study, and stage are required, sha expected" }),
    }),
    async execute(_id, params) {
      const row: Record<string, unknown> = { ...params.row, at: new Date().toISOString() };
      for (const k of ["runId", "study", "stage"]) {
        if (!(k in row)) return { content: [{ type: "text", text: `row needs ${k}` }], details: {} };
      }
      appendFileSync(LEDGER, `${JSON.stringify(row)}\n`);
      if (row.stage === "cut" && typeof row.sha === "string") {
        const s = readLoop();
        s.lastCutSha = row.sha;
        writeLoop(s);
      }
      return { content: [{ type: "text", text: `appended ${String(row.runId)} (${String(row.stage)})` }], details: row };
    },
  });

  pi.registerCommand("loop", {
    description: "cinema loop: /loop on <study> | off | status",
    handler: async (args, ctx) => {
      const [verb, study] = (args ?? "").trim().split(/\s+/);
      const s = readLoop();
      if (verb === "on") {
        s.mode = "loop";
        if (study) s.study = study;
        writeLoop(s);
        ctx.ui.notify(`loop on for ${s.study || "(no study set)"}`, "info");
      } else if (verb === "off") {
        s.mode = "paused";
        writeLoop(s);
        ctx.ui.notify("loop paused", "info");
      } else {
        ctx.ui.notify(JSON.stringify(s), "info");
      }
      ctx.ui.setStatus("cinema-loop", `loop ${s.mode}${s.study ? ` · ${s.study}` : ""}`);
    },
  });
}
