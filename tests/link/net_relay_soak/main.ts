// WP34's N9 acceptance (docs/wp34-hosting-cs.md §4): sessions connect, send
// and leave through the relay, and its arena and its resident memory stay
// flat once its pools are full. The relay runs in a process of its own
// (`serve.ts`), started in the background, so that what is measured is the
// relay's alone; this process drives the sessions (`drive.ts`) and reads
// the relay's report.
//
// With no arguments — `npm test` — it runs 500 sessions of warm-up and 2,000
// past it, and asserts the flatness between the two. `soak <n>` is the
// acceptance run itself, 100,000 sessions or any other count, with the same
// assertions; it takes minutes, so it is opt-in:
//
//     build/link/net_relay_soak/app soak 100000
//
// `serve <port file> <report> <total> <every>` is the relay half, which the
// other two start.
import { readFileSyncOrNull } from "nish:fs";
import { pollCreate, pollWait } from "nish:net";
import { spawnSync } from "nish:process";
import { writeError } from "nish:io";
import { Suite } from "nish/testing";
import { n32 } from "../net_quic_frame/typed";
import { echoSocket, wave } from "./drive";
import { serve } from "./serve";

/** Sessions before the flatness is measured: every slot of the pool used, and every array grown to what it needs. */
const SOAK_WARMUP: i32 = 500;
/** Sessions at once. */
const SOAK_WAVE: i32 = 16;

/**
 * The resident set's two checks past warm-up, read at every checkpoint (one
 * each `SOAK_WARMUP` sessions). The arena check, exact to the byte, is what
 * catches a leak of the relay's own allocations, since every Nish allocation
 * is the arena's; the resident set watches what the arena does not hold — the
 * stack, the C runtime, a page the kernel faults in late — and it is grained
 * in 4 KiB pages. So it may grow by at most four pages over the whole run,
 * and in at most one checkpoint interval: a page touched once after warm-up
 * (a fault, not a leak) passes, while growth that recurs fails by its shape
 * whatever its total.
 *
 * What each run can see outside the arena: `npm test`'s 2,000 sessions span
 * four intervals of 500. A steady leak of about 2 bytes a session or more
 * crosses two or more page boundaries in different intervals and fails the
 * shape (at about 8 bytes or more it grows every interval, and past 8 the
 * total too); one under about 2 bytes a session moves the set by a page at
 * most and is invisible there. The 100,000-session run spans 200 intervals
 * and sees 1 byte a session: 100,000 bytes, 24 pages, crossed in 24 of them.
 */
const SOAK_RSS_BOUND: i64 = 16384;

/** The decimal number `text` spells from `at`, or -1. */
const numberAt = (text: string, at: i32): i64 => {
  let v: i64 = 0;
  let digits: i32 = 0;
  for (let k: i32 = at; k < toI32(text.length); k++) {
    const c: i32 = toI32(text.charCodeAt(k));
    if (c < 48 || c > 57) {
      break;
    }
    v = v * 10 + toI64(c - 48);
    digits++;
  }
  return digits > 0 ? v : -1;
};

/** The number after `name ` in `line`, or -1. */
const field = (line: string, name: string): i64 => {
  const at: i32 = toI32(line.indexOf(`${name} `));
  return at < 0 ? -1 : numberAt(line, at + toI32(name.length) + 1);
};

/** The report's checkpoint line for `sessions`, or "". */
const lineAt = (report: string, sessions: i32): string => {
  const at: i32 = toI32(report.indexOf(`at ${sessions} `));
  if (at < 0) {
    return "";
  }
  const rest: string = report.substring(at, toI32(report.length));
  const end: i32 = toI32(rest.indexOf("\n"));
  return end < 0 ? rest : rest.substring(0, end);
};

/** `text` on one line, its newlines written as ` | `, so that a failure's detail is one line of the log. */
const oneLine = (text: string): string => {
  const parts: string[] = [];
  let from: i32 = 0;
  for (let k: i32 = 0; k < toI32(text.length); k++) {
    if (text.charCodeAt(k) === 10) {
      parts.push(text.substring(from, k));
      from = k + 1;
    }
  }
  parts.push(text.substring(from, toI32(text.length)));
  return parts.join(" | ");
};

/**
 * Whether the relay process is still running, and what it wrote to its log:
 * the detail every failure carries, since the relay runs in the background and
 * its exit status reaches nobody.
 */
const relayState = (files: string): string => {
  const alive: boolean = spawnSync(["sh", "-c", `kill -0 $(cat ${files}.pid) 2> /dev/null`]) === 0;
  // Its stderr, where a panic or a failed bind goes; the last 600 bytes of it, which is where the reason is.
  const log: string | null = readFileSyncOrNull(`${files}.log`);
  const tail: string = log === null ? "" : log.length > 600 ? log.substring(toI32(log.length) - 600, toI32(log.length)) : log;
  return `the relay is ${alive ? "still running" : "gone"}; its stderr: ${tail.length === 0 ? "(empty)" : oneLine(tail)}`;
};

/** Sleeps about `ms` milliseconds. */
const nap = (ms: i32): void => {
  const loop: i32 = pollCreate();
  const ready: i32[] = [n32(0), n32(0)];
  pollWait(loop, ready, ms);
};

/** Drives the relay whose files are `files`.*: its port, then `SOAK_WARMUP + total` sessions, then reads its report and checks it. */
const drive = (t: Suite, total: i32, files: string): void => {
  const all: i32 = SOAK_WARMUP + total;
  const portFile: string = `${files}.port`;
  const report: string = `${files}.report`;
  let port: i64 = -1;
  for (let k: i32 = 0; k < 500 && port < 0; k++) {
    const text: string | null = readFileSyncOrNull(portFile);
    port = text !== null ? numberAt(text, n32(0)) : -1;
    if (port < 0) {
      nap(n32(20));
    }
  }
  if (port <= 0) {
    t.fail("the relay starts in a process of its own and says its port", `no port in ${portFile} after 10 s; ${relayState(files)}`);
    return;
  }
  t.pass("the relay starts in a process of its own and says its port");
  const echo: i32[] = echoSocket();
  let finished: i32 = 0;
  for (let first: i32 = 0; first < all; first = first + SOAK_WAVE) {
    const count: i32 = all - first < SOAK_WAVE ? all - first : SOAK_WAVE;
    finished = finished + wave(toI32(port), echo[0], echo[1], first + 1, count);
  }
  let text: string = "";
  for (let k: i32 = 0; k < 500 && toI32(text.indexOf("done ")) < 0; k++) {
    const got: string | null = readFileSyncOrNull(report);
    text = got !== null ? got : "";
    if (toI32(text.indexOf("done ")) < 0) {
      nap(n32(20));
    }
  }
  const sessions: string = `${all} sessions connect, send a DATA the game server echoes, and leave`;
  if (finished === all) {
    t.pass(sessions);
  } else {
    t.fail(sessions, `${finished} of ${all} finished; ${relayState(files)}`);
  }
  const warm: string = lineAt(text, SOAK_WARMUP);
  const last: string = lineAt(text, all);
  if (warm.length === 0 || last.length === 0) {
    t.fail("the relay reported after warm-up and at the end", `its report: ${oneLine(text)}; ${relayState(files)}`);
    return;
  }
  t.pass("the relay reported after warm-up and at the end");
  const resident: i64 = field(last, "rss") - field(warm, "rss");
  // The figures, on stderr: stdout is the checks alone, which `expected.out` pins.
  const figures: string = `after ${SOAK_WARMUP} sessions of warm-up: arena mark ${field(warm, "mark")} used ${field(warm, "used")}, resident ${field(warm, "rss")} bytes; after ${total} more: arena mark ${field(last, "mark")} used ${field(last, "used")}, resident ${field(last, "rss")} bytes (${resident} more, ${resident / toI64(total)} a session)`;
  writeError(`net_relay_soak: ${figures}\n`);
  const flatArena: string = `Arena.used() flat over ${total} sessions past warm-up: the same chunk, the same offset`;
  if (field(last, "mark") === field(warm, "mark") && field(last, "used") === field(warm, "used")) {
    t.pass(flatArena);
  } else {
    t.fail(flatArena, figures);
  }
  // 0 over 100,000 sessions on the machine #515 was measured on; the bound is for a page faulted in once elsewhere.
  const flatResident: string = `resident memory flat over ${total} sessions past warm-up, within ${SOAK_RSS_BOUND} bytes for the whole run`;
  if (field(warm, "rss") > 0 && resident <= SOAK_RSS_BOUND) {
    t.pass(flatResident);
  } else {
    t.fail(flatResident, figures);
  }
  // The shape: in how many checkpoint intervals the resident set grew, and by how much in each.
  let grew: i32 = 0;
  const steps: string[] = [];
  let before: i64 = field(warm, "rss");
  let missing: i32 = 0;
  for (let at: i32 = SOAK_WARMUP + SOAK_WARMUP; at <= all; at = at + SOAK_WARMUP) {
    const line: string = lineAt(text, at);
    const rss: i64 = line.length > 0 ? field(line, "rss") : -1;
    if (rss < 0) {
      missing++;
      continue;
    }
    if (rss > before) {
      grew++;
      steps.push(`${at - SOAK_WARMUP}-${at}: +${rss - before}`);
    }
    before = rss;
  }
  const once: string = `and grew in at most one checkpoint interval of ${SOAK_WARMUP} sessions`;
  if (missing === 0 && grew <= 1) {
    t.pass(once);
  } else {
    t.fail(once, `grew in ${grew} intervals (${steps.length > 0 ? steps.join(", ") : "none"}), ${missing} checkpoints missing; ${figures}`);
  }
};

/** Runs `total` sessions past warm-up through a relay of its own process, and checks it stayed flat. */
const soak = (total: i32): i32 => {
  const t = new Suite("relay soak");
  const all: i32 = SOAK_WARMUP + total;
  // Named by the count, so that an opt-in run and `npm test`'s cannot share them.
  const files: string = `build/net_relay_soak_${all}`;
  spawnSync(["sh", "-c", `rm -f ${files}.port ${files}.report ${files}.pid ${files}.log; '${process.argv[0]}' serve ${files}.port ${files}.report ${all} ${SOAK_WARMUP} > /dev/null 2> ${files}.log & echo $! > ${files}.pid`]);
  drive(t, total, files);
  // Whichever way `drive` ended, the relay goes with it: it has exited by itself after a full run, and is stopped here after any other.
  spawnSync(["sh", "-c", `kill $(cat ${files}.pid) 2> /dev/null; rm -f ${files}.pid`]);
  return t.done();
};

export const main = (): i32 => {
  const argc: i32 = toI32(process.argv.length);
  if (argc === 6 && process.argv[1] === "serve") {
    return serve(process.argv[2], process.argv[3], toI32(field(`n ${process.argv[4]}`, "n")), toI32(field(`n ${process.argv[5]}`, "n")));
  }
  if (argc === 3 && process.argv[1] === "soak") {
    return soak(toI32(field(`n ${process.argv[2]}`, "n")));
  }
  // `npm test`'s run answers 0 whatever it found, and its stdout carries the verdict: both runners compare it
  // with `expected.out`, so a failure still fails, and `tests/nish/run.ts`, which shows a case's stdout only
  // when its exit code matched, then prints the failing check with its detail rather than a bare exit 1.
  soak(n32(2000));
  return 0;
};
