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
 * one late answer moves it little); the bytes a second the link delivered;
 * the cost to build a frame and the bytes in one (weight 1/4 each, so a
 * change of scene shows within a few frames).
 * The bandwidth and the latency are kept apart, so neither can take the
 * other's share of a round trip. A frame sent before the previous answer, and
 * answered more than the latency after it, kept the link busy from that answer
 * to its own: its bytes over that time measure the bandwidth. A frame sent
 * onto an idle link makes a trip, kept with the last 16 and the probe's:
 * against the quickest kept trip, one twice its bytes or half, 2 ms or more
 * apart, measures the bandwidth from the difference, which the latency is no
 * part of.
 * Both kinds smooth the bytes and the time apart (weight 1/4 each), so answers
 * arriving in a burst, each taking almost no time, do not read as unbounded
 * bandwidth; answers under 2 ms apart measure nothing this way. A sample
 * counts for 5 seconds with no newer one, so a link that narrows is not held
 * to its old rate. The bandwidth reported is at least the most of the last 16
 * answers' bytes over their whole round trips, since the bytes took no longer
 * than that, so a link that widens shows on its first quick answer; but that
 * bound counts the latency as bytes' time, so alone it never makes the
 * bandwidth known to the decisions. The base latency is the least, over the
 * kept trips, of the round trip less the trip's bytes at the bandwidth: the
 * probe's round trip (`probeRttMs`: the status query alone is a few bytes, so
 * its round trip is the latency) counts from the start, the frames' once the
 * bandwidth is known. The kept trips roll over, so a changed route shows
 * within 16 trips. With frames of one size sent one at a time onto
 * an idle link and no probe the latency and the bytes cannot be told apart:
 * the bandwidth is then not known, its load counts as 0, and the trip load
 * governs on the frame's measured round trip: a cut is taken to shorten none
 * of it and a restore to lengthen all of it, so detail is neither cut for a
 * gain nor restored at a cost that may not be there.
 * Acknowledgements match sent frames oldest first. A frame due while the
 * unacknowledged limit is reached is dropped and counted; one not answered
 * within `rateAckTimeoutMs` plus four round trips is given up and counted as
 * lost, so a lost answer
 * stalls drawing for seconds, not for ever. Its answer may still come late, and
 * would otherwise be matched to the next frame, so after a give-up no frame is
 * drawn until as many answers have arrived, or one more timeout has passed
 * without them. A time, cost or size that is not a finite number, or is
 * negative, is not measured, and an empty frame says nothing about bandwidth.
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

/** How many trips, from the probe and from frames sent onto an idle link, the latency is the least of. */
const rateTripCount: i32 = 16

/** Two trips measure the bandwidth from their difference only when it is at least this many milliseconds. */
const rateSplitMs: f64 = 2.0

/** How long a bandwidth sample counts with no newer one, in milliseconds, so a link that narrows is not held to its old rate. */
const rateFreshMs: f64 = 5000.0

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

/** Whether `x` is a number, not NaN or an infinity. */
const rateFinite = (x: f64): boolean => x - x === 0.0

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
  /** The link's latency without bytes: the least, over the kept trips, of the round trip less the bytes' time. */
  baseRttMs: f64
  /** The latency as last worked out while the bandwidth was known, held once its samples age out. */
  heldLatencyMs: f64
  /** The round trips of the probe and of the latest frames sent onto an idle link, `rateTripCount` at most. */
  tripMs: f64[]
  /** Their byte counts, 0 for the probe. */
  tripBytes: f64[]
  /** The bytes a second each of the latest answers proves at least, its bytes over its round trip. */
  floorPerSec: f64[]
  /** The smoothed bytes of an answered frame, for the bandwidth. */
  ackBytes: f64
  /** The smoothed time the link spent on an answered frame, in milliseconds, for the bandwidth. */
  ackBusyMs: f64
  /** The bytes a second delivered: `ackBytes` over `ackBusyMs`, at least the most of `floorPerSec`, which alone is a lower bound. */
  bytesPerSec: f64
  /** When the bandwidth was last sampled, by a frame that waited behind another or by two trips. */
  rateAtMs: f64
  /** When frames were last given up on, while `stale` waits for their late answers. */
  staleSinceMs: f64
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
  /** Frames given up on whose answers may still come: the next answers are theirs, and no frame is drawn meanwhile. */
  stale: i32
  /** Where the next trip goes in `tripMs` once it is full. */
  tripNext: i32
  /** Where the next goes in `floorPerSec` once it is full. */
  floorNext: i32
  /** Whether a frame has been asked for, so the pacer's clock runs. */
  paced: boolean
  /** Whether a round trip, from the probe or an answer, is known. */
  haveRtt: boolean
  /** Whether a frame has been acknowledged, so decisions can start. */
  haveAck: boolean
  /**
   * Whether the bandwidth is known, so decisions may use it: sampled by a
   * frame that waited behind another or two trips of different sizes, within
   * `rateFreshMs`. The answers' bytes over their round trips are only a lower
   * bound and never make it known.
   */
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
    // A probe time that is not a finite number says nothing.
    this.haveRtt = options.probeRttMs > 0.0 && rateFinite(options.probeRttMs)
    this.rttMs = this.haveRtt ? options.probeRttMs : 0.0
    this.baseRttMs = this.rttMs
    this.haveAck = false
    this.haveRate = false
    this.tripMs = []
    this.tripBytes = []
    this.tripNext = 0
    this.floorPerSec = []
    this.floorNext = 0
    if (this.haveRtt) {
      // The probe is a few bytes, so its round trip is the latency.
      this.tripMs.push(this.rttMs)
      this.tripBytes.push(toF64(0))
    }
    this.ackBytes = 0.0
    this.ackBusyMs = 0.0
    this.bytesPerSec = 0.0
    this.rateAtMs = 0.0
    this.heldLatencyMs = 0.0
    this.stale = 0
    this.staleSinceMs = 0.0
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
   * limit, or while the answers to frames given up on may still come, is
   * counted as dropped, and the next waits for the next step. A time that is
   * not a finite number is refused.
   */
  mayDraw(nowMs: f64): boolean {
    if (!rateFinite(nowMs)) {
      return false
    }
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
    if (this.unacked() >= this.maxUnacked || this.stale > 0) {
      this.dropped = this.dropped + 1
      return false
    }
    return true
  }

  /**
   * A frame of `bytes` bytes, which took `costNs` nanoseconds to build, was
   * sent at `nowMs`. A call whose time is not a finite number is ignored; a
   * cost that is not a finite number or is negative is not measured, and
   * negative bytes count as none.
   */
  frameSent(bytes: i32, costNs: f64, nowMs: f64): void {
    if (!rateFinite(nowMs)) {
      return
    }
    const size: i32 = bytes > 0 ? bytes : 0
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
    this.sentBytes.push(size)
    if (rateFinite(costNs) && costNs >= 0.0) {
      const first: boolean = !this.haveFrame
      this.costMs = rateSmooth(this.costMs, costNs / 1000000.0, 0.25, first)
      this.frameBytes = rateSmooth(this.frameBytes, toF64(size), 0.25, first)
      this.haveFrame = true
    }
  }

  /**
   * An acknowledgement arrived at `nowMs`; it answers the oldest frame not yet
   * answered. While frames given up on may still be answered, it is theirs,
   * since the terminal answers in order. One with no frame waiting (a stray
   * answer) is ignored, and one whose time is not a finite number answers its
   * frame and measures nothing.
   */
  ackReceived(nowMs: f64): void {
    if (this.stale > 0) {
      this.stale = this.stale - 1
      return
    }
    if (this.unacked() === 0) {
      return
    }
    const sent: f64 = this.sentMs[this.head]
    const bytes: f64 = toF64(this.sentBytes[this.head])
    this.head = this.head + 1
    if (!rateFinite(nowMs)) {
      return
    }
    this.haveAck = true
    // A clock that stepped back, or an answer read in the millisecond its frame went, times nothing.
    if (!(nowMs > sent)) {
      return
    }
    const rtt: f64 = nowMs - sent
    this.rttMs = rateSmooth(this.rttMs, rtt, 0.125, !this.haveRtt)
    this.haveRtt = true
    const previous: f64 = this.lastAckMs
    this.lastAckMs = nowMs
    if (previous >= 0.0 && previous > sent + this.baseRttMs) {
      // The link was still busy with the frame ahead when this one reached it, so the gap between their answers is
      // this frame's bytes alone, whatever the latency. Bytes and time are smoothed apart, not their ratio.
      // Answers read in a burst arrive together, too close to time, and measure nothing this way.
      const took: f64 = nowMs - previous
      if (bytes > 0.0 && took >= rateSplitMs) {
        this.measureRate(bytes, took)
      }
    } else {
      this.measureTrip(rtt, bytes)
    }
    if (bytes > 0.0 && rtt > rateMinBusyMs) {
      // Whatever the latency and however late the answer was read, the bytes took no longer than the whole trip.
      if (toI32(this.floorPerSec.length) < rateTripCount) {
        this.floorPerSec.push((bytes * 1000.0) / rtt)
      } else {
        this.floorPerSec[this.floorNext] = (bytes * 1000.0) / rtt
        this.floorNext = (this.floorNext + 1) % rateTripCount
      }
      this.updateRate()
    }
    this.baseRttMs = this.leastLatency()
  }

  /**
   * A frame of `bytes` sent onto an idle link came back in `rtt`: its latency
   * plus its bytes' time, which cannot be told apart alone. Against the
   * quickest trip kept, a frame at least twice the size (or twice as small)
   * whose round trip differs by `rateSplitMs` or more does tell them apart:
   * the extra bytes took the extra time, and the latency drops out. Frames of
   * one size measure nothing here, so small frames cannot drag the bandwidth
   * down to their round trip.
   */
  measureTrip(rtt: f64, bytes: f64): void {
    let quickest: i32 = -1
    for (let i: i32 = 0; i < toI32(this.tripMs.length); i++) {
      if (quickest < 0 || this.tripMs[i] < this.tripMs[quickest]) {
        quickest = i
      }
    }
    if (quickest >= 0) {
      const otherMs: f64 = this.tripMs[quickest]
      const otherBytes: f64 = this.tripBytes[quickest]
      const big: boolean = bytes > otherBytes
      const moreBytes: f64 = big ? bytes - otherBytes : otherBytes - bytes
      const moreMs: f64 = big ? rtt - otherMs : otherMs - rtt
      const least: f64 = big ? otherBytes : bytes
      if (moreBytes >= least && moreMs >= rateSplitMs) {
        this.measureRate(moreBytes, moreMs)
      }
    }
    if (toI32(this.tripMs.length) < rateTripCount) {
      this.tripMs.push(rtt)
      this.tripBytes.push(bytes)
    } else {
      this.tripMs[this.tripNext] = rtt
      this.tripBytes[this.tripNext] = bytes
      this.tripNext = (this.tripNext + 1) % rateTripCount
    }
  }

  /** The link spent `busyMs` on `bytes`: one sample of the bandwidth. */
  measureRate(bytes: f64, busyMs: f64): void {
    const first: boolean = this.ackBusyMs <= 0.0
    this.rateAtMs = this.lastAckMs
    this.ackBytes = rateSmooth(this.ackBytes, bytes, 0.25, first)
    this.ackBusyMs = rateSmooth(this.ackBusyMs, busyMs, 0.25, first)
    this.updateRate()
  }

  /**
   * The bandwidth: the smoothed samples, but never under what the latest
   * answers prove, so a link that widens, or whose answers are read late, is
   * not taken for a narrow one. Only samples make it known: an answer's bytes
   * over its whole round trip count the latency as bytes' time, and on a far
   * link that reads the bandwidth several times too low.
   */
  updateRate(): void {
    let rate: f64 = this.ackBusyMs > 0.0 ? (this.ackBytes * 1000.0) / this.ackBusyMs : 0.0
    this.haveRate = rate > 0.0
    for (let i: i32 = 0; i < toI32(this.floorPerSec.length); i++) {
      if (this.floorPerSec[i] > rate) {
        rate = this.floorPerSec[i]
      }
    }
    this.bytesPerSec = rate
  }

  /** Forget the bandwidth samples once none is newer than `rateFreshMs` at `nowMs`; the lower bound stays. */
  ageRate(nowMs: f64): void {
    if (this.haveRate && nowMs - this.rateAtMs > rateFreshMs) {
      this.heldLatencyMs = this.baseRttMs
      this.ackBytes = 0.0
      this.ackBusyMs = 0.0
      this.updateRate()
      this.baseRttMs = this.leastLatency()
    }
  }

  /**
   * The latency: the least, over the kept trips, of the round trip less its
   * bytes' time at the measured bandwidth. While the bandwidth is not known
   * only an empty trip, the probe's, says anything; with none it is the
   * latency held from when the bandwidth was last known, or 0 before that: a
   * lower bound, which is what telling a waited frame from a trip needs, and
   * one that a probe trip rolled out of the kept trips does not drop to 0, or
   * every frame sent before the answer ahead of it would look waited. The bandwidth never comes from the latency on an idle link, so
   * neither can drag the other down.
   */
  leastLatency(): f64 {
    let least: f64 = -1.0
    for (let i: i32 = 0; i < toI32(this.tripMs.length); i++) {
      const bytes: f64 = this.tripBytes[i]
      if (bytes <= 0.0 || this.haveRate) {
        const left: f64 = bytes > 0.0 ? this.tripMs[i] - (bytes * 1000.0) / this.bytesPerSec : this.tripMs[i]
        const latency: f64 = left > 0.0 ? left : 0.0
        if (least < 0.0 || latency < least) {
          least = latency
        }
      }
    }
    if (least < 0.0) {
      return this.heldLatencyMs
    }
    return least > 0.0 ? least : 0.0
  }

  /**
   * The part of a round trip of `rtt` that a detail change scaling the bytes
   * by `scale` leaves alone: the latency once the bandwidth is known. While it
   * is not, the guess is the cautious one each way: less detail shortens no
   * more than the round trip's excess over the quickest trip kept, which is
   * at least the latency, so detail is not cut for a gain that may not be
   * there; more lengthens all of it, so detail is not restored on a link that
   * may not carry it.
   */
  fixedPart(rtt: f64, scale: f64): f64 {
    if (!this.haveRate) {
      if (scale >= 1.0) {
        return 0.0
      }
      let quickest: f64 = rtt
      for (let i: i32 = 0; i < toI32(this.tripMs.length); i++) {
        if (this.tripMs[i] < quickest) {
          quickest = this.tripMs[i]
        }
      }
      return quickest
    }
    return this.baseRttMs < rtt ? this.baseRttMs : rtt
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
      const base: f64 = this.fixedPart(rtt, scale)
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
      const base: f64 = this.fixedPart(this.rttMs, scale)
      this.rttMs = base + (this.rttMs - base) * scale
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
    if (!rateFinite(nowMs)) {
      this.publish()
      return
    }
    const wait: f64 = rateAckTimeoutMs + 4.0 * this.rttMs
    if (this.stale > 0 && nowMs - this.staleSinceMs > wait) {
      // Their answers were lost too; with nothing drawn since, the next answer is a new frame's.
      this.stale = 0
    }
    while (this.unacked() > 0 && nowMs - this.sentMs[this.head] > wait) {
      this.head = this.head + 1
      this.lost = this.lost + 1
      this.stale = this.stale + 1
      this.staleSinceMs = nowMs
    }
    this.ageRate(nowMs)
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
const rateWhole = (x: f64): i32 => {
  if (!(x > -1000000000.0 && x < 1000000000.0)) {
    // NaN and the far ends, which do not fit in an i32, show as 0 and the clamp.
    return x > 0.0 ? 1000000000 : 0
  }
  return toI32(Math.round(x))
}

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
