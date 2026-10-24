/**
 * `std/term-probe` — what the terminal a program runs in can do (its colours,
 * keyboard protocol, graphics and size), asked of it once at start and read
 * from its answer.
 *
 * A program writes `probeQueries(env)` in one write, then feeds what the
 * terminal sends back to a `TermProbe` until `done()` (the terminal answered
 * the last query) or `timedOut(now)`, and reads the `TermCaps` from `result()`.
 * The module is pure: the environment comes in as a `TermEnv`, times are the
 * caller's milliseconds as `f64` from any origin, and nothing here reads,
 * writes or waits.
 *
 * ```ts
 * import { TermEnv, TermProbe, probeQueries } from "nish/term-probe";
 *
 * const env: TermEnv = new TermEnv();
 * env.term = "xterm-256color";
 * const probe: TermProbe = new TermProbe(env, 80, 24, 0.0);
 * const queries: string = probeQueries(env); // write these to the terminal
 * // …feed each read: probe.feed(bytes, count, nowMs), until probe.done() or probe.timedOut(nowMs)
 * console.log(`${probe.result().colors}`);
 * ```
 *
 * - `TermEnv` — the environment variables the probe reads, each "" when
 *   unset, one field each in camelCase: `term` (`TERM`), `colorterm`
 *   (`COLORTERM`), `termProgram` (`TERM_PROGRAM`), `tmux` (`TMUX`), `sty`
 *   (`STY`), `sshConnection`, `sshClient` and `sshTty` (`SSH_CONNECTION`,
 *   `SSH_CLIENT`, `SSH_TTY`), `noColor` (`NO_COLOR`), `nishTermGraphics`
 *   (`NISH_TERM_GRAPHICS`) and `nishTermFps` (`NISH_TERM_FPS`, which the probe
 *   carries for the renderer and does not read).
 * - `probeQueries(env)` — every query, in this order, as one string:
 *   XTVERSION `CSI > q`, DECRQM for synchronized output `CSI ? 2026 $ p` and
 *   pixel mouse `CSI ? 1016 $ p`, kitty's keyboard flags `CSI ? u`, a kitty
 *   graphics query `APC G i=31,s=1,v=1,a=q,t=d,f=24;AAAA ST`, XTSMGRAPHICS
 *   for the sixel colour registers `CSI ? 1 ; 1 ; 0 S`, the cell size
 *   `CSI 16 t`, the text area size `CSI 14 t`, a true-colour background set
 *   and read back with DECRQSS (`CSI 48 ; 2 ; 1 ; 2 ; 3 m`, `DCS $ q m ST`,
 *   `CSI m`), and DA1 `CSI c` last. Terminals answer in order, so the answer
 *   to DA1, which every terminal gives, means the rest are in. Under tmux
 *   (`TMUX` set) the queries only the outer terminal can answer — kitty
 *   graphics and the two sizes — go inside tmux's passthrough,
 *   `DCS tmux; … ST` with each ESC doubled; under GNU screen (`STY` set) the
 *   sizes go inside screen's `DCS … ST`, and the kitty graphics query and
 *   DECRQSS, which hold an ST of their own and which screen would forward
 *   rather than answer, are left out. DA1 is never wrapped: the multiplexer
 *   answers it, so a multiplexer that forwards no reply still ends the probe.
 * - `TermProbe` — the probe in progress, made when the queries are sent.
 *   `feed(bytes, count, nowMs)` decodes a read through its own `KeyDecoder`
 *   (`nish/term`), keeping the replies and holding back every other event (a
 *   key typed while the probe ran) for `heldEvents()`, in order. `done()` is
 *   true once DA1 is answered; `timedOut(nowMs)` once `timeoutMs` (250 by
 *   default) has passed since the send with no answer to DA1, when it also
 *   gives up whatever the decoder still holds. `rttMs()` is the time from the
 *   send to the answer to DA1, -1 before it. `result()` reads the replies and
 *   the environment into a `TermCaps`, and can be called at any point.
 * - `TermCaps` — what the terminal can do: `colors` (16, 256 or 16777216),
 *   `trueColor`, `sync`, `kittyKeyboard`, `kittyGraphics`, `sixel`,
 *   `sixelRegisters`, `cellWidthPx` and `cellHeightPx`, `pixelMouse`,
 *   `multiplexer` ("none", "tmux" or "screen"), `linuxConsole`, `remoteHint`,
 *   `answered`, `probeRttMs`, `graphics` ("kitty", "sixel", "halfblock" or
 *   "ascii"), `name` and `overrides`; each field's comment says where it
 *   comes from.
 *
 * The environment decides where the terminal cannot answer, and where the
 * user says so: `COLORTERM=truecolor` or `24bit` means true colour, as does
 * a DECRQSS that reads the 24-bit background back; otherwise a `TERM` with
 * `256color` in it means 256 colours, and anything else 16. `TERM=linux` is
 * the Linux console: 16 colours, ASCII graphics, no kitty keyboard and no
 * synchronized output, whatever it answered. `NO_COLOR` set to anything
 * (no-color.org) means 16 colours and touches nothing but colour.
 * `NISH_TERM_GRAPHICS` names a graphics backend to use instead of the one the
 * answers pick; a pixel backend the terminal did not answer for is refused
 * when it would come out as garbage or nothing — on the Linux console, under
 * a multiplexer, or when the terminal answered nothing at all. `overrides`
 * says what each variable did, refusals included.
 */
import { EVENT_REPLY, KeyDecoder, TermEvent } from "nish/term"
import { replaceAll } from "nish/text"

/** How long a probe waits for the answer to DA1 by default, in milliseconds. */
export const TERM_PROBE_TIMEOUT_MS: f64 = 250.0

/** How long the probe's decoder holds an unfinished sequence, in milliseconds. */
const TERM_PROBE_ESCAPE_MS: f64 = 50.0

/** The colour count of a terminal with 24-bit colour. */
const TERM_PROBE_TRUE_COLORS: i32 = 16777216

/** The environment the probe reads, each variable "" when unset. */
export class TermEnv {
  /** `TERM`: the terminal type, such as `xterm-256color` or `linux`. */
  term: string
  /** `COLORTERM`: `truecolor` or `24bit` where the terminal has 24-bit colour. */
  colorterm: string
  /** `TERM_PROGRAM`: the terminal's name where it sets one, such as `iTerm.app` or `Apple_Terminal`. */
  termProgram: string
  /** `TMUX`: set inside tmux. */
  tmux: string
  /** `STY`: set inside GNU screen. */
  sty: string
  /** `SSH_CONNECTION`: set by sshd for a remote session. */
  sshConnection: string
  /** `SSH_CLIENT`: set by sshd for a remote session. */
  sshClient: string
  /** `SSH_TTY`: set by sshd for a remote session with a terminal. */
  sshTty: string
  /** `NO_COLOR`: set to anything to ask for no colour (no-color.org). */
  noColor: string
  /** `NISH_TERM_GRAPHICS`: a graphics backend to use instead of the probed one, `kitty`, `sixel`, `halfblock` or `ascii`. */
  nishTermGraphics: string
  /** `NISH_TERM_FPS`: a frame rate for the renderer; carried, not read, by the probe. */
  nishTermFps: string

  /** An environment with every variable unset. */
  constructor() {
    this.term = ""
    this.colorterm = ""
    this.termProgram = ""
    this.tmux = ""
    this.sty = ""
    this.sshConnection = ""
    this.sshClient = ""
    this.sshTty = ""
    this.noColor = ""
    this.nishTermGraphics = ""
    this.nishTermFps = ""
  }
}

/** What a terminal can do, from its answers to `probeQueries` and the environment. */
export class TermCaps {
  /** The multiplexer in between: "none", "tmux" (`TMUX` set) or "screen" (`STY` set). */
  multiplexer: string
  /** The time from the send to the answer to DA1, in milliseconds; -1 unanswered. */
  probeRttMs: f64
  /** The graphics backend to draw with, best first — "kitty", "sixel" (256 registers or more), "halfblock", "ascii" — after `NISH_TERM_GRAPHICS`. */
  graphics: string
  /** The terminal's name and version from XTVERSION, else `TERM_PROGRAM`, else "". */
  name: string
  /** What the environment forced, one `VARIABLE: effect` per entry joined by `; `; "" when nothing. */
  overrides: string
  /** How many colours to draw with: 16, 256 or 16777216. */
  colors: i32
  /** How many sixel colour registers there are, from XTSMGRAPHICS; 0 unanswered. */
  sixelRegisters: i32
  /** A cell's width in pixels: `CSI 16 t`, else the text area's from `CSI 14 t` over the columns; 0 unknown. */
  cellWidthPx: i32
  /** A cell's height in pixels: `CSI 16 t`, else the text area's from `CSI 14 t` over the rows; 0 unknown. */
  cellHeightPx: i32
  /** Whether 24-bit colour works: `COLORTERM`, or the background DECRQSS read back. */
  trueColor: boolean
  /** Whether synchronized output (mode 2026) is known: DECRPM answered set or reset. */
  sync: boolean
  /** Whether the kitty keyboard protocol is there: `CSI ? flags u` answered. */
  kittyKeyboard: boolean
  /** Whether kitty graphics are there: the query answered `OK`. */
  kittyGraphics: boolean
  /** Whether sixel is there: DA1 lists 4. */
  sixel: boolean
  /** Whether SGR mouse reports in pixels (mode 1016) are known: DECRPM answered set or reset. */
  pixelMouse: boolean
  /** Whether this is the Linux console (`TERM=linux`). */
  linuxConsole: boolean
  /** Whether the session looks remote (`SSH_CONNECTION`, `SSH_CLIENT` or `SSH_TTY` set), so slow. */
  remoteHint: boolean
  /** Whether the terminal answered DA1; false when the probe timed out. */
  answered: boolean

  /** Caps of a terminal that answered nothing: 16 colours, ASCII. */
  constructor() {
    this.colors = 16
    this.trueColor = false
    this.sync = false
    this.kittyKeyboard = false
    this.kittyGraphics = false
    this.sixel = false
    this.sixelRegisters = 0
    this.cellWidthPx = 0
    this.cellHeightPx = 0
    this.pixelMouse = false
    this.multiplexer = "none"
    this.linuxConsole = false
    this.remoteHint = false
    this.answered = false
    this.probeRttMs = -1.0
    this.graphics = "ascii"
    this.name = ""
    this.overrides = ""
  }
}

/** The multiplexer `env` says the program runs under: "tmux", "screen" or "none". */
const termMultiplexer = (env: TermEnv): string => {
  if (env.tmux !== "") {
    return "tmux"
  }
  return env.sty !== "" ? "screen" : "none"
}

/** `query` inside the passthrough of `multiplexer`, so the outer terminal gets it: tmux's with each ESC doubled, screen's as it is. */
const termPassthrough = (multiplexer: string, query: string): string => {
  if (multiplexer === "tmux") {
    return `\x1bPtmux;${replaceAll(query, "\x1b", "\x1b\x1b")}\x1b\\`
  }
  return multiplexer === "screen" ? `\x1bP${query}\x1b\\` : query
}

/** Every query the probe asks, as one write; `TermProbe` reads the answers. */
export const probeQueries = (env: TermEnv): string => {
  const mux: string = termMultiplexer(env)
  const parts: string[] = ["\x1b[>q", "\x1b[?2026$p", "\x1b[?1016$p", "\x1b[?u"]
  if (mux !== "screen") {
    parts.push(termPassthrough(mux, "\x1b_Gi=31,s=1,v=1,a=q,t=d,f=24;AAAA\x1b\\"))
  }
  parts.push("\x1b[?1;1;0S")
  parts.push(termPassthrough(mux, "\x1b[16t"))
  parts.push(termPassthrough(mux, "\x1b[14t"))
  if (mux !== "screen") {
    parts.push("\x1b[48;2;1;2;3m\x1bP$qm\x1b\\\x1b[m")
  }
  parts.push("\x1b[c")
  return parts.join("")
}

/** Whether `e` is the reply opened by `introducer`, with private marker `prefix`, intermediate `intermediate` and final `final`. */
const termIsReply = (e: TermEvent, introducer: i32, prefix: i32, intermediate: i32, final: i32): boolean =>
  e.type === EVENT_REPLY &&
  e.introducer === introducer &&
  e.prefix === prefix &&
  e.intermediate === intermediate &&
  e.reply === final

/** Parameter `k` of `e`, or -1 when it has fewer. */
const termParam = (e: TermEvent, k: i32): i32 => (k < toI32(e.params.length) ? e.params[k] : -1)

/** Whether a DECRPM value says the mode is known: set (1), reset (2) or permanently set (3). */
const termModeKnown = (value: i32): boolean => value >= 1 && value <= 3

/** Whether `e` has a parameter equal to `value`. */
const termHasParam = (e: TermEvent, value: i32): boolean => {
  for (const p of e.params) {
    if (p === value) {
      return true
    }
  }
  return false
}

/**
 * A probe in progress: made when `probeQueries` is written, at `sentAtMs`,
 * for a window of `cols` by `rows` cells, fed what the terminal sends.
 */
export class TermProbe {
  /** The environment the queries were made for. */
  env: TermEnv
  /** The window's width in cells, to turn `CSI 14 t` into a cell width. */
  cols: i32
  /** The window's height in cells, to turn `CSI 14 t` into a cell height. */
  rows: i32
  /** When the queries were written. */
  sentAtMs: f64
  /** How long to wait for the answer to DA1 (`TERM_PROBE_TIMEOUT_MS` by default). */
  timeoutMs: f64
  /** The decoder the terminal's bytes go through. */
  decoder: KeyDecoder
  /** The replies so far, in order. */
  replies: TermEvent[]
  /** Every other event so far, in order: what the user typed during the probe. */
  held: TermEvent[]
  /** When DA1 was answered; -1 before. */
  answeredAtMs: f64

  /** A probe whose queries were written at `sentAtMs` to a window of `cols` by `rows` cells. */
  constructor(env: TermEnv, cols: i32, rows: i32, sentAtMs: f64) {
    this.env = env
    this.cols = cols
    this.rows = rows
    this.sentAtMs = sentAtMs
    this.timeoutMs = TERM_PROBE_TIMEOUT_MS
    this.decoder = new KeyDecoder(TERM_PROBE_ESCAPE_MS)
    this.replies = []
    this.held = []
    this.answeredAtMs = -1.0
  }

  /** Take in `events`: replies kept, DA1 marking the probe done, the rest held. */
  take(events: TermEvent[], nowMs: f64): void {
    for (const e of events) {
      if (e.type !== EVENT_REPLY) {
        this.held.push(e)
        continue
      }
      this.replies.push(e)
      if (this.answeredAtMs < 0.0 && termIsReply(e, 91, 63, 0, 99)) {
        this.answeredAtMs = nowMs
      }
    }
  }

  /** Decode `bytes[0, count)`, read at `nowMs`. */
  feed(bytes: u8[], count: i32, nowMs: f64): void {
    this.take(this.decoder.feedEvents(bytes, count, nowMs), nowMs)
  }

  /** Whether DA1 has been answered, so every reply is in. */
  done(): boolean {
    return this.answeredAtMs >= 0.0
  }

  /**
   * Whether `timeoutMs` has passed since the send with DA1 unanswered. Once it
   * has, what the decoder still holds is given up (an ESC as a key, an
   * unfinished reply as nothing), so `heldEvents` is complete.
   */
  timedOut(nowMs: f64): boolean {
    if (this.done() || nowMs - this.sentAtMs < this.timeoutMs) {
      return false
    }
    this.take(this.decoder.pollEvents(nowMs + this.decoder.escapeTimeoutMs), nowMs)
    return true
  }

  /** The events that were not replies — keys typed, a paste — in the order they came, for the program to handle. */
  heldEvents(): TermEvent[] {
    return this.held
  }

  /** The time from the send to the answer to DA1, in milliseconds; -1 before it. */
  rttMs(): f64 {
    return this.done() ? this.answeredAtMs - this.sentAtMs : -1.0
  }

  /** What the terminal can do, from the replies so far and the environment. */
  result(): TermCaps {
    const env: TermEnv = this.env
    const caps: TermCaps = new TermCaps()
    const overrides: string[] = []
    let sgrRead: boolean = false
    let areaW: i32 = 0
    let areaH: i32 = 0
    for (const e of this.replies) {
      if (termIsReply(e, 91, 63, 0, 99)) {
        caps.answered = true
        caps.sixel = caps.sixel || termHasParam(e, 4)
      } else if (termIsReply(e, 80, 62, 0, 124)) {
        caps.name = e.text
      } else if (termIsReply(e, 91, 63, 36, 121) && termParam(e, 0) === 2026) {
        caps.sync = termModeKnown(termParam(e, 1))
      } else if (termIsReply(e, 91, 63, 36, 121) && termParam(e, 0) === 1016) {
        caps.pixelMouse = termModeKnown(termParam(e, 1))
      } else if (termIsReply(e, 91, 63, 0, 117)) {
        caps.kittyKeyboard = true
      } else if (termIsReply(e, 95, 0, 0, 71)) {
        caps.kittyGraphics =
          caps.kittyGraphics || (toI32(e.text.indexOf("i=31")) === 0 && toI32(e.text.indexOf(";OK")) >= 0)
      } else if (termIsReply(e, 91, 63, 0, 83) && termParam(e, 0) === 1 && termParam(e, 1) === 0) {
        caps.sixelRegisters = termParam(e, 2)
      } else if (termIsReply(e, 91, 0, 0, 116) && termParam(e, 0) === 6) {
        caps.cellHeightPx = termParam(e, 1)
        caps.cellWidthPx = termParam(e, 2)
      } else if (termIsReply(e, 91, 0, 0, 116) && termParam(e, 0) === 4) {
        areaH = termParam(e, 1)
        areaW = termParam(e, 2)
      } else if (termIsReply(e, 80, 0, 36, 114) && termParam(e, 0) === 1) {
        sgrRead = sgrRead || toI32(e.text.indexOf("48:2:")) >= 0 || toI32(e.text.indexOf("48;2;")) >= 0
      }
    }
    if (caps.cellWidthPx <= 0 && areaW > 0 && this.cols > 0 && areaH > 0 && this.rows > 0) {
      caps.cellWidthPx = (areaW / this.cols) | 0
      caps.cellHeightPx = (areaH / this.rows) | 0
    }
    if (caps.cellWidthPx <= 0 || caps.cellHeightPx <= 0) {
      caps.cellWidthPx = 0
      caps.cellHeightPx = 0
    }
    if (caps.name === "") {
      caps.name = env.termProgram
    }
    caps.multiplexer = termMultiplexer(env)
    caps.linuxConsole = env.term === "linux"
    caps.remoteHint = env.sshConnection !== "" || env.sshClient !== "" || env.sshTty !== ""
    caps.probeRttMs = this.rttMs()

    const colorterm: boolean = env.colorterm === "truecolor" || env.colorterm === "24bit"
    caps.trueColor = colorterm || sgrRead
    if (colorterm && !sgrRead) {
      overrides.push(`COLORTERM=${env.colorterm}: true colour`)
    }
    if (caps.trueColor) {
      caps.colors = TERM_PROBE_TRUE_COLORS
    } else if (toI32(env.term.indexOf("256color")) >= 0) {
      caps.colors = 256
    }
    if (caps.linuxConsole) {
      caps.colors = 16
      caps.trueColor = false
      caps.kittyKeyboard = false
      caps.sync = false
      overrides.push("TERM=linux: 16 colours, ascii, no kitty keyboard, no sync")
    }
    if (env.noColor !== "") {
      caps.colors = 16
      caps.trueColor = false
      overrides.push("NO_COLOR: 16 colours")
    }

    if (caps.linuxConsole) {
      caps.graphics = "ascii"
    } else if (caps.kittyGraphics) {
      caps.graphics = "kitty"
    } else if (caps.sixel && caps.sixelRegisters >= 256) {
      caps.graphics = "sixel"
    } else if (env.term !== "dumb") {
      caps.graphics = "halfblock"
    }
    const forced: string = env.nishTermGraphics
    if (forced === "halfblock" || forced === "ascii") {
      caps.graphics = forced
      overrides.push(`NISH_TERM_GRAPHICS=${forced}: ${forced}`)
    } else if (forced === "kitty" || forced === "sixel") {
      const answeredFor: boolean = forced === "kitty" ? caps.kittyGraphics : caps.sixel
      if (answeredFor || (caps.answered && !caps.linuxConsole && caps.multiplexer === "none")) {
        caps.graphics = forced
        overrides.push(`NISH_TERM_GRAPHICS=${forced}: ${forced}`)
      } else {
        overrides.push(`NISH_TERM_GRAPHICS=${forced}: refused, the terminal did not answer for it`)
      }
    } else if (forced !== "") {
      overrides.push(`NISH_TERM_GRAPHICS=${forced}: ignored, not kitty, sixel, halfblock or ascii`)
    }
    caps.overrides = overrides.join("; ")
    return caps
  }
}
