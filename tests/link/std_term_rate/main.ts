// `nish/term-rate`: the refresh controller run against simulated links, one
// millisecond at a time. A `Link` delivers a frame's bytes at its bandwidth,
// one frame after another, and answers each a round trip after its last byte;
// a `Scene` says how big and how costly a frame is at full detail, and shrinks
// it as the decision cuts detail. Each trace logs every change of decision with
// its time, and the log is asserted line by line, so a changed constant shows
// as the first decision that moved. `args` denies every capability: the module
// is pure, and the build is the proof.
import { Screen, FixedStep } from "nish/term";
import {
  BACKEND_CAP_ASCII,
  BACKEND_CAP_HALFBLOCK,
  BACKEND_CAP_KITTY,
  BACKEND_CAP_SIXEL,
  CORNER_BOTTOM_LEFT,
  CORNER_BOTTOM_RIGHT,
  CORNER_TOP_LEFT,
  CORNER_TOP_RIGHT,
  DETAIL_FIRST,
  RATE_FIRST,
  RateController,
  RateDecision,
  RateOptions,
  TermStats,
  drawStatsOverlay,
} from "nish/term-rate";
import { Suite } from "nish/testing";

/** A link to the terminal: a round trip of `rttMs` plus `bytesPerSec` of bandwidth, frames queued behind each other. */
class Link {
  rttMs: f64
  bytesPerSec: f64
  /** When the last queued frame's last byte leaves. */
  busyUntil: f64
  /** When each frame's answer arrives, oldest at `head`. */
  answers: f64[]
  head: i32
  /** Whether the terminal answers at all. */
  answering: boolean

  constructor(rttMs: f64, bytesPerSec: f64) {
    this.rttMs = rttMs
    this.bytesPerSec = bytesPerSec
    this.busyUntil = 0.0
    this.answers = []
    this.head = 0
    this.answering = true
  }

  send(bytes: i32, nowMs: f64): void {
    const start: f64 = nowMs > this.busyUntil ? nowMs : this.busyUntil
    this.busyUntil = start + (toF64(bytes) * 1000.0) / this.bytesPerSec
    if (this.answering) {
      this.answers.push(this.busyUntil + this.rttMs)
    }
  }

  /** Whether an answer has arrived by `nowMs`; takes it if so. */
  answered(nowMs: f64): boolean {
    if (this.head < this.answers.length && this.answers[this.head] <= nowMs) {
      this.head = this.head + 1
      return true
    }
    return false
  }
}

/** A frame at full detail: its bytes and its cost to build, in nanoseconds. */
class Scene {
  bytes: i32
  costNs: f64

  constructor(bytes: i32, costNs: f64) {
    this.bytes = bytes
    this.costNs = costNs
  }

  /** The bytes under `d`: the pixels shrink with the resolution, half blocks to a quarter, 256 colours to half. */
  bytesUnder(d: RateDecision): i32 {
    let b: i32 = (this.bytes / (d.resolutionDivisor * d.resolutionDivisor)) | 0
    if (d.backendCap === BACKEND_CAP_HALFBLOCK) {
      b = (b / 4) | 0
    }
    return d.palette256 ? (b / 2) | 0 : b
  }

  /** The cost under `d`: only the resolution changes the work. */
  costUnder(d: RateDecision): f64 {
    return this.costNs / (toF64(d.resolutionDivisor) * toF64(d.resolutionDivisor))
  }
}

/** What a trace saw: each change of decision, and the worst of the link. */
class Record {
  lines: string[]
  /** Each change's time and the decision it moved to. */
  times: f64[]
  keys: string[]
  /** The decision before the first change. */
  firstKey: string
  /** The longest a frame waited for its answer, in milliseconds. */
  maxWaitMs: f64
  maxUnacked: i32
  frames: i32

  constructor(d: RateDecision) {
    this.lines = []
    this.times = []
    this.keys = []
    this.firstKey = keyOf(d)
    this.maxUnacked = 0
    this.maxWaitMs = 0.0
    this.frames = 0
  }

  lastKey(): string {
    return this.keys.length === 0 ? this.firstKey : this.keys[this.keys.length - 1]
  }
}

const capName = (cap: i32): string => (cap === BACKEND_CAP_KITTY ? "full" : "half")

const keyOf = (d: RateDecision): string =>
  `${d.fps}fps /${d.resolutionDivisor} ${capName(d.backendCap)}${d.palette256 ? " 256" : ""}`

/**
 * Run `c` over `link` drawing `scene` from `fromMs` up to `toMs`: each
 * millisecond take the answers that arrived, tick, and send a frame when one may
 * be drawn. Every change of decision goes into `r`.
 */
const run = (c: RateController, link: Link, scene: Scene, fromMs: i32, toMs: i32, r: Record): void => {
  const sent: f64[] = []
  let t: i32 = fromMs
  while (t < toMs) {
    const now: f64 = toF64(t)
    while (link.answered(now)) {
      c.ackReceived(now)
    }
    c.tick(now)
    const key: string = keyOf(c.decision())
    if (key !== r.lastKey()) {
      r.lines.push(`${t}ms ${key}`)
      r.times.push(now)
      r.keys.push(key)
    }
    if (c.mayDraw(now)) {
      const d: RateDecision = c.decision()
      const bytes: i32 = scene.bytesUnder(d)
      c.frameSent(bytes, scene.costUnder(d), now)
      link.send(bytes, now)
      sent.push(now)
      r.frames = r.frames + 1
    }
    if (c.unacked() > r.maxUnacked) {
      r.maxUnacked = c.unacked()
    }
    t = t + 1
  }
  // The answer times the link scheduled, against the sends, give each frame's wait.
  let i: i32 = 0
  const base: i32 = link.answers.length - sent.length
  while (i < sent.length && base >= 0) {
    const wait: f64 = link.answers[base + i] - sent[i]
    if (wait > r.maxWaitMs) {
      r.maxWaitMs = wait
    }
    i = i + 1
  }
}

/** The least time between two changes in `r`, or a large number with fewer than two. */
const leastGap = (r: Record): f64 => {
  let least: f64 = 1000000.0
  let i: i32 = 1
  while (i < r.times.length) {
    const gap: f64 = r.times[i] - r.times[i - 1]
    if (gap < least) {
      least = gap
    }
    i = i + 1
  }
  return least
}

/** Whether `r` went A to B and back to A in under `windowMs` from the change to B. */
const flipped = (r: Record, windowMs: f64): boolean => {
  let i: i32 = 1
  while (i < r.keys.length) {
    const before: string = i >= 2 ? r.keys[i - 2] : r.firstKey
    if (r.keys[i] === before && r.times[i] - r.times[i - 1] < windowMs) {
      return true
    }
    i = i + 1
  }
  return false
}

/** The index of the first change whose line contains `fragment`, or -1. */
const firstWith = (r: Record, fragment: string): i32 => {
  let i: i32 = 0
  while (i < r.lines.length) {
    if (r.lines[i].indexOf(fragment) >= 0) {
      return i
    }
    i = i + 1
  }
  return -1
}

/** The first change to a rate under `fps`, or -1. */
const firstBelow = (r: Record, fps: i32): i32 => {
  let i: i32 = 0
  while (i < r.lines.length) {
    const n: i32 = toI32(parseInt(r.lines[i].substring(r.lines[i].indexOf(" ") + 1)))
    if (n < fps) {
      return i
    }
    i = i + 1
  }
  return -1
}

const show = (title: string, r: Record): void => {
  console.log(`${title}: start ${r.firstKey}, ${r.frames} frames, ${r.maxUnacked} unacked at most, longest wait ${Math.round(r.maxWaitMs)}ms`)
  for (const line of r.lines) {
    console.log(`  ${line}`)
  }
}

/** Row `y` of `s`'s frame, as text. */
const rowText = (s: Screen, y: i32): string => {
  const cells: string[] = []
  let x: i32 = 0
  while (x < s.width) {
    cells.push(String.fromCharCode(s.glyphAt(x, y)))
    x = x + 1
  }
  return cells.join("")
}

/** The rows of a `width` by `height` screen with `stats` drawn in `corner`. */
const overlay = (width: i32, height: i32, corner: i32, stats: TermStats): string[] => {
  const s = new Screen(width, height, false)
  drawStatsOverlay(s, stats, corner)
  const rows: string[] = []
  let y: i32 = 0
  while (y < s.height) {
    rows.push(rowText(s, y))
    y = y + 1
  }
  return rows
}

/**
 * The steps a 60-step logic clock runs over a second of drawing at a fixed
 * `fps`, advanced only when a frame is drawn: the drawn rate changes how many
 * steps each frame runs, not how many run.
 */
const logicSteps = (fps: i32): i32 => {
  const opts = new RateOptions()
  opts.fixedFps = fps
  const c = new RateController(opts)
  const logic = new FixedStep(60, 60)
  const start: f64 = 0.0
  const costNs: f64 = 1000.0
  logic.advance(start)
  let steps: i32 = 0
  let t: i32 = 0
  while (t <= 1000) {
    const now: f64 = toF64(t)
    if (c.mayDraw(now)) {
      steps = steps + logic.advance(now)
      c.frameSent(100, costNs, now)
      c.ackReceived(now)
    }
    t = t + 1
  }
  return steps
}

/** A controller with `opts`, run over a fresh link for `ms` milliseconds. */
const trace = (opts: RateOptions, link: Link, scene: Scene, ms: i32): Record => {
  const c = new RateController(opts)
  const r = new Record(c.decision())
  run(c, link, scene, 0, ms, r)
  return r
}

export const main = (): i32 => {
  const t = new Suite("term-rate")

  // Trace 1: a fast local terminal, a millisecond away with 50 MB/s, frames of
  // 20 kB costing 2 ms. It starts at 30, rises to 60 three seconds after the
  // first answer shows 60 within budget, and holds for the rest of 30 seconds.
  const local = trace(new RateOptions(), new Link(1.0, 50000000.0), new Scene(20000, 2000000.0), 30000)
  show("local", local)
  t.eqLines("local: the decisions", local.lines, ["3002ms 60fps /1 full"])
  t.eqI32("local: one frame in flight at most", local.maxUnacked, 1)

  // The same terminal with 120 allowed climbs one tier further, three seconds
  // and a settle later; allowed without a `maxFps` of 120 it stays at 60.
  const fastOpts = new RateOptions()
  fastOpts.allow120 = true
  fastOpts.maxFps = 120
  const fast = trace(fastOpts, new Link(1.0, 50000000.0), new Scene(20000, 2000000.0), 10000)
  t.eqLines("allow120: the decisions", fast.lines, ["3002ms 60fps /1 full", "6003ms 120fps /1 full"])
  const capped = new RateOptions()
  capped.allow120 = true
  show("allow120", fast)
  const held = trace(capped, new Link(1.0, 50000000.0), new Scene(20000, 2000000.0), 10000)
  t.eqLines("allow120 under maxFps 60: the decisions", held.lines, ["3002ms 60fps /1 full"])

  // Trace 2: a 100 ms link at 1 Mbit/s (125 kB/s) with 2 kB frames. Ten frames a
  // second one at a time would need the whole round trip, so even the floor of
  // 10 is over budget; smaller frames would not shorten a round trip that is
  // all latency, so the controller keeps full detail and drops below the floor.
  const sshOpts = new RateOptions()
  sshOpts.remoteHint = true
  sshOpts.probeRttMs = 100.0
  const ssh = trace(sshOpts, new Link(100.0, 125000.0), new Scene(2000, 1000000.0), 30000)
  show("ssh", ssh)
  t.eqStr("ssh: starts at 15, remote", ssh.firstKey, "15fps /1 full")
  t.eqLines("ssh: the decisions", ssh.lines, ["1000ms 10fps /1 full", "2000ms 5fps /1 full"])
  t.eqI32("ssh: one frame in flight at most", ssh.maxUnacked, 1)
  t.ok("ssh: every answer within 150 ms", ssh.maxWaitMs < 150.0)

  // Trace 3: a link that degrades and recovers. Five seconds local, then ten at
  // a 60 ms round trip, then local again. The rate falls within a second and
  // a half, a step and then a settle later the rest of the way, and climbs
  // back a tier at a time, three seconds apiece.
  const swing = new RateController(new RateOptions())
  const swingLink = new Link(1.0, 50000000.0)
  const swingScene = new Scene(20000, 2000000.0)
  const sw = new Record(swing.decision())
  run(swing, swingLink, swingScene, 0, 5000, sw)
  swingLink.rttMs = 60.0
  run(swing, swingLink, swingScene, 5000, 15000, sw)
  swingLink.rttMs = 1.0
  run(swing, swingLink, swingScene, 15000, 40000, sw)
  show("swing", sw)
  t.eqLines("swing: the decisions", sw.lines, [
    "3002ms 60fps /1 full",
    "5579ms 15fps /1 full",
    "6579ms 10fps /1 full",
    "18369ms 15fps /1 full",
    "21370ms 20fps /1 full",
    "24371ms 30fps /1 full",
    "27372ms 60fps /1 full",
  ])
  t.ok("swing: at most one change a second", leastGap(sw) >= 1000.0)
  t.eqBool("swing: no change undone within three seconds", flipped(sw, 3000.0), false)

  // Trace 4: a starved link, 10 ms away at 256 kbit/s (32 kB/s), with 40 kB
  // frames. Even 10 frames a second needs ten times the link, so the
  // resolution halves, then quarters, then the backend is capped, all before
  // any rate below the floor.
  const starvedOpts = new RateOptions()
  starvedOpts.maxUnacked = 2
  const starved = trace(starvedOpts, new Link(10.0, 32000.0), new Scene(40000, 4000000.0), 20000)
  show("starved", starved)
  t.eqLines("starved: the decisions", starved.lines, [
    "1760ms 10fps /1 full",
    "2760ms 10fps /2 full",
    "3760ms 10fps /4 full",
    "4760ms 10fps /4 half",
  ])
  const halved: i32 = firstWith(starved, "/2")
  const capIndex: i32 = firstWith(starved, "half")
  const slower: i32 = firstBelow(starved, 10)
  t.ok("starved: resolution halves before the backend is capped", halved >= 0 && halved < capIndex)
  t.ok("starved: the backend is capped before a rate below the floor", slower < 0 || capIndex < slower)
  t.ok("starved: two frames in flight at most", starved.maxUnacked <= 2)

  // The same link preferring detail: every tier down to 5 first, then detail.
  const detailOpts = new RateOptions()
  detailOpts.maxUnacked = 2
  detailOpts.prefer = DETAIL_FIRST
  const detail = trace(detailOpts, new Link(10.0, 32000.0), new Scene(40000, 4000000.0), 20000)
  show("detail", detail)
  t.eqLines("detail: the decisions", detail.lines, [
    "1760ms 5fps /1 full",
    "2760ms 5fps /2 full",
    "3760ms 5fps /4 full",
    "4760ms 5fps /4 half",
  ])

  const none: string[] = []
  // Trace 5: the unacknowledged limit, at a fixed 60 frames a second over a 50
  // ms link. One in flight draws a frame per answer; two draw twice as many.
  const one = new RateOptions()
  one.fixedFps = 60
  const limit1 = trace(one, new Link(50.0, 50000000.0), new Scene(1000, 1000000.0), 10000)
  const two = new RateOptions()
  two.fixedFps = 60
  two.maxUnacked = 2
  const limit2 = trace(two, new Link(50.0, 50000000.0), new Scene(1000, 1000000.0), 10000)
  show("limit 1", limit1)
  show("limit 2", limit2)
  t.eqI32("limit 1: one in flight at most", limit1.maxUnacked, 1)
  t.eqI32("limit 2: two in flight at most", limit2.maxUnacked, 2)
  t.eqLines("limit 1: a fixed rate never changes", limit1.lines, none)
  // A frame waits 50 ms for its answer and the next due step after it: 151 and 301 in ten seconds.
  t.eqI32("limit 1: frames", limit1.frames, 151)
  t.eqI32("limit 2: frames", limit2.frames, 301)
  t.eqLines("limit 2: a fixed rate never changes", limit2.lines, none)

  // The starved link widens to local: the detail comes back a level at a time, then the rate.
  const widen = new RateController(starvedOpts)
  const widenLink = new Link(10.0, 32000.0)
  const widenScene = new Scene(40000, 4000000.0)
  const wr = new Record(widen.decision())
  run(widen, widenLink, widenScene, 0, 10000, wr)
  widenLink.rttMs = 1.0
  widenLink.bytesPerSec = 50000000.0
  run(widen, widenLink, widenScene, 10000, 40000, wr)
  show("widen", wr)
  t.eqLines("widen: the decisions", wr.lines, [
    "1760ms 10fps /1 full",
    "2760ms 10fps /2 full",
    "3760ms 10fps /4 full",
    "4760ms 10fps /4 half",
    "13036ms 10fps /4 full",
    "16037ms 10fps /2 full",
    "19038ms 10fps /1 full",
    "22039ms 15fps /1 full",
    "25040ms 20fps /1 full",
    "28041ms 30fps /1 full",
    "31042ms 60fps /1 full",
  ])
  // An answer lands on the millisecond after the 1.8 ms its frame takes, so the round trip reads 2. With one frame of
  // one size in flight the latency and the bytes cannot be told apart, so the split is anyone's; their sum is right.
  const st: TermStats = widen.stats()
  t.eqI32("widen: stats tier", st.tier, widen.decision().fps)
  t.eqI32("widen: stats backend", st.backend, BACKEND_CAP_KITTY)
  t.ok("widen: stats round trip near 2 ms", st.rttMs > 1.9 && st.rttMs < 2.1)
  t.ok("widen: stats bandwidth between 20 and 50 MB/s", st.bytesPerSec > 19000000.0 && st.bytesPerSec < 51000000.0)
  t.ok("widen: stats frame cost 4 ms", st.frameCostMs > 3.99 && st.frameCostMs < 4.01)
  // The frame still in the starved backlog when the round trip shrank waits past its new timeout.
  t.eqI32("widen: stats lost", st.lost, 1)
  t.ok("widen: stats dropped some while starved", st.dropped > 0)

  // A probe under 5 ms contradicts the remote hint: it starts at 30, not 15.
  const nearOpts = new RateOptions()
  nearOpts.remoteHint = true
  nearOpts.probeRttMs = 2.0
  t.eqStr("probe: a local probe overrides the hint", keyOf(new RateController(nearOpts).decision()), "30fps /1 full")

  // NISH_FPS, read by the caller into `envFps`, beats the program's fixed rate.
  const envOpts = new RateOptions()
  envOpts.fixedFps = 60
  envOpts.envFps = 20
  const envRun = trace(envOpts, new Link(1.0, 50000000.0), new Scene(20000, 2000000.0), 5000)
  t.eqStr("envFps: beats fixedFps", envRun.firstKey, "20fps /1 full")
  t.eqLines("envFps: never changes", envRun.lines, none)

  // An answer with nothing in flight is ignored: no round trip, no decision.
  const stray = new RateController(new RateOptions())
  const strayMs: f64 = 5.0
  const laterMs: f64 = 5000.0
  const noRtt: f64 = 0.0
  stray.ackReceived(strayMs)
  stray.tick(laterMs)
  t.eqF64("stray: no round trip", stray.stats().rttMs, noRtt)
  t.eqI32("stray: nothing in flight", stray.unacked(), 0)
  t.eqStr("stray: no decision moved", keyOf(stray.decision()), "30fps /1 full")

  // A terminal that never answers: each frame is given up after the timeout and counted lost, so drawing goes on.
  const muteLink = new Link(1.0, 50000000.0)
  muteLink.answering = false
  const mute = new RateController(new RateOptions())
  const mr = new Record(mute.decision())
  run(mute, muteLink, new Scene(20000, 2000000.0), 0, 7000, mr)
  // A frame at 0, 2001, 4002 and 6003 ms: each waits out the two-second timeout.
  t.eqI32("mute: frames given up", mute.stats().lost, 3)
  t.eqI32("mute: frames drawn", mr.frames, 4)
  t.eqLines("mute: no decision without an answer", mr.lines, none)

  // A 25 ms link at a fixed 60 fps with two frames allowed in flight: every
  // frame is sent before the one ahead of it is answered, so the queue never
  // empties, and its answered prefix must still be dropped rather than kept.
  const behindOpts = new RateOptions()
  behindOpts.maxUnacked = 2
  behindOpts.fixedFps = 60
  const behind = new RateController(behindOpts)
  const br = new Record(behind.decision())
  run(behind, new Link(25.0, 50000000.0), new Scene(20000, 2000000.0), 0, 30000, br)
  t.eqI32("behind: two frames in flight", br.maxUnacked, 2)
  t.eqI32("behind: none dropped", behind.stats().dropped, 0)
  t.ok("behind: the queue stays short", behind.sentMs.length <= 4)

  // The logic clock is the program's, not the controller's: drawing at 60 or at 10, a 60-step logic clock runs 60 steps a
  // second, give or take the step the last frame straddles.
  const at60: i32 = logicSteps(60)
  const at10: i32 = logicSteps(10)
  t.ok("fixed step: logic steps at 60 fps drawing", at60 >= 59 && at60 <= 60)
  t.ok("fixed step: logic steps at 10 fps drawing", at10 >= 59 && at10 <= 60)

  // The overlay in each corner of a 40 by 6 screen.
  const stats = new TermStats()
  stats.tier = 30
  stats.rttMs = 12.4
  stats.bytesPerSec = 125000.0
  stats.frameCostMs = 2.6
  stats.dropped = 3
  stats.backend = BACKEND_CAP_HALFBLOCK
  t.eqLines("overlay: top left", overlay(40, 6, CORNER_TOP_LEFT, stats), [
    "30fps 12ms 125kB/s                      ",
    "3ms drop 3 half                         ",
    "                                        ",
    "                                        ",
    "                                        ",
    "                                        ",
  ])
  t.eqLines("overlay: top right", overlay(40, 6, CORNER_TOP_RIGHT, stats), [
    "                      30fps 12ms 125kB/s",
    "                      3ms drop 3 half   ",
    "                                        ",
    "                                        ",
    "                                        ",
    "                                        ",
  ])
  t.eqLines("overlay: bottom left", overlay(40, 6, CORNER_BOTTOM_LEFT, stats), [
    "                                        ",
    "                                        ",
    "                                        ",
    "                                        ",
    "30fps 12ms 125kB/s                      ",
    "3ms drop 3 half                         ",
  ])
  t.eqLines("overlay: bottom right", overlay(40, 6, CORNER_BOTTOM_RIGHT, stats), [
    "                                        ",
    "                                        ",
    "                                        ",
    "                                        ",
    "                      30fps 12ms 125kB/s",
    "                      3ms drop 3 half   ",
  ])

  // A screen narrower and shorter than the overlay clips it from the top left, whatever the corner.
  t.eqLines("overlay: clipped", overlay(10, 1, CORNER_BOTTOM_RIGHT, stats), ["30fps 12ms"])
  // Each backend cap by its short name.
  stats.backend = BACKEND_CAP_KITTY
  t.eqStr("overlay: full", overlay(20, 2, CORNER_TOP_LEFT, stats)[1], "3ms drop 3 full     ")
  stats.backend = BACKEND_CAP_SIXEL
  t.eqStr("overlay: sixel", overlay(20, 2, CORNER_TOP_LEFT, stats)[1], "3ms drop 3 sixel    ")
  stats.backend = BACKEND_CAP_ASCII
  t.eqStr("overlay: ascii", overlay(20, 2, CORNER_TOP_LEFT, stats)[1], "3ms drop 3 ascii    ")

  // The options are clamped: a fixed rate to 240, the unacknowledged limit to 2, an unknown preference to rate first,
  // and the floor up to the next tier.
  const wild = new RateOptions()
  wild.fixedFps = 500
  wild.maxUnacked = 5
  wild.prefer = 7
  wild.minFps = 12
  const tame = new RateController(wild)
  t.eqI32("options: fixed rate clamped", tame.decision().fps, 240)
  t.eqI32("options: unacknowledged limit clamped", tame.maxUnacked, 2)
  t.eqI32("options: unknown preference", tame.prefer, RATE_FIRST)
  t.eqI32("options: floor rounds up to a tier", tame.floorFps, 15)

  return t.done()
}
