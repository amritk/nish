/**
 * `std/term-rate` — how fast the link to the terminal is, measured from frames
 * sent and acknowledged, and the frame rate and drawing detail a program keeps
 * to under it.
 *
 * The module is pure: no capability, no I/O and no clock. The caller feeds a
 * `RateController` what happened — a frame of so many bytes, costing so many
 * nanoseconds to build, sent at a time; an acknowledgement arriving at a time —
 * and asks it whether a frame may be drawn now and in what shape
 * (`RateDecision`). Every time is an `f64` count of milliseconds on the
 * caller's clock, as `FixedStep`'s is in `nish/term`.
 *
 * **The acknowledgement.** A frame is acknowledged when the terminal answers a
 * status query sent right after it: the terminal answers in order, so the
 * answer means every byte before it has been read and drawn. The query to send
 * is DSR 5, `CSI 5 n`, answered `CSI 0 n`. It is preferred over the cursor
 * position report (DSR 6, `CSI 6 n`, answered `CSI row ; col R`) because its
 * answer is one fixed string, and because a cursor report is the same bytes as
 * F3 with modifiers in the legacy key encoding (`CSI 1 ; mods R`), which a key
 * decoder would have to guess between. Two relays answer the query from their
 * own emulator, not from the terminal at the end of the link:
 *
 * - tmux (commit 939e8e65) answers in `input.c` lines 1737–1747, the
 *   `INPUT_CSI_DSR` case, which replies `\033[0n` to 5 and the position to 6
 *   through `input_reply`, whose `input_send_reply` (lines 1177–1186) writes to
 *   the pane. Inside tmux the round trip measures tmux, not the outer
 *   terminal, and a frame tmux has taken is not yet on the screen.
 * - mosh (commit decd9b70) answers in `src/terminal/terminalfunctions.cc`
 *   lines 471–488, `CSI_DSR`, which appends the reply to `terminal_to_host`;
 *   `src/frontend/mosh-server.cc` feeds the program's output to that emulator
 *   at line 874 and writes `terminal_to_host` back to the program at line 882.
 *   The answer comes from mosh-server on the remote host and never crosses the
 *   network, so mosh reads as a fast local link; its own frame rate limit
 *   (mosh sends at most about 50 frames a second) then does the pacing.
 *
 * Under either relay the controller still bounds the program to what the relay
 * absorbs, which is the most it can know.
 *
 * **What is measured.** Four running averages (exponentially weighted, so
 * recent frames count most and none is stored): the round trip from a frame's
 * send to its acknowledgement (weight 1/8, as TCP smooths its round trip, so
 * one late answer moves it little); the bytes a second the link delivered, each
 * acknowledged frame's bytes over the time the link spent on it (weight 1/4);
 * the cost to build a frame and the bytes in one (weight 1/4 each, so a change
 * of scene shows within a few frames). The link's time on a frame starts at the
 * previous acknowledgement when the frame was sent before it (the link was busy
 * until then), and otherwise at the send plus the base latency, which an idle
 * link spends on every frame and which says nothing about bandwidth. The base
 * latency is the least, over answers to frames sent onto an idle link, of the
 * round trip less the frame's bytes at the measured bandwidth; it creeps up
 * 1/256 of the gap per answer so a changed route shows in time. Before the
 * bandwidth is known it is the probe's round trip (`probeRttMs`: the status
 * query alone is a few bytes, so its round trip is the latency) or else the
 * first answer's, whose bytes' time comes off once a later answer measures the
 * bandwidth. With frames of one size sent one at a time onto an idle link the
 * latency and the bytes cannot be told apart; the split is then a guess, but
 * their sum, the frame's round trip, is measured, and that is what the trip
 * load uses.
 * Acknowledgements match sent frames oldest first. A frame due while the
 * unacknowledged limit is reached is dropped and counted; one not answered
 * within `rateAckTimeoutMs` plus four round trips is given up and counted as
 * lost, so a lost answer
 * stalls drawing for seconds, not for ever.
 *
 * **What is decided.** The frame rate is a tier: 120 (only with `allow120` and
 * a `maxFps` of 120), 60, 30, 20, 15, 10 or 5. A tier fits when three loads
 * are all at most 1: the frame cost over 70% of the frame time, the bytes a
 * second the tier needs over 70% of the bytes a second the link delivers, and
 * the tier's frames times the round trip over 70% of the time the
 * unacknowledged limit allows (a link that answers in 100 ms carries at most
 * ten frames a second one at a time). The 30% left over absorbs a slow frame
 * without a dropped one. The rate falls to the best fitting tier after half a
 * second continuously over, and rises one tier after three seconds
 * continuously under the next tier's loads with a fifth to spare; after any
 * change it holds for a second, so the averages see the new rate before the
 * next decision. Falling fast and rising slowly keeps a flickering link from
 * flipping the rate.
 *
 * Below the floor tier (the least tier at or above `minFps`, under
 * `RATE_FIRST`) the controller cuts bytes instead of frames, one step at a
 * time: half the resolution, a quarter, the backend capped at half blocks, 256
 * colours. A step is taken only when it would cut the load by a fifth: a link
 * whose round trip is all latency is not helped by smaller frames, so it gets a
 * lower tier at full detail instead. Past the last step, tiers below `minFps`
 * remain. `DETAIL_FIRST` swaps the order: every tier down to 5 first, then the
 * steps. Recovery runs the same path backwards with the rising rule, predicting
 * a step's bytes and cost from the factors in `rateLevelFactor`.
 *
 * A fixed rate — `fixedFps` from the program or `envFps`, the user's
 * `NISH_TERM_FPS`, which wins — turns the choosing off: the rate is that one,
 * at full detail, and only the unacknowledged limit still applies.
 */
import { ATTR_INVERSE, COLOR_DEFAULT, FixedStep, Screen } from "nish/term"

/** `RateOptions.prefer`: keep the frame rate at `minFps` and cut detail first. */
export const RATE_FIRST: i32 = 0

/** `RateOptions.prefer`: keep full detail and drop the frame rate toward 5 first. */
export const DETAIL_FIRST: i32 = 1

/**
 * `RateDecision.backendCap` and `TermStats.backend`: the richest drawing
 * backend allowed. The values order the backends, richer higher, so a caller
 * takes the lesser of this and what the terminal supports.
 */
export const BACKEND_CAP_ASCII: i32 = 0

/** A backend cap of Unicode half blocks, two pixels to a cell. */
export const BACKEND_CAP_HALFBLOCK: i32 = 1

/** A backend cap of sixel graphics. */
export const BACKEND_CAP_SIXEL: i32 = 2

/** A backend cap of the kitty graphics protocol, the richest: no cap at all. */
export const BACKEND_CAP_KITTY: i32 = 3

/** `drawStatsOverlay`'s corner: the top left. */
export const CORNER_TOP_LEFT: i32 = 0

/** The top right corner. */
export const CORNER_TOP_RIGHT: i32 = 1

/** The bottom left corner. */
export const CORNER_BOTTOM_LEFT: i32 = 2

/** The bottom right corner. */
export const CORNER_BOTTOM_RIGHT: i32 = 3

/** The share of a frame's time, or of the link, that a tier may use. */
const rateBudget: f64 = 0.7

/** The load a candidate must stay under to rise to it: a fifth to spare. */
const rateRiseMargin: f64 = 0.8

/** How much a detail step must cut the load to be taken. */
const rateStepGain: f64 = 0.8

/** How long over budget before the rate falls, in milliseconds. */
const rateDropAfterMs: f64 = 500.0

/** How long under the next tier's budget before the rate rises, in milliseconds. */
const rateRiseAfterMs: f64 = 3000.0

/** How long nothing changes after a change, in milliseconds. */
const rateSettleMs: f64 = 1000.0

/** A probe round trip under this many milliseconds is a local terminal, whatever the environment says. */
const rateLocalRttMs: f64 = 5.0

/** The deepest detail step: 256 colours on top of the others. */
const rateMaxLevel: i32 = 4

/** The least time the link is taken to spend on a frame, so one fast answer cannot read as unbounded bandwidth. */
const rateMinBusyMs: f64 = 0.5

/** How long, past four round trips, an unanswered frame is waited for, in milliseconds. */
const rateAckTimeoutMs: f64 = 2000.0

/**
 * How much a frame shrinks, in bytes and in cost, going from detail step
 * `level - 1` to `level`. Half the resolution is a quarter of the pixels; half
 * blocks against sixel or kitty images are taken as a quarter, and 256 colours
 * as half, of the escapes. They are estimates, only for predicting a step not
 * yet taken: once there, the frames are measured.
 */
const rateLevelFactor = (level: i32): f64 => (level === rateMaxLevel ? 2.0 : 4.0)

/** How much smaller a frame at detail step `to` is than at step `from`, as a multiplier. */
const rateLevelScale = (from: i32, to: i32): f64 => {
  let scale: f64 = 1.0
  let level: i32 = from
  while (level < to) {
    level = level + 1
    scale = scale / rateLevelFactor(level)
  }
  while (level > to) {
    scale = scale * rateLevelFactor(level)
    level = level - 1
  }
  return scale
}

/** `average` moved toward `sample` by `weight`, or `sample` itself for the first one. */
const rateSmooth = (average: f64, sample: f64, weight: f64, first: boolean): f64 =>
  first ? sample : average + (sample - average) * weight

/** What a program asks of the controller. Every field has a default, so a program sets only what it means. */
export class RateOptions {
  /** The round trip of a probe query sent at startup, in milliseconds; 0 when none was measured. */
  probeRttMs: f64 = 0.0
  /** The least frame rate worth keeping before detail is cut, under `RATE_FIRST`. */
  minFps: i32 = 10
  /** The most frames a second; 120 is reached only with `allow120` as well. */
  maxFps: i32 = 60
  /** A frame rate the program fixes, turning the choosing off; 0 leaves it on. */
  fixedFps: i32 = 0
  /** `RATE_FIRST` or `DETAIL_FIRST`: what gives way first when even `minFps` does not fit. */
  prefer: i32 = 0
  /** How many frames may be awaiting their acknowledgement at once: 1 or 2. */
  maxUnacked: i32 = 1
  /** The user's `NISH_TERM_FPS`, which fixes the rate over everything else; 0 when unset. */
  envFps: i32 = 0
  /** Whether the 120 tier may be used, for a terminal known to keep up with it. */
  allow120: boolean = false
  /** Whether the environment says the terminal is remote (an `SSH_*` variable, say). */
  remoteHint: boolean = false

  /** The defaults; set the fields to change them. */
  constructor() {
    this.minFps = 10
    this.maxFps = 60
    this.fixedFps = 0
    this.allow120 = false
    this.prefer = RATE_FIRST
    this.maxUnacked = 1
    this.remoteHint = false
    this.probeRttMs = 0.0
    this.envFps = 0
  }
}

/** How to draw the next frame: its rate and how much detail. */
export class RateDecision {
  /** Frames a second. */
  fps: i32 = 30
  /** Draw at the screen's resolution divided by this: 1, 2 or 4. */
  resolutionDivisor: i32 = 1
  /** The richest backend to draw with, a `BACKEND_CAP_*`. */
  backendCap: i32 = 3
  /** Whether to keep to the 256-colour palette. */
  palette256: boolean = false

  /** Full detail at 30 frames a second, until the controller says otherwise. */
  constructor() {
    this.fps = 30
    this.resolutionDivisor = 1
    this.backendCap = BACKEND_CAP_KITTY
    this.palette256 = false
  }
}

/** What the controller has measured, for a program to show or log. */
export class TermStats {
  /** The frame rate in force. */
  tier: i32 = 30
  /** The backend cap in force, a `BACKEND_CAP_*`. */
  backend: i32 = 3
  /** The smoothed round trip from a frame's send to its acknowledgement, in milliseconds. */
  rttMs: f64 = 0.0
  /** The smoothed bytes a second the link delivers. */
  bytesPerSec: f64 = 0.0
  /** The smoothed cost to build a frame, in milliseconds. */
  frameCostMs: f64 = 0.0
  /** Due frames skipped because the unacknowledged limit was reached. */
  dropped: i32 = 0
  /** Frames sent and not yet acknowledged. */
  unacked: i32 = 0
  /** Frames given up on after waiting `rateAckTimeoutMs` past four round trips. */
  lost: i32 = 0

  /** Nothing measured yet. */
  constructor() {
    this.tier = 30
    this.backend = BACKEND_CAP_KITTY
    this.rttMs = 0.0
    this.bytesPerSec = 0.0
    this.frameCostMs = 0.0
    this.dropped = 0
    this.unacked = 0
    this.lost = 0
  }
}

/**
 * The refresh controller. Each turn of a program's loop: feed it the
 * acknowledgements that arrived (`ackReceived`), let it re-decide (`tick`),
 * and draw only when `mayDraw` says so, reporting the frame with `frameSent`.
 * `decision` says how to draw it. `decision` and `stats` answer the same object
 * each call, updated in place, so a loop allocates nothing.
 */
export class RateController {
  /** The tiers allowed, fastest first, ending at 5. */
  tiers: i32[]
  /** Paces frames at `tier`. */
  pacer: FixedStep
  /** When the tier or step last changed. */
  changedMs: f64
  /** When the loads went over budget and stayed, or -1. */
  overSinceMs: f64
  /** When the next step up came within its margin and stayed, or -1. */
  underSinceMs: f64
  /** The send times of the unacknowledged frames, oldest at `head`. */
  sentMs: f64[]
  /** Their byte counts. */
  sentBytes: i32[]
  /** When the last acknowledgement arrived, or -1. */
  lastAckMs: f64
  /** The smoothed round trip, in milliseconds. */
  rttMs: f64
  /** The link's latency without bytes: the least round trip less the link's time on its bytes, creeping up. */
  baseRttMs: f64
  /** The bytes of the first answered frame while `haveRate` waits, to take its latency once the bandwidth is known. */
  heldBytes: f64
  /** The smoothed bytes a second delivered. */
  bytesPerSec: f64
  /** The smoothed frame cost, in milliseconds. */
  costMs: f64
  /** The smoothed bytes per frame. */
  frameBytes: f64
  current: RateDecision
  measured: TermStats
  /** The least tier detail is cut to keep: the floor tier under `RATE_FIRST`, 5 under `DETAIL_FIRST`. */
  floorFps: i32
  /** The least tier above which `RATE_FIRST` keeps full detail. */
  minTier: i32
  prefer: i32
  maxUnacked: i32
  /** The fixed frame rate, or 0 when the controller chooses. */
  fixedFps: i32
  /** The frame rate in force. */
  tier: i32
  /** The detail step in force, 0 (full detail) to `rateMaxLevel`. */
  level: i32
  /** The oldest unacknowledged frame's index in `sentMs`. */
  head: i32
  dropped: i32
  lost: i32
  /** Whether a frame has been asked for, so the pacer's clock runs. */
  paced: boolean
  /** Whether a round trip, from the probe or an answer, is known. */
  haveRtt: boolean
  /** Whether a frame has been acknowledged, so decisions can start. */
  haveAck: boolean
  /** Whether the bandwidth is known: not after a first answer with no probe, which cannot tell latency from bytes. */
  haveRate: boolean
  /** Whether a frame has been sent, so cost and size are known. */
  haveFrame: boolean

  /** A controller for `options`, read once. */
  constructor(options: RateOptions) {
    this.prefer = options.prefer === DETAIL_FIRST ? DETAIL_FIRST : RATE_FIRST
    this.maxUnacked = options.maxUnacked >= 2 ? 2 : 1
    const fixed: i32 = options.envFps > 0 ? options.envFps : options.fixedFps
    const capped: i32 = fixed > 240 ? 240 : fixed
    this.fixedFps = capped > 0 ? capped : 0
    const all: i32[] = [120, 60, 30, 20, 15, 10, 5]
    this.tiers = []
    for (const t of all) {
      if (t === 5 || (t <= options.maxFps && (t !== 120 || options.allow120))) {
        this.tiers.push(t)
      }
    }
    // The least tier at or above `minFps`; the tiers end at 5, which is below every sensible floor.
    let minTier: i32 = this.tiers[0]
    for (const t of this.tiers) {
      if (t >= options.minFps) {
        minTier = t
      }
    }
    this.minTier = minTier
    this.floorFps = this.prefer === DETAIL_FIRST ? 5 : minTier
    const remote: boolean =
      options.remoteHint && !(options.probeRttMs > 0.0 && options.probeRttMs < rateLocalRttMs)
    const want: i32 = remote ? 15 : 30
    let start: i32 = this.tiers[this.tiers.length - 1]
    for (const t of this.tiers) {
      if (t <= want && t > start) {
        start = t
      }
    }
    const floored: i32 = start < this.floorFps ? this.floorFps : start
    this.tier = this.fixedFps > 0 ? this.fixedFps : floored
    this.level = 0
    this.pacer = new FixedStep(this.tier, 1)
    this.paced = false
    this.changedMs = 0.0
    this.overSinceMs = -1.0
    this.underSinceMs = -1.0
    this.sentMs = []
    this.sentBytes = []
    this.head = 0
    this.lastAckMs = -1.0
    this.haveRtt = options.probeRttMs > 0.0
    this.rttMs = this.haveRtt ? options.probeRttMs : 0.0
    this.baseRttMs = this.rttMs
    this.haveAck = false
    this.haveRate = false
    this.heldBytes = 0.0
    this.bytesPerSec = 0.0
    this.costMs = 0.0
    this.frameBytes = 0.0
    this.haveFrame = false
    this.dropped = 0
    this.lost = 0
    this.current = new RateDecision()
    this.measured = new TermStats()
    this.publish()
  }

  /** Frames sent and not yet acknowledged. */
  unacked(): i32 {
    return toI32(this.sentMs.length) - this.head
  }

  /**
   * Whether a frame may be drawn at `nowMs`: one is due at the tier's pace and
   * fewer than `maxUnacked` frames await their acknowledgement. The first call
   * starts the pace and answers a frame at once. A due frame refused for the
   * limit is counted as dropped, and the next waits for the next step.
   */
  mayDraw(nowMs: f64): boolean {
    let due: boolean = true
    if (this.paced) {
      due = this.pacer.advance(nowMs) > 0
    } else {
      this.paced = true
      this.pacer.advance(nowMs)
    }
    if (!due) {
      return false
    }
    if (this.unacked() >= this.maxUnacked) {
      this.dropped = this.dropped + 1
      return false
    }
    return true
  }

  /** A frame of `bytes` bytes, which took `costNs` nanoseconds to build, was sent at `nowMs`. */
  frameSent(bytes: i32, costNs: f64, nowMs: f64): void {
    const length: i32 = toI32(this.sentMs.length)
    if (this.head > 0 && this.head * 2 >= length) {
      // Drop the answered prefix once it is half the queue: a link always a frame behind never empties it.
      for (let i: i32 = this.head; i < length; i++) {
        this.sentMs[i - this.head] = this.sentMs[i]
        this.sentBytes[i - this.head] = this.sentBytes[i]
      }
      for (let i: i32 = 0; i < this.head; i++) {
        this.sentMs.pop()
        this.sentBytes.pop()
      }
      this.head = 0
    }
    this.sentMs.push(nowMs)
    this.sentBytes.push(bytes)
    const first: boolean = !this.haveFrame
    this.costMs = rateSmooth(this.costMs, costNs / 1000000.0, 0.25, first)
    this.frameBytes = rateSmooth(this.frameBytes, toF64(bytes), 0.25, first)
    this.haveFrame = true
  }

  /**
   * An acknowledgement arrived at `nowMs`; it answers the oldest frame not yet
   * answered. One with no frame waiting (a stray answer, or one for a frame
   * already given up on) is ignored.
   */
  ackReceived(nowMs: f64): void {
    if (this.unacked() === 0) {
      return
    }
    const sent: f64 = this.sentMs[this.head]
    const bytes: f64 = toF64(this.sentBytes[this.head])
    this.head = this.head + 1
    const rtt: f64 = nowMs - sent
    const firstRtt: boolean = !this.haveRtt
    if (firstRtt) {
      this.baseRttMs = rtt
    }
    this.rttMs = rateSmooth(this.rttMs, rtt, 0.125, firstRtt)
    this.haveRtt = true
    this.haveAck = true
    const previous: f64 = this.lastAckMs
    const queued: boolean = previous >= 0.0 && sent < previous
    this.lastAckMs = nowMs
    if (!queued && this.haveRate) {
      // Nothing was ahead of this frame, so its round trip less its bytes' time is the latency.
      const left: f64 = rtt - (bytes * 1000.0) / this.bytesPerSec
      const latency: f64 = left > 0.0 ? left : 0.0
      const base: f64 = this.baseRttMs
      this.baseRttMs = latency < base ? latency : base + (latency - base) / 256.0
    }
    if (firstRtt && !queued) {
      this.heldBytes = bytes
      return
    }
    const busy: f64 = queued ? nowMs - previous : rtt - this.baseRttMs
    const rate: f64 = (bytes * 1000.0) / (busy > rateMinBusyMs ? busy : rateMinBusyMs)
    this.bytesPerSec = rateSmooth(this.bytesPerSec, rate, 0.25, !this.haveRate)
    if (!this.haveRate && this.heldBytes > 0.0) {
      // The first answer's round trip was taken whole as the latency; now its bytes' time comes off.
      const held: f64 = this.baseRttMs - (this.heldBytes * 1000.0) / this.bytesPerSec
      this.baseRttMs = held > 0.0 ? held : 0.0
    }
    this.haveRate = true
  }

  /**
   * The worst of the three loads (cost, bytes, round trip) at `fps` frames a
   * second and detail step `level`, against the 70% budgets: at most 1 fits.
   * A step other than the current one is predicted from the measured frame;
   * `nowMs` lets a frame long unanswered count as a round trip at least that
   * long. A load not yet measured counts as 0.
   */
  load(fps: i32, level: i32, nowMs: f64): f64 {
    const scale: f64 = rateLevelScale(this.level, level)
    const rate: f64 = toF64(fps)
    let worst: f64 = 0.0
    if (this.haveFrame) {
      worst = (this.costMs * scale * rate) / (rateBudget * 1000.0)
    }
    if (this.haveRate && this.haveFrame) {
      const bytes: f64 = (this.frameBytes * scale * rate) / (rateBudget * this.bytesPerSec)
      worst = bytes > worst ? bytes : worst
    }
    if (this.haveRtt) {
      let rtt: f64 = this.rttMs
      if (this.unacked() > 0 && nowMs - this.sentMs[this.head] > rtt) {
        rtt = nowMs - this.sentMs[this.head]
      }
      const base: f64 = this.baseRttMs < rtt ? this.baseRttMs : rtt
      const trip: f64 =
        (rate * (base + (rtt - base) * scale)) / (rateBudget * 1000.0 * toF64(this.maxUnacked))
      worst = trip > worst ? trip : worst
    }
    return worst
  }

  /** The fastest allowed tier slower than `fps` and no slower than `least`, or `least`. */
  slowerTier(fps: i32, least: i32): i32 {
    for (const t of this.tiers) {
      if (t < fps && t >= least) {
        return t
      }
    }
    return least
  }

  /** The slowest allowed tier faster than `fps`, or `fps` at the top. */
  fasterTier(fps: i32): i32 {
    let faster: i32 = fps
    for (const t of this.tiers) {
      if (t > fps) {
        faster = t
      }
    }
    return faster
  }

  /** Move to `fps` at detail step `level` at `nowMs`, rescaling the frame averages to the step. */
  moveTo(fps: i32, level: i32, nowMs: f64): void {
    if (level !== this.level) {
      const scale: f64 = rateLevelScale(this.level, level)
      this.costMs = this.costMs * scale
      this.frameBytes = this.frameBytes * scale
      this.rttMs = this.baseRttMs + (this.rttMs - this.baseRttMs) * scale
      this.level = level
    }
    if (fps !== this.tier) {
      this.tier = fps
      this.pacer.stepMs = 1000.0 / toF64(fps)
    }
    this.changedMs = nowMs
    this.overSinceMs = -1.0
    this.underSinceMs = -1.0
  }

  /** One step down the path at `nowMs`, when over budget: fewer frames, or less detail. */
  stepDown(nowMs: f64): void {
    const least: i32 = this.tiers[this.tiers.length - 1]
    if (this.tier > this.floorFps) {
      // Straight to the fastest tier down to the floor that fits.
      let fps: i32 = this.slowerTier(this.tier, this.floorFps)
      while (fps > this.floorFps && this.load(fps, this.level, nowMs) > 1.0) {
        fps = this.slowerTier(fps, this.floorFps)
      }
      this.moveTo(fps, this.level, nowMs)
      return
    }
    const here: f64 = this.load(this.tier, this.level, nowMs)
    if (this.level < rateMaxLevel && this.load(this.tier, this.level + 1, nowMs) <= here * rateStepGain) {
      this.moveTo(this.tier, this.level + 1, nowMs)
      return
    }
    if (this.tier > least) {
      let fps: i32 = this.slowerTier(this.tier, least)
      while (fps > least && this.load(fps, this.level, nowMs) > 1.0) {
        fps = this.slowerTier(fps, least)
      }
      this.moveTo(fps, this.level, nowMs)
    }
  }

  /**
   * The next state up the path, as `fps * 8 + level`, or -1 at the top. It is
   * the descent backwards: tiers below the floor first, then detail, then
   * tiers above it.
   */
  stepUp(): i32 {
    if (this.tier < this.floorFps || (this.level === 0 && this.tier < this.tiers[0])) {
      return this.fasterTier(this.tier) * 8 + this.level
    }
    if (this.level > 0) {
      return this.tier * 8 + this.level - 1
    }
    return -1
  }

  /**
   * Re-decide at `nowMs`: give up frames long unanswered, then fall, cut
   * detail, restore it or rise, at most one change, with the hysteresis the
   * module header describes. Nothing is decided before the first
   * acknowledgement, nor at a fixed rate.
   */
  tick(nowMs: f64): void {
    while (this.unacked() > 0 && nowMs - this.sentMs[this.head] > rateAckTimeoutMs + 4.0 * this.rttMs) {
      this.head = this.head + 1
      this.lost = this.lost + 1
    }
    if (this.fixedFps === 0 && this.haveAck) {
      this.decide(nowMs)
    }
    this.publish()
  }

  /** `tick`'s choosing, past its guards. */
  decide(nowMs: f64): void {
    const settled: boolean = nowMs - this.changedMs >= rateSettleMs
    if (this.load(this.tier, this.level, nowMs) > 1.0) {
      this.underSinceMs = -1.0
      if (this.overSinceMs < 0.0) {
        this.overSinceMs = nowMs
      }
      if (settled && nowMs - this.overSinceMs >= rateDropAfterMs) {
        this.stepDown(nowMs)
      }
      return
    }
    this.overSinceMs = -1.0
    const up: i32 = this.stepUp()
    if (up < 0 || this.load((up / 8) | 0, up % 8, nowMs) > rateRiseMargin) {
      this.underSinceMs = -1.0
      return
    }
    if (this.underSinceMs < 0.0) {
      this.underSinceMs = nowMs
    }
    if (settled && nowMs - this.underSinceMs >= rateRiseAfterMs) {
      this.moveTo((up / 8) | 0, up % 8, nowMs)
    }
  }

  /** Copy the state into `current` and `measured`. */
  publish(): void {
    const d: RateDecision = this.current
    d.fps = this.tier
    d.resolutionDivisor = this.level >= 2 ? 4 : this.level + 1
    d.backendCap = this.level >= 3 ? BACKEND_CAP_HALFBLOCK : BACKEND_CAP_KITTY
    d.palette256 = this.level >= rateMaxLevel
    const s: TermStats = this.measured
    s.tier = this.tier
    s.backend = d.backendCap
    s.rttMs = this.rttMs
    s.bytesPerSec = this.bytesPerSec
    s.frameCostMs = this.costMs
    s.dropped = this.dropped
    s.unacked = this.unacked()
    s.lost = this.lost
  }

  /** How to draw the next frame, as of the last `tick`. */
  decision(): RateDecision {
    return this.current
  }

  /** What has been measured, as of the last `tick`. */
  stats(): TermStats {
    return this.measured
  }
}

/** `x` rounded to a whole number, for the overlay. */
const rateWhole = (x: f64): i32 => toI32(Math.round(x))

/** The short name of a `BACKEND_CAP_*`. */
const rateBackendName = (cap: i32): string => {
  if (cap === BACKEND_CAP_HALFBLOCK) {
    return "half"
  }
  if (cap === BACKEND_CAP_SIXEL) {
    return "sixel"
  }
  return cap === BACKEND_CAP_KITTY ? "full" : "ascii"
}

/**
 * Write `stats` as two short lines, inverse, into `corner` (a `CORNER_*`) of
 * `screen`: the rate, round trip and kilobytes a second, then the frame cost,
 * the frames dropped and the backend cap. A screen too small clips them.
 */
export const drawStatsOverlay = (screen: Screen, stats: TermStats, corner: i32): void => {
  const top: string = `${stats.tier}fps ${rateWhole(stats.rttMs)}ms ${rateWhole(stats.bytesPerSec / 1000.0)}kB/s`
  const bottom: string = `${rateWhole(stats.frameCostMs)}ms drop ${stats.dropped} ${rateBackendName(stats.backend)}`
  const width: i32 = toI32(top.length > bottom.length ? top.length : bottom.length)
  const right: boolean = corner === CORNER_TOP_RIGHT || corner === CORNER_BOTTOM_RIGHT
  const below: boolean = corner === CORNER_BOTTOM_LEFT || corner === CORNER_BOTTOM_RIGHT
  const x: i32 = right && screen.width > width ? screen.width - width : 0
  const y: i32 = below && screen.height > 2 ? screen.height - 2 : 0
  screen.text(x, y, top, COLOR_DEFAULT, COLOR_DEFAULT, ATTR_INVERSE)
  screen.text(x, y + 1, bottom, COLOR_DEFAULT, COLOR_DEFAULT, ATTR_INVERSE)
}
