// `nish/term-io` under the pseudo-terminal `tests/term-io/relay.mjs` drives,
// which answers the probe as kitty does and each frame's `CSI 5 n` over a
// link it models. It has no `main.ts`, so the link fixtures pass it by; the
// `term-io` section of tests/run.js builds it. The mode is the first argument:
//   throttle   `runTerminal` over a 480×270 framebuffer until `q`; prints the
//              tier of the first and the last frame, the monotonic time
//              `update` first saw `k`, the replies `update` was handed (none
//              should be), the cell width the terminal learned, the highest
//              bandwidth the controller measured and the highest frame cost
//              it was handed
//   panic      `runTerminal` that writes `<panic>` and fails a bounds check
//              in its tenth `render`, so the bytes after the mark are the
//              runtime's restore string
//   watermark  one frame, then `KeyState.watermarked` once its answer is in
//              and again after 1.2 s without frames
//   rss        `openTerminal` and 250 frames of a 480×270 framebuffer, each
//              waited for, with the backend `NISH_TERM_GRAPHICS` forces; then
//              waits for `q`
//   rss-leak   the same keeping 0.27 MB more each frame, the leak the RSS
//              bound must catch
import { ACTION_PRESS, EVENT_KEY, EVENT_REPLY, KEY_CHAR, TermEvent } from "nish/term";
import { monotonicNanos } from "nish:process";
import { Frame, TermInput, Terminal, defaultTerminalOptions, openTerminal, runTerminal } from "nish/term-io";

/** What the throttled and panicking runs keep between steps and frames. */
class Run {
  panics: boolean = false;
  frames: i32 = 0;
  firstTier: i32 = 0;
  lastTier: i32 = 0;
  keyNs: i64 = 0;
  replies: i32 = 0;
  cellWidthPx: i32 = 0;
  peakBytesPerSec: f64 = 0.0;
  peakCostMs: f64 = 0.0;
}

/** Whether `events` holds a press of the character `code`. */
const pressed = (events: TermEvent[], code: i32): boolean => {
  for (const e of events) {
    if (e.type === EVENT_KEY && e.action === ACTION_PRESS && e.key === KEY_CHAR && e.code === code) {
      return true;
    }
  }
  return false;
};

const update = (run: Run, input: TermInput): boolean => {
  for (const e of input.events) {
    if (e.type === EVENT_REPLY) {
      run.replies = run.replies + 1;
    }
  }
  if (run.keyNs === 0 && pressed(input.events, 107)) {
    run.keyNs = monotonicNanos();
  }
  return !pressed(input.events, 113);
};

const render = (run: Run, frame: Frame): void => {
  run.frames = run.frames + 1;
  if (run.panics && run.frames === 10) {
    write("<panic>");
    const xs: i32[] = [1, 2, 3];
    console.log(xs[run.frames]);
  }
  if (run.frames === 1) {
    run.firstTier = frame.stats.tier;
  }
  run.lastTier = frame.stats.tier;
  run.cellWidthPx = frame.caps.cellWidthPx;
  if (frame.stats.bytesPerSec > run.peakBytesPerSec) {
    run.peakBytesPerSec = frame.stats.bytesPerSec;
  }
  if (frame.stats.frameCostMs > run.peakCostMs) {
    run.peakCostMs = frame.stats.frameCostMs;
  }
  // A band that moves every frame, so no frame is empty.
  const fb = frame.framebuffer;
  fb.fill(0x203040);
  const x0 = (run.frames * 7) % 440;
  for (let y = 100; y < 170; y++) {
    for (let x = x0; x < x0 + 40; x++) {
      fb.set(x, y, 0xffcc00);
    }
  }
  frame.screen.text(0, 0, `frame ${run.frames}`, -1, -1, 0);
};

/** Read into `events` until the frames sent are all acknowledged, or stdin ends. */
const settle = (term: Terminal, events: TermEvent[]): boolean => {
  while (term.ackCount > 0) {
    if (!term.readEvents(1000, events)) {
      return false;
    }
  }
  return true;
};

/** Read into `events` until they hold `q`, or stdin ends. */
const waitForQ = (term: Terminal, events: TermEvent[]): void => {
  let open = true;
  while (open && !pressed(events, 113)) {
    open = term.readEvents(1000, events);
  }
};

const runLoop = (panics: boolean): number => {
  const options = defaultTerminalOptions();
  options.framebufferWidth = 480;
  options.framebufferHeight = 270;
  const run = new Run();
  run.panics = panics;
  const ran = runTerminal(options, run, update, render);
  if (ran.isErr()) {
    writeError(`${ran.error}\n`);
    return 1;
  }
  console.log(`tier ${run.firstTier} ${run.lastTier}`);
  console.log(`key ${run.keyNs}`);
  console.log(`replies ${run.replies}`);
  console.log(`cell ${run.cellWidthPx}`);
  console.log(`peak ${Math.round(run.peakBytesPerSec)} B/s cost ${run.peakCostMs} ms`);
  return 0;
};

const watermark = (): number => {
  const opened = openTerminal(defaultTerminalOptions());
  if (opened.isErr()) {
    writeError(`${opened.error}\n`);
    return 1;
  }
  const term = opened.value;
  term.present();
  const events: TermEvent[] = [];
  const answered = settle(term, events);
  const after = term.keys.watermarked;
  const start = monotonicNanos();
  while (monotonicNanos() - start < 1200000000) {
    term.readEvents(100, events);
  }
  const later = term.keys.watermarked;
  term.close();
  console.log(`answered ${answered} watermarked ${after} then ${later}`);
  return 0;
};

const rss = (leaks: boolean): number => {
  const options = defaultTerminalOptions();
  options.framebufferWidth = 480;
  options.framebufferHeight = 270;
  const opened = openTerminal(options);
  if (opened.isErr()) {
    writeError(`${opened.error}\n`);
    return 1;
  }
  const term = opened.value;
  const kept: u8[][] = [];
  const events: TermEvent[] = [];
  const run = new Run();
  let ok = true;
  for (let i = 0; i < 250 && ok; i++) {
    run.frames = i;
    const fb = term.framebuffer;
    fb.fill(0x203040);
    const x0 = (i * 7) % 440;
    for (let y = 100; y < 170; y++) {
      for (let x = x0; x < x0 + 40; x++) {
        fb.set(x, y, 0xffcc00 + i);
      }
    }
    term.present();
    if (leaks) {
      const block: u8[] = new Array<u8>(270000);
      block.fill(1);
      kept.push(block);
    }
    ok = settle(term, events);
  }
  waitForQ(term, events);
  const backend = term.stats().backend;
  term.close();
  console.log(`frames ${run.frames + 1} backend ${backend} kept ${kept.length}`);
  return 0;
};

export const main = (): number => {
  const mode = process.argv.length > 1 ? process.argv[1] : "";
  if (mode === "throttle" || mode === "panic") {
    return runLoop(mode === "panic");
  }
  if (mode === "watermark") {
    return watermark();
  }
  if (mode === "rss" || mode === "rss-leak") {
    return rss(mode === "rss-leak");
  }
  writeError(`unknown mode ${mode}\n`);
  return 2;
};
