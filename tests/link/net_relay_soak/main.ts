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
/** Resident growth allowed past warm-up: the allocator's own bookkeeping and page rounding, not a per-session cost. */
const SOAK_RSS_TOLERANCE: i64 = 1048576;

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
  if (!t.ok("the relay starts in a process of its own and says its port", port > 0)) {
    return;
  }
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
  t.eqI32(`${all} sessions connect, send a DATA the game server echoes, and leave`, finished, all);
  const warm: string = lineAt(text, SOAK_WARMUP);
  const last: string = lineAt(text, all);
  if (!t.ok("the relay reported after warm-up and at the end", warm.length > 0 && last.length > 0)) {
    writeError(text);
    return;
  }
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
  const flatResident: string = `resident memory flat over ${total} sessions past warm-up, within ${SOAK_RSS_TOLERANCE} bytes`;
  if (resident >= 0 && resident <= SOAK_RSS_TOLERANCE) {
    t.pass(flatResident);
  } else {
    t.fail(flatResident, figures);
  }
};

/** Runs `total` sessions past warm-up through a relay of its own process, and checks it stayed flat. */
const soak = (total: i32): i32 => {
  const t = new Suite("relay soak");
  const all: i32 = SOAK_WARMUP + total;
  // Named by the count, so that an opt-in run and `npm test`'s cannot share them.
  const files: string = `build/net_relay_soak_${all}`;
  spawnSync(["sh", "-c", `rm -f ${files}.port ${files}.report ${files}.pid; '${process.argv[0]}' serve ${files}.port ${files}.report ${all} ${SOAK_WARMUP} > /dev/null 2>&1 & echo $! > ${files}.pid`]);
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
  return soak(n32(2000));
};
