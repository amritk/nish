/**
 * `std/term-io` — opening a terminal, drawing frames, reading events and
 * leaving it as it was: the one entry point that uses the other term modules
 * and does the I/O.
 *
 * ```ts
 * import { defaultTerminalOptions, runTerminal, TermInput, Frame } from "nish/term-io";
 * ```
 *
 * - `runTerminal(options, state, update, render)` is the whole program loop:
 *   it opens the terminal, runs `update(state, input)` at
 *   `options.stepsPerSecond` fixed steps a second, calls `render(state, frame)`
 *   whenever the refresh controller (`nish/term-rate`) lets a frame go out,
 *   presents it and closes the terminal when `update` answers false or the
 *   user quits (Ctrl-C under the kitty keyboard protocol; a plain Ctrl-C is
 *   SIGINT, after which the runtime writes the restore string). It answers
 *   `Err` with one sentence when the terminal cannot be opened or stdin ends.
 * - `openTerminal(options)` answers a `Terminal`, for a program that runs its
 *   own loop with `readEvents`, `present`, `stats` and `close`.
 *
 * Opening refuses a pipe on stdin or stdout, enters raw mode and the alternate
 * screen, hides the cursor, probes the terminal (`nish/term-probe`, at most
 * `TERM_PROBE_TIMEOUT_MS`) and turns on what the options ask for and the
 * terminal has: the kitty keyboard protocol (`CSI > 11 u`: key releases and
 * Ctrl-C as a key), mouse reports (1000, 1002 or 1003, in SGR form 1006, with
 * pixel coordinates 1016 when the terminal has them), bracketed paste (2004)
 * and focus reports (1004). Before each change reaches the terminal, the
 * runtime's restore string (`setTerminalRestore`) is set to undo everything —
 * cancel any half-written escape (CAN), end synchronized output,
 * delete the kitty image, pop the kitty keyboard flags, turn mouse, paste and
 * focus reports off, reset the style, show the cursor and leave the alternate
 * screen — so a panic or a signal leaves the terminal as it was.
 *
 * `present()` draws the `Screen` and the `Framebuffer`, if the options gave
 * one, with the best backend the terminal has capped by the controller
 * (`min(caps.graphics, decision.backendCap)`), at the controller's resolution
 * divisor and palette, wrapped in synchronized output when the terminal has
 * it, as one write. It follows the frame with a DSR 5 query (`CSI 5 n`),
 * whose answer (`CSI 0 n`) acknowledges the frame to the controller and marks
 * the input before it as delivered to `KeyState`. No answer from the terminal
 * reaches the program: one that arrives after the probe gave up (a slow link)
 * is taken, and a cell size among them is learned. `close` reads the
 * acknowledgements still in flight before it leaves raw mode, so none is
 * echoed onto the shell's line.
 *
 * A frame's cost to the controller is the program's `update` and `render`
 * since the last frame plus encoding it, not the write: a write that blocks
 * on a slow link is the link's time, which the acknowledgements measure.
 *
 * Steady state allocates nothing per frame that outlives it: the frame's
 * strings live in `Terminal.send`'s scope, the pixel encoders write into one
 * `PixelBytes`, and a read that holds only frame acknowledgements is counted
 * without being decoded.
 *
 * Private helpers share the importing program's flat symbol namespace
 * (`docs/wp26-stdlib.md` §3e), which is why each one carries the module's name.
 */
import { isTerminal, readStdin, setRawMode, setTerminalRestore, terminalSize, waitStdin } from "nish:term"
import { monotonicNanos } from "nish:process"
import {
  EVENT_QUIT,
  EVENT_REPLY,
  EVENT_RESIZE,
  Canvas,
  FixedStep,
  KeyDecoder,
  KeyState,
  Screen,
  TermEvent,
  beginSync,
  endSync,
  enterAltScreen,
  hideCursor,
  leaveAltScreen,
  resetStyle,
  showCursor,
} from "nish/term"
import { TermCaps, TermEnv, TermProbe, probeQueries } from "nish/term-probe"
import { RATE_FIRST, RateController, RateOptions, TermStats, drawStatsOverlay } from "nish/term-rate"
import {
  GRAPHICS_ASCII,
  GRAPHICS_HALFBLOCK,
  GRAPHICS_KITTY,
  GRAPHICS_SIXEL,
  Framebuffer,
  PixelBytes,
  PixelRect,
  drawAscii,
  drawHalfBlocks,
  fitFramebuffer,
  kittyDelete,
  kittyFrame,
  scaleFramebuffer,
  sixelFrame,
} from "nish/term-pixels"

/** The kitty image id a `Terminal` draws its framebuffer as. */
const TERM_IO_IMAGE_ID: i32 = 1

/** How long the session decoder holds an unfinished escape sequence, in milliseconds. */
const TERM_IO_ESCAPE_MS: f64 = 40.0

/** How long after the last acknowledgement arrived `KeyState` stops measuring silence against it, in milliseconds. */
const TERM_IO_WATERMARK_MS: f64 = 1000.0

/** The frame acknowledgements a `Terminal` remembers the send times of. */
const TERM_IO_ACKS: i32 = 64

/** The least and most `close` waits for the acknowledgements still in flight, in milliseconds. */
const TERM_IO_DRAIN_MIN_MS: f64 = 50.0
const TERM_IO_DRAIN_MAX_MS: f64 = 500.0

/** The bytes one read takes. */
const TERM_IO_READ: i32 = 4096

/** The size assumed when the terminal will not say. */
const TERM_IO_COLS: i32 = 80
const TERM_IO_ROWS: i32 = 24

/** What `openTerminal` and `runTerminal` turn on, and how the frame loop runs. */
export class TerminalOptions {
  /** Fixed `update` steps a second (60). */
  stepsPerSecond: i32
  /** The least frame rate the controller keeps before it cuts detail (10). */
  minFps: i32
  /** The most frames a second (60). */
  maxFps: i32
  /** A fixed frame rate, or 0 to let the controller choose (0). */
  fixedFps: i32
  /** Whether 120 frames a second may be chosen (false). */
  allow120: boolean
  /** `RATE_FIRST` or `DETAIL_FIRST`, from `nish/term-rate` (`RATE_FIRST`). */
  prefer: i32
  /** Mouse reports: 0 (off), 1000 (clicks), 1002 (drags) or 1003 (all motion) (0). */
  mouse: i32
  /** Bracketed paste, so a paste is one `EVENT_PASTE` (true). */
  paste: boolean
  /** Focus reports, `EVENT_FOCUS` (false). */
  focus: boolean
  /** The kitty keyboard protocol where the terminal has it: real releases, Ctrl-C as a key (true). */
  kittyKeyboard: boolean
  /** Whether Ctrl-C, when it arrives as a key, quits (true). */
  quitOnCtrlC: boolean
  /** How long after a held key's last repeat it counts as released, without the kitty protocol (100). */
  releaseGapMs: f64
  /** The framebuffer's size in pixels, or 0 by 0 for none (0 by 0). */
  framebufferWidth: i32
  framebufferHeight: i32
  /** The corner (`CORNER_*` from `nish/term-rate`) to draw the stats overlay in, or -1 for none (-1). */
  overlay: i32
  /**
   * The backend to use, as `NISH_TERM_GRAPHICS` names one ("kitty", "sixel",
   * "halfblock" or "ascii"), or "" to take the best the terminal has (""). The
   * variable, when it is set, wins; the probe refuses a backend the terminal
   * did not answer for, as it does the variable's.
   */
  graphics: string

  constructor() {
    this.stepsPerSecond = 60
    this.minFps = 10
    this.maxFps = 60
    this.fixedFps = 0
    this.allow120 = false
    this.prefer = RATE_FIRST
    this.mouse = 0
    this.paste = true
    this.focus = false
    this.kittyKeyboard = true
    this.quitOnCtrlC = true
    this.releaseGapMs = 100.0
    this.framebufferWidth = 0
    this.framebufferHeight = 0
    this.overlay = -1
    this.graphics = ""
  }
}

/** The options every field's comment gives the default of. */
export const defaultTerminalOptions = (): TerminalOptions => new TerminalOptions()

/** The monotonic clock in milliseconds. */
const termIoNowMs = (): f64 => toF64(monotonicNanos()) / 1000000.0

/** The environment variable `name`, or "" when it is unset. */
const termIoGetenv = (name: string): string => {
  const v: string | null = getenv(name)
  return v === null ? "" : v
}

/** The variables `nish/term-probe` reads, with `graphics` standing for `NISH_TERM_GRAPHICS` when it is unset. */
const termIoEnv = (graphics: string): TermEnv => {
  const env: TermEnv = new TermEnv()
  env.term = termIoGetenv("TERM")
  env.colorterm = termIoGetenv("COLORTERM")
  env.termProgram = termIoGetenv("TERM_PROGRAM")
  env.tmux = termIoGetenv("TMUX")
  env.sty = termIoGetenv("STY")
  env.sshConnection = termIoGetenv("SSH_CONNECTION")
  env.sshClient = termIoGetenv("SSH_CLIENT")
  env.sshTty = termIoGetenv("SSH_TTY")
  env.noColor = termIoGetenv("NO_COLOR")
  const forced: string = termIoGetenv("NISH_TERM_GRAPHICS")
  env.nishTermGraphics = forced === "" ? graphics : forced
  env.nishTermFps = termIoGetenv("NISH_TERM_FPS")
  return env
}

/** The `GRAPHICS_*` a `TermCaps.graphics` name stands for. */
const termIoGraphics = (name: string): i32 => {
  if (name === "kitty") {
    return GRAPHICS_KITTY
  }
  if (name === "sixel") {
    return GRAPHICS_SIXEL
  }
  return name === "halfblock" ? GRAPHICS_HALFBLOCK : GRAPHICS_ASCII
}

/** A probed cell size clamped to 1–256 pixels, or 0 when the probe did not learn it. */
const termIoCellPx = (px: i32): i32 => {
  if (px <= 0) {
    return 0
  }
  return px > 256 ? 256 : px
}

/** Whether `e` is the answer to DSR 5, `CSI 0 n`: a frame acknowledgement. */
const termIoIsAck = (e: TermEvent): boolean =>
  e.type === EVENT_REPLY && e.introducer === 91 && e.prefix === 0 && e.intermediate === 0 && e.reply === 110

/**
 * How many `CSI 0 n` make up `buf[0, n)` exactly, or -1 when it holds
 * anything else: the read a frame loop gets most often, counted without
 * decoding it.
 */
const termIoOnlyAcks = (buf: u8[], n: i32): i32 => {
  if (n <= 0 || n % 4 !== 0) {
    return -1
  }
  if (n > toI32(buf.length)) {
    return -1
  }
  for (let i: i32 = 0; i >= 0 && i + 3 < toI32(buf.length) && i < n; i = i + 4) {
    if (buf[i] !== 27 || buf[i + 1] !== 91 || buf[i + 2] !== 48 || buf[i + 3] !== 110) {
      return -1
    }
  }
  return (n / 4) | 0
}

/** Parameter `i` of a reply, or -1 when it has fewer. */
const termIoParam = (e: TermEvent, i: i32): i32 => (i < toI32(e.params.length) ? e.params[i] : -1)

/**
 * An open terminal: what it can do, the `Screen` and `Framebuffer` a program
 * draws into, and the state that reads its events and paces its frames.
 * Made by `openTerminal`.
 */
export class Terminal {
  options: TerminalOptions
  caps: TermCaps
  /** The cell grid the program draws into, the terminal's size. */
  screen: Screen
  canvas: Canvas
  /** The pixels the program draws into, `options.framebufferWidth × framebufferHeight`. */
  framebuffer: Framebuffer
  /** The framebuffer shrunk by the controller's resolution divisor. */
  scaled: Framebuffer
  pixels: PixelBytes
  decoder: KeyDecoder
  keys: KeyState
  rate: RateController
  /** The events read during the probe, handed to the program first. */
  held: TermEvent[]
  /** The send times of the frames not yet acknowledged, a ring of `TERM_IO_ACKS`. */
  ackSent: f64[]
  ackHead: i32
  ackCount: i32
  readBuf: u8[]
  /** Where the framebuffer is drawn, for `rectCols × rectRows` cells and `rectBackend`. */
  rect: PixelRect
  /** When the last frame acknowledgement arrived, or -1. */
  lastAckMs: f64
  /** The last acknowledged frame's own round trip, in milliseconds, which the controller's smoothed one trails. */
  lastRttMs: f64
  /** The program's work toward the next frame (its `update` and `render`), in nanoseconds, which `present` adds to the frame's cost. */
  workNs: f64
  /** When the last frame's write began, on the monotonic clock. */
  sendStartNs: i64
  /** The cells, backend and framebuffer size `rect` was fitted to. */
  rectCols: i32
  rectRows: i32
  rectBackend: i32
  rectWidth: i32
  rectHeight: i32
  /** The best backend the terminal has, a `GRAPHICS_*`. */
  graphics: i32
  /** The backend the last frame used. */
  backend: i32
  cellWidthPx: i32
  cellHeightPx: i32
  /** The size `terminalSize` last answered. */
  sizeCols: i32
  sizeRows: i32
  /** The size last given to the `Screen`, before it clamped it, which `checkResize` compares. */
  shownCols: i32
  shownRows: i32
  /** The mouse mode turned on, or 0. */
  mouseMode: i32
  open: boolean
  kittyKeyboardOn: boolean
  pixelMouseOn: boolean
  pasteOn: boolean
  focusOn: boolean
  /** Whether a kitty image may be on the screen, so closing deletes it. */
  kittyImage: boolean
  /** Whether the last frame sent pixels, so a framebuffer emptied since takes them off the screen. */
  pixelsShown: boolean
  /** Whether `screen` was drawn in 256 colours last frame. */
  palette256: boolean

  constructor(options: TerminalOptions, caps: TermCaps, cols: i32, rows: i32, held: TermEvent[]) {
    this.options = options
    this.caps = caps
    this.palette256 = !caps.trueColor
    this.screen = new Screen(cols, rows, this.palette256)
    this.screen.sync = false
    this.canvas = new Canvas(this.screen)
    const fbW: i32 =
      options.framebufferWidth > 0 && options.framebufferHeight > 0 ? options.framebufferWidth : 0
    const fbH: i32 = fbW > 0 ? options.framebufferHeight : 0
    this.framebuffer = new Framebuffer(fbW, fbH)
    this.scaled = new Framebuffer(0, 0)
    this.pixels = new PixelBytes(4096)
    this.decoder = new KeyDecoder(TERM_IO_ESCAPE_MS)
    this.keys = new KeyState()
    this.keys.quitOnCtrlC = options.quitOnCtrlC
    this.keys.releaseGapMs = options.releaseGapMs
    const rateOptions: RateOptions = new RateOptions()
    rateOptions.probeRttMs = caps.probeRttMs > 0.0 ? caps.probeRttMs : 0.0
    rateOptions.minFps = options.minFps
    rateOptions.maxFps = options.maxFps
    rateOptions.fixedFps = options.fixedFps
    rateOptions.prefer = options.prefer
    rateOptions.allow120 = options.allow120
    rateOptions.remoteHint = caps.remoteHint
    rateOptions.envFps = parseInt(termIoGetenv("NISH_TERM_FPS"))
    this.rate = new RateController(rateOptions)
    // The probe carries `NISH_TERM_FPS` without reading it; the controller applies it, so say so here.
    if (rateOptions.envFps > 0) {
      const forced: string = `NISH_TERM_FPS=${termIoGetenv("NISH_TERM_FPS")}: ${this.rate.fixedFps} frames a second`
      caps.overrides = caps.overrides === "" ? forced : `${caps.overrides}; ${forced}`
    }
    this.held = held
    this.ackSent = new Array<f64>(TERM_IO_ACKS)
    this.ackSent.fill(0.0)
    this.ackHead = 0
    this.ackCount = 0
    this.readBuf = new Array<u8>(TERM_IO_READ)
    this.readBuf.fill(0)
    this.rect = new PixelRect(0, 0, 0, 0, 0, 0, 0.0)
    this.rectCols = -1
    this.rectRows = -1
    this.rectBackend = -1
    this.rectWidth = -1
    this.rectHeight = -1
    this.pixelsShown = false
    this.graphics = termIoGraphics(caps.graphics)
    this.backend = this.graphics
    this.cellWidthPx = termIoCellPx(caps.cellWidthPx)
    this.cellHeightPx = termIoCellPx(caps.cellHeightPx)
    this.sizeCols = cols
    this.sizeRows = rows
    this.shownCols = cols
    this.shownRows = rows
    this.lastAckMs = -1.0
    this.lastRttMs = 0.0
    this.workNs = 0.0
    this.sendStartNs = 0
    this.mouseMode = 0
    this.open = true
    this.kittyKeyboardOn = false
    this.pixelMouseOn = false
    this.pasteOn = false
    this.focusOn = false
    this.kittyImage = false
  }

  /** The bytes that undo everything turned on: what `close` writes and the runtime writes on a panic or signal. */
  restoreString(): string {
    let s: string = "\x18\x1b[?2026l"
    if (this.kittyImage) {
      s = s + kittyDelete(TERM_IO_IMAGE_ID)
    }
    if (this.kittyKeyboardOn) {
      s = s + "\x1b[<u"
    }
    if (this.mouseMode > 0) {
      s = s + (this.pixelMouseOn ? "\x1b[?1016l" : "") + `\x1b[?1006l\x1b[?${this.mouseMode}l`
    }
    if (this.pasteOn) {
      s = s + "\x1b[?2004l"
    }
    if (this.focusOn) {
      s = s + "\x1b[?1004l"
    }
    return s + resetStyle() + showCursor() + leaveAltScreen()
  }

  /** Set the runtime's restore string to `restoreString()`, then write `bytes`, which turn something on. */
  turnOn(bytes: string): void {
    setTerminalRestore(this.restoreString())
    write(bytes)
  }

  /** Turn on what the options ask for and the terminal has, the restore string kept ahead of each. */
  enable(): void {
    const o: TerminalOptions = this.options
    if (o.kittyKeyboard && this.caps.kittyKeyboard) {
      this.kittyKeyboardOn = true
      this.keys.releasesAreSynthetic = false
      this.turnOn("\x1b[>11u")
    }
    if (o.mouse === 1000 || o.mouse === 1002 || o.mouse === 1003) {
      this.mouseMode = o.mouse
      this.pixelMouseOn = this.caps.pixelMouse && this.cellWidthPx > 0 && this.cellHeightPx > 0
      this.decoder.pixelMouse = this.pixelMouseOn
      this.decoder.cellWidthPx = this.cellWidthPx
      this.decoder.cellHeightPx = this.cellHeightPx
      this.turnOn(`\x1b[?${o.mouse}h\x1b[?1006h` + (this.pixelMouseOn ? "\x1b[?1016h" : ""))
    }
    if (o.paste) {
      this.pasteOn = true
      this.turnOn("\x1b[?2004h")
    }
    if (o.focus) {
      this.focusOn = true
      this.turnOn("\x1b[?1004h")
    }
    if (this.graphics === GRAPHICS_KITTY && this.framebuffer.width > 0) {
      // Before the first frame, so a panic mid-image deletes it.
      this.kittyImage = true
      setTerminalRestore(this.restoreString())
    }
  }

  /**
   * Undo everything `openTerminal` did and leave raw mode. The
   * acknowledgements still in flight are read first, for twice the round trip
   * (the controller's or the last frame's, whichever is longer; 50 to
   * 500 ms), so the terminal's answers are not echoed after the program. A
   * second call does nothing.
   */
  close(): void {
    if (!this.open) {
      return
    }
    this.open = false
    write(this.restoreString())
    this.drainAcks()
    setTerminalRestore("")
    setRawMode(false)
  }

  /**
   * Read and drop input until every frame sent is answered, stdin ends or the
   * round trip's bound passes. Before any answer the probe's round trip is
   * the one known.
   */
  drainAcks(): void {
    let owed: i32 = this.rate.unacked() + this.rate.stale
    let rtt: f64 = this.rate.rttMs > this.lastRttMs ? this.rate.rttMs : this.lastRttMs
    rtt = rtt > this.caps.probeRttMs ? rtt : this.caps.probeRttMs
    let bound: f64 = 2.0 * rtt
    bound = bound > TERM_IO_DRAIN_MIN_MS ? bound : TERM_IO_DRAIN_MIN_MS
    bound = bound < TERM_IO_DRAIN_MAX_MS ? bound : TERM_IO_DRAIN_MAX_MS
    const deadline: f64 = termIoNowMs() + bound
    let ended: boolean = false
    while (owed > 0 && !ended) {
      const left: i32 = toI32(Math.ceil(deadline - termIoNowMs()))
      if (left <= 0 || !waitStdin(left)) {
        return
      }
      const n: i32 = readStdin(this.readBuf, 0, TERM_IO_READ)
      if (n > 0) {
        const only: i32 = this.decoder.waiting() ? -1 : termIoOnlyAcks(this.readBuf, n)
        if (only > 0) {
          owed = owed - only
        } else {
          for (const e of this.decoder.feedEvents(this.readBuf, n, termIoNowMs())) {
            if (termIoIsAck(e)) {
              owed = owed - 1
            }
          }
        }
      } else if (n !== -11) {
        ended = true
      }
    }
  }

  /** What the controller measured, with the backend the last frame actually used. */
  stats(): TermStats {
    const s: TermStats = this.rate.stats()
    s.backend = this.backend
    return s
  }

  /** Read `terminalSize` into `sizeCols` and `sizeRows`; its array dies here. */
  readSize(): void {
    const size: i32[] = terminalSize()
    if (toI32(size.length) >= 2 && size[0] > 0 && size[1] > 0) {
      this.sizeCols = size[0]
      this.sizeRows = size[1]
    }
  }

  /**
   * Whether the terminal changed size since the last call; if it did, the
   * `Screen` takes the new size and the framebuffer is fitted again. It
   * compares the size the terminal answers, not the `Screen`'s, which clamps
   * a huge one, so a huge terminal is not resized every frame.
   */
  checkResize(): boolean {
    this.readSize()
    if (this.sizeCols === this.shownCols && this.sizeRows === this.shownRows) {
      return false
    }
    this.shownCols = this.sizeCols
    this.shownRows = this.sizeRows
    this.screen.resize(this.sizeCols, this.sizeRows)
    this.canvas = new Canvas(this.screen)
    this.screen.invalidate()
    this.rectCols = -1
    return true
  }

  /** Forget the send times of the frames the controller gave up on, oldest first, so the ring holds only frames it still waits for. */
  dropLost(): void {
    while (this.ackCount > this.rate.unacked()) {
      this.ackHead = (this.ackHead + 1) % TERM_IO_ACKS
      this.ackCount = this.ackCount - 1
    }
  }

  /** Remember that a frame acknowledgement was asked for at `nowMs`. */
  ackPush(nowMs: f64): void {
    if (this.ackCount === TERM_IO_ACKS) {
      this.ackHead = (this.ackHead + 1) % TERM_IO_ACKS
      this.ackCount = this.ackCount - 1
    }
    this.ackSent[(this.ackHead + this.ackCount) % TERM_IO_ACKS] = nowMs
    this.ackCount = this.ackCount + 1
  }

  /**
   * `count` acknowledgements arrived at `nowMs`: each answers the controller
   * and, unless it is the late answer of a frame the controller gave up on,
   * marks its frame's send time delivered.
   */
  acked(count: i32, nowMs: f64): void {
    for (let k: i32 = 0; k < count; k++) {
      this.dropLost()
      if (this.rate.stale === 0 && this.ackCount > 0) {
        this.keys.delivered(this.ackSent[this.ackHead])
        this.lastRttMs = nowMs - this.ackSent[this.ackHead]
        this.ackHead = (this.ackHead + 1) % TERM_IO_ACKS
        this.ackCount = this.ackCount - 1
      }
      this.rate.ackReceived(nowMs)
    }
    if (count > 0) {
      this.lastAckMs = nowMs
    }
  }

  /** A reply other than an acknowledgement, which came after the probe: learn the cell size from it if the probe did not. */
  lateReply(e: TermEvent): void {
    if (
      this.cellWidthPx > 0 ||
      e.introducer !== 91 ||
      e.prefix !== 0 ||
      e.intermediate !== 0 ||
      e.reply !== 116
    ) {
      return
    }
    let w: i32 = 0
    let h: i32 = 0
    if (termIoParam(e, 0) === 6) {
      h = termIoParam(e, 1)
      w = termIoParam(e, 2)
    } else if (termIoParam(e, 0) === 4 && this.sizeCols > 0 && this.sizeRows > 0) {
      h = (termIoParam(e, 1) / this.sizeRows) | 0
      w = (termIoParam(e, 2) / this.sizeCols) | 0
    }
    if (termIoCellPx(w) > 0 && termIoCellPx(h) > 0) {
      this.cellWidthPx = termIoCellPx(w)
      this.cellHeightPx = termIoCellPx(h)
      this.caps.cellWidthPx = this.cellWidthPx
      this.caps.cellHeightPx = this.cellHeightPx
      this.decoder.cellWidthPx = this.cellWidthPx
      this.decoder.cellHeightPx = this.cellHeightPx
      this.rectCols = -1
      // Pixel mouse waited on the cell size; the mouse is on, so add it.
      if (this.mouseMode > 0 && this.caps.pixelMouse && !this.pixelMouseOn) {
        this.pixelMouseOn = true
        this.decoder.pixelMouse = true
        this.turnOn("\x1b[?1016h")
      }
    }
  }

  /**
   * Take decoded `events`, read at `nowMs`: the program's go through
   * `KeyState` into `out`, then the acknowledgements count. Every reply is
   * the terminal's and is taken here, a late cell size learned.
   */
  take(events: TermEvent[], nowMs: f64, out: TermEvent[]): void {
    let replies: i32 = 0
    for (const e of events) {
      if (e.type === EVENT_REPLY) {
        replies = replies + 1
      }
    }
    let program: TermEvent[] = events
    let acks: i32 = 0
    if (replies > 0) {
      program = []
      for (const e of events) {
        if (e.type !== EVENT_REPLY) {
          program.push(e)
        } else if (termIoIsAck(e)) {
          acks = acks + 1
        } else {
          this.lateReply(e)
        }
      }
    }
    for (const e of this.keys.apply(program, nowMs)) {
      out.push(e)
    }
    this.acked(acks, nowMs)
  }

  /**
   * Wait up to `waitMs` milliseconds (a negative wait has no limit) for input,
   * and append what it means for the program to `out`: keys, mouse, paste and
   * focus events, the releases made up from silence, `EVENT_QUIT` for Ctrl-C.
   * Frame acknowledgements are taken here and never appended. Answers false
   * once stdin has ended.
   */
  readEvents(waitMs: i32, out: TermEvent[]): boolean {
    if (toI32(this.held.length) > 0) {
      const held: TermEvent[] = this.held
      this.held = []
      this.take(held, termIoNowMs(), out)
    }
    let ended: boolean = false
    let decoded: boolean = false
    if (waitStdin(waitMs)) {
      const n: i32 = readStdin(this.readBuf, 0, TERM_IO_READ)
      const nowMs: f64 = termIoNowMs()
      const only: i32 = this.decoder.waiting() ? -1 : termIoOnlyAcks(this.readBuf, n)
      if (only > 0) {
        this.acked(only, nowMs)
      } else if (n > 0) {
        this.take(this.decoder.feedEvents(this.readBuf, n, nowMs), nowMs, out)
        decoded = true
      } else if (n !== -11) {
        ended = true
      }
    }
    const nowMs: f64 = termIoNowMs()
    if (this.decoder.waiting()) {
      const late: TermEvent[] = this.decoder.pollEvents(nowMs)
      if (toI32(late.length) > 0) {
        this.take(late, nowMs, out)
        decoded = true
      }
    }
    if (!decoded && toI32(this.keys.downKeys.length) > 0) {
      for (const e of this.keys.tick(nowMs)) {
        out.push(e)
      }
    }
    if (this.keys.watermarked && nowMs - this.lastAckMs > TERM_IO_WATERMARK_MS) {
      // Answers stopped (no frames lately): measure silence against the clock again.
      this.keys.watermarked = false
    }
    return !ended
  }

  /** Fit the framebuffer to the screen for `backend`, unless the sizes and backend are those of the last fit. */
  fit(backend: i32): void {
    const fb: Framebuffer = this.framebuffer
    if (
      this.rectCols === this.screen.width &&
      this.rectRows === this.screen.height &&
      this.rectBackend === backend &&
      this.rectWidth === fb.width &&
      this.rectHeight === fb.height
    ) {
      return
    }
    this.rectCols = this.screen.width
    this.rectRows = this.screen.height
    this.rectBackend = backend
    this.rectWidth = fb.width
    this.rectHeight = fb.height
    this.rect = fitFramebuffer(
      fb.width,
      fb.height,
      this.screen.width,
      this.screen.height,
      this.cellWidthPx,
      this.cellHeightPx,
      backend
    )
  }

  /**
   * Write one frame as a single write: the screen's changes, then the pixels'
   * bytes when `withPixels`, wrapped in synchronized output when the terminal
   * has it, then the DSR 5 query that acknowledges it. Records when the write
   * began in `sendStartNs` and answers the bytes written. Its strings die
   * here, so a frame loop does not keep them.
   */
  send(withPixels: boolean): i32 {
    const body: string = this.screen.flush()
    const image: string = withPixels ? this.pixels.text() : ""
    const frame: string = this.caps.sync
      ? `${beginSync()}${body}${image}${endSync()}\x1b[5n`
      : `${body}${image}\x1b[5n`
    this.sendStartNs = monotonicNanos()
    write(frame)
    return toI32(frame.length)
  }

  /**
   * Send a frame: the framebuffer, if any, drawn with the backend the
   * terminal and the controller allow, the stats overlay if the options ask
   * for it, and the screen's changes, as one write followed by the query that
   * acknowledges it. Its cost to the controller is `workNs` and the encoding,
   * and its send time is when the write began. A closed terminal is not
   * written to.
   */
  present(): void {
    if (!this.open) {
      return
    }
    const start: i64 = monotonicNanos()
    const d = this.rate.decision()
    const palette: boolean = !this.caps.trueColor || d.palette256
    if (palette !== this.palette256) {
      this.palette256 = palette
      this.screen.palette256 = palette
      this.screen.invalidate()
    }
    const backend: i32 = Math.min(this.graphics, d.backendCap)
    if (backend !== this.backend) {
      if (this.backend === GRAPHICS_KITTY && this.kittyImage) {
        write(kittyDelete(TERM_IO_IMAGE_ID))
      }
      this.screen.invalidate()
      this.backend = backend
    }
    let withPixels: boolean = false
    const fb: Framebuffer = this.framebuffer
    if (fb.width > 0) {
      this.fit(backend)
      let src: Framebuffer = fb
      if (d.resolutionDivisor > 1) {
        scaleFramebuffer(fb, d.resolutionDivisor, this.scaled)
        src = this.scaled
      }
      if (backend === GRAPHICS_KITTY) {
        this.pixels.reset()
        kittyFrame(src, this.rect, TERM_IO_IMAGE_ID, this.pixels)
        withPixels = true
      } else if (backend === GRAPHICS_SIXEL) {
        this.pixels.reset()
        sixelFrame(src, this.rect, true, this.pixels)
        withPixels = true
      } else if (backend === GRAPHICS_HALFBLOCK) {
        drawHalfBlocks(src, this.canvas, this.rect)
      } else {
        drawAscii(src, this.screen, this.rect, this.caps.colors)
      }
    } else if (this.pixelsShown) {
      // The framebuffer was emptied: take the last image off, which the screen's cells do not cover.
      if (backend === GRAPHICS_KITTY && this.kittyImage) {
        write(kittyDelete(TERM_IO_IMAGE_ID))
      }
      this.screen.invalidate()
    }
    this.pixelsShown = withPixels
    if (this.options.overlay >= 0) {
      drawStatsOverlay(this.screen, this.stats(), this.options.overlay)
    }
    const bytes: i32 = this.send(withPixels)
    const sentAtMs: f64 = toF64(this.sendStartNs) / 1000000.0
    this.dropLost()
    this.rate.frameSent(bytes, this.workNs + toF64(this.sendStartNs - start), sentAtMs)
    this.workNs = 0.0
    this.ackPush(sentAtMs)
  }
}

/** Refuse, with one sentence naming the descriptor, unless stdin and stdout are both a terminal. */
const termIoRefusal = (): string => {
  if (!isTerminal(0)) {
    return "stdin is not a terminal (a pipe or CI?)"
  }
  return isTerminal(1) ? "" : "stdout is not a terminal (a pipe or a file?)"
}

/**
 * Open the terminal: refuse a pipe, enter raw mode and the alternate screen,
 * hide the cursor, probe what the terminal can do and turn on what `options`
 * asks for and it has. The restore string undoes all of it should the
 * program panic or be signalled before `close`.
 */
export const openTerminal = (options: TerminalOptions): Result<Terminal, string> => {
  const refused: string = termIoRefusal()
  if (refused !== "") {
    return Err(refused)
  }
  if (setRawMode(true) !== 0) {
    return Err("the terminal refused raw mode")
  }
  const env: TermEnv = termIoEnv(options.graphics)
  const size: i32[] = terminalSize()
  const sized: boolean = toI32(size.length) >= 2 && size[0] > 0 && size[1] > 0
  const cols: i32 = sized ? size[0] : TERM_IO_COLS
  const rows: i32 = sized ? size[1] : TERM_IO_ROWS
  setTerminalRestore(resetStyle() + showCursor() + leaveAltScreen())
  write(enterAltScreen() + hideCursor() + probeQueries(env))
  const probe: TermProbe = new TermProbe(env, cols, rows, termIoNowMs())
  const buf: u8[] = new Array<u8>(TERM_IO_READ)
  buf.fill(0)
  let finished: boolean = false
  while (!finished && !probe.done()) {
    const nowMs: f64 = termIoNowMs()
    if (probe.timedOut(nowMs)) {
      finished = true
      continue
    }
    const left: i32 = toI32(Math.ceil(probe.sentAtMs + probe.timeoutMs - nowMs))
    if (waitStdin(left > 0 ? left : 0)) {
      const n: i32 = readStdin(buf, 0, TERM_IO_READ)
      if (n > 0) {
        probe.feed(buf, n, termIoNowMs())
      } else if (n !== -11) {
        probe.finish(termIoNowMs())
        finished = true
      }
    }
  }
  if (!finished) {
    probe.finish(termIoNowMs())
  }
  const term: Terminal = new Terminal(options, probe.result(), cols, rows, probe.heldEvents())
  term.enable()
  return Ok(term)
}

/** What one `update` step gets: the events since the last step and which keys are down. */
export class TermInput {
  events: TermEvent[]
  keys: KeyState

  constructor(keys: KeyState) {
    this.events = []
    this.keys = keys
  }

  /** Whether the key of kind `key` (a `KEY_*`; `code` for `KEY_CHAR`) is down. */
  isDown(key: i32, code: i32): boolean {
    return this.keys.isDown(key, code)
  }
}

/** What `render` draws into: the cells, the pixels, how far into the next step the clock is, and the stats. */
export class Frame {
  screen: Screen
  framebuffer: Framebuffer
  /** From 0 up to 1: how far past the last `update` step this frame is, to interpolate with. */
  alpha: f64
  stats: TermStats
  caps: TermCaps

  constructor(term: Terminal) {
    this.screen = term.screen
    this.framebuffer = term.framebuffer
    this.alpha = 0.0
    this.stats = term.stats()
    this.caps = term.caps
  }
}

/** Empty `events` keeping its storage. */
const termIoClear = (events: TermEvent[]): void => {
  while (toI32(events.length) > 0) {
    events.pop()
  }
}

/** Whether `events` holds `EVENT_QUIT`. */
const termIoQuits = (events: TermEvent[]): boolean => {
  for (const e of events) {
    if (e.type === EVENT_QUIT) {
      return true
    }
  }
  return false
}

/** The time `step` next steps, on the clock its `advance` was given. */
const termIoDue = (step: FixedStep): f64 => step.lastMs + step.stepMs - step.carry

/** How long the loop may wait at `nowMs`: until the next step or frame is due, and no longer than an unfinished escape may be held. */
const termIoWait = (term: Terminal, step: FixedStep, nowMs: f64): i32 => {
  let due: f64 = termIoDue(step)
  const pacer: FixedStep = term.rate.pacer
  if (pacer.started) {
    const frame: f64 = termIoDue(pacer)
    due = frame < due ? frame : due
  }
  let wait: f64 = due - nowMs
  if (term.decoder.waiting() && wait > TERM_IO_ESCAPE_MS) {
    wait = TERM_IO_ESCAPE_MS
  }
  if (!(wait > 0.0)) {
    return 0
  }
  return toI32(Math.ceil(wait))
}

/**
 * Open the terminal and run the program: `update(state, input)` once per
 * fixed step (`options.stepsPerSecond`), the events since the last step in
 * `input.events`, and `render(state, frame)` whenever the controller allows a
 * frame, which is then presented. A resize is an `EVENT_RESIZE` (`x` the new
 * columns, `y` the rows) with the `Screen` already resized. The loop ends when
 * `update` answers false or the user quits (`EVENT_QUIT`), answering `Ok(0)`,
 * and the terminal is closed however it ends. An `Err` is a terminal that
 * could not be opened, or stdin ending.
 */
export const runTerminal = <G>(
  options: TerminalOptions,
  state: G,
  update: (g: G, input: TermInput) => boolean,
  render: (g: G, frame: Frame) => void
): Result<i32, string> => {
  const opened: Result<Terminal, string> = openTerminal(options)
  if (!opened.isOk()) {
    return Err(opened.error)
  }
  const term: Terminal = opened.value
  const input: TermInput = new TermInput(term.keys)
  const frame: Frame = new Frame(term)
  const step: FixedStep = new FixedStep(options.stepsPerSecond, 5)
  step.advance(termIoNowMs())
  let ended: boolean = false
  let quit: boolean = false
  while (!quit && !ended) {
    ended = !term.readEvents(termIoWait(term, step, termIoNowMs()), input.events)
    if (termIoQuits(input.events)) {
      quit = true
      continue
    }
    const nowMs: f64 = termIoNowMs()
    term.rate.tick(nowMs)
    const draw: boolean = term.rate.mayDraw(nowMs)
    if (draw && term.checkResize()) {
      const e: TermEvent = new TermEvent(EVENT_RESIZE)
      e.x = term.screen.width
      e.y = term.screen.height
      input.events.push(e)
    }
    const steps: i32 = step.advance(nowMs)
    const work: i64 = monotonicNanos()
    for (let k: i32 = 0; k < steps && !quit; k++) {
      quit = !update(state, input)
      termIoClear(input.events)
    }
    if (draw && !quit) {
      frame.alpha = step.alpha()
      frame.stats = term.stats()
      frame.framebuffer = term.framebuffer
      render(state, frame)
    }
    term.workNs = term.workNs + toF64(monotonicNanos() - work)
    if (draw && !quit) {
      term.present()
    }
  }
  term.close()
  if (ended && !quit) {
    return Err("stdin ended")
  }
  return Ok(toI32(0))
}
