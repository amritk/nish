// What a frame of `nish/term-io` costs: `present` per backend, and the rate
// controller's bookkeeping around it. bench/term-io.mjs runs it, under the
// fake terminal tests/term-io/relay.mjs plays (200×60 cells of 10×20 px) for
// `present`, and prints the table. The mode is the first argument:
//   present      `openTerminal` with a 480×270 framebuffer and FRAMES frames,
//                each a band that moves, each waited for; prints the median
//                and the 90th percentile of `present` in nanoseconds, the
//                backend `NISH_TERM_GRAPHICS` forced and the pixel bytes of
//                the last frame (0 for the cell backends)
//   controller   no terminal: CONTROLLER_FRAMES rounds of what `runTerminal`
//                asks of the controller a frame (`tick`, `mayDraw`,
//                `decision`, `frameSent`, `ackReceived`, `stats`); prints the
//                nanoseconds a round
import { TermEvent } from "nish/term"
import { Terminal, defaultTerminalOptions, openTerminal } from "nish/term-io"
import { RateController, RateOptions } from "nish/term-rate"
import { monotonicNanos } from "nish:process"

const FRAMES: i32 = 200 // bench:n
const CONTROLLER_FRAMES: i32 = 200000 // bench:n

/** The `q`th quantile of `xs`: the least value at least that share of them are at or under. */
const quantile = (xs: f64[], q: f64): f64 => {
  const want: f64 = Math.ceil(q * toF64(xs.length))
  let best: f64 = -1.0
  for (const x of xs) {
    let under: i32 = 0
    for (const y of xs) {
      if (y <= x) {
        under++
      }
    }
    if (toF64(under) >= want && (best < 0.0 || x < best)) {
      best = x
    }
  }
  return best
}

/** Read until every frame sent is acknowledged; false if stdin ends. */
const settle = (term: Terminal, events: TermEvent[]): boolean => {
  while (term.ackCount > 0) {
    if (!term.readEvents(1000, events)) {
      return false
    }
  }
  return true
}

const present = (): i32 => {
  const options = defaultTerminalOptions()
  options.framebufferWidth = 480
  options.framebufferHeight = 270
  const opened = openTerminal(options)
  if (opened.isErr()) {
    writeError(`${opened.error}\n`)
    return 1
  }
  const term = opened.value
  const events: TermEvent[] = []
  const times: f64[] = []
  let ok = true
  for (let i: i32 = 0; i < FRAMES && ok; i++) {
    const fb = term.framebuffer
    fb.fill(0x203040)
    const x0: i32 = (i * 7) % 440
    for (let y: i32 = 100; y < 170; y++) {
      for (let x: i32 = x0; x < x0 + 40; x++) {
        fb.set(x, y, 0xffcc00 + i)
      }
    }
    const start = monotonicNanos()
    term.present()
    times.push(toF64(monotonicNanos() - start))
    ok = settle(term, events)
  }
  const s = term.stats()
  const bytes = term.pixels.length
  term.close()
  console.log(`present ${quantile(times, 0.5)} ${quantile(times, 0.9)} backend ${s.backend} bytes ${bytes}`)
  return 0
}

const controller = (): i32 => {
  const rate = new RateController(new RateOptions())
  let nowMs: f64 = 0.0
  let drawn: i32 = 0
  const start = monotonicNanos()
  for (let i: i32 = 0; i < CONTROLLER_FRAMES; i++) {
    nowMs = nowMs + 16.0
    rate.tick(nowMs)
    if (rate.mayDraw(nowMs)) {
      drawn = drawn + rate.decision().resolutionDivisor
      rate.frameSent(40000, toF64(2000000), nowMs)
      rate.ackReceived(nowMs + 1.0)
    }
    drawn = drawn + rate.stats().tier
  }
  const ns = toF64(monotonicNanos() - start) / toF64(CONTROLLER_FRAMES)
  console.log(`controller ${ns} check ${drawn}`)
  return 0
}

export const main = (): i32 => {
  const mode = process.argv.length > 1 ? process.argv[1] : ""
  if (mode === "present") {
    return present()
  }
  if (mode === "controller") {
    return controller()
  }
  writeError(`unknown mode ${mode}\n`)
  return 2
}
