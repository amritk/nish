// The game behind the docs hero terminal, as a page runs it: the terminal
// game's director and scenes (src/break-director.ts), stepped and drawn over
// nish/host/game instead of a terminal. break.mjs is the page side, and
// build.mjs builds both into docs/site/break/.
//
// The director is an object graph, and a page calls this module once a step
// and once a frame: it lives in root storage (ROOT), which the module keeps
// between calls. The page and the module also share BREAK_LINK, a few words
// for what a page has and a terminal does not: settings kept in localStorage,
// closing the overlay when the game quits, and a phone's touch: a finger held
// on the screen, a tap, the overlay's menu button, and a portrait screen, on
// which the frame is drawn turned a quarter so the phone is held sideways.
import {
  GAME_FRAME,
  GAME_MAX_HEIGHT,
  GAME_MAX_WIDTH,
  gamePlaySound,
  gameReadInput,
  gameSetSize,
  gameWriteSamples,
} from "nish/host/game"
import { StepInput } from "nish/input"
import { ACTION_PRESS, EVENT_KEY, KEY_ESCAPE, KEY_SPACE, KeyState, TermEvent } from "nish/term"
import { Framebuffer } from "nish/term-pixels"
import { TermStats } from "nish/term-rate"
import {
  BreakDirector,
  SCENE_INTRO,
  SCENE_MENU,
  adaptBreakResolution,
  aimBreakDirector,
  drawBreakDirector,
  sizeBreakFramebuffer,
  stepBreakDirector,
  tapBreakDirector,
} from "../../src/break-director"
import { SOUND_COUNT } from "../../src/break-game"
import { BreakSettings, SCREEN_TITLE } from "../../src/break-menu"
import { SAMPLE_RATE, SOUND_HELLO, voiceSamples } from "../../src/break-voices"
import { BREAK_HELP } from "./help"

/** A frame time to start from, until frames are timed: 60 Hz, in milliseconds. */
const FIRST_FRAME_MS: f64 = 1000.0 / 60.0

/** BREAK_LINK's words; break.mjs reads and writes the same ones. */
const LINK_QUIT: i32 = 0
const LINK_SAVES: i32 = 1
const LINK_SETTINGS: i32 = 2
const LINK_LOADED: i32 = 9
const LINK_AIM: i32 = 10
const LINK_AIM_Y: i32 = 11
const LINK_TAPS: i32 = 12
const LINK_TAP_X: i32 = 13
const LINK_TAP_Y: i32 = 14
const LINK_MENU: i32 = 15
const LINK_TOUCH: i32 = 16

/**
 * The words the page and the module share: [0] set when the game quits, [1]
 * counted up each time the settings are to be kept, [2..8] the settings in
 * BreakSettings' field order, [9] set by the page when [2..8] hold saved ones.
 * The page writes the rest: [10] the frame column of a finger held on the
 * screen, plus 1 (0 while none is), and [11] its row, [12] counted up for each
 * tap, at the frame pixel [13], [14], [15] counted up for each press of its
 * menu button, and [16] set while the screen is touched rather than pointed
 * at, which lets a portrait screen turn the frame. Frame pixels are the frame
 * as last shown.
 */
export const BREAK_LINK = new Int32Array(17)

/**
 * The canvas's size in CSS pixels, [0] wide and [1] high, as the page last
 * told `resize`; 0 by 0 until it does.
 */
const BOX = new Int32Array(2)

/** How many words BREAK_HELP_IN holds: its length, then that many UTF-8 bytes. */
const HELP_IN_WORDS: i32 = 8192

/**
 * A help to break apart in place of BREAK_HELP, written before init: [0] its
 * length in UTF-8 bytes (0, the default, for BREAK_HELP), then one byte a word.
 * The page writes none; a test hands in break_core_wasm's, to match its frames.
 */
export const BREAK_HELP_IN = new Int32Array(HELP_IN_WORDS)

/** Everything a run keeps between calls: the director and what its host feeds it. */
class BreakPage {
  /** The game. */
  director: BreakDirector
  /** The held keys and this step's events, kept from step to step. */
  input: StepInput
  /** The image the director draws, copied into GAME_FRAME. */
  fb: Framebuffer
  /** What the stats overlay shows, and the rate auto resolution reads. */
  stats: TermStats
  /** The page's clock, the frames' times added up, in nanoseconds. */
  clockNs: i64
  /** The frame time, smoothed, in milliseconds. */
  frameMs: f64
  /** BREAK_LINK's tap and menu-button counts as last acted on. */
  taps: i32
  menus: i32
  /** Whether the frame last shown was turned a quarter: `fb` sideways, its top on the right. */
  turned: boolean

  constructor(director: BreakDirector) {
    this.director = director
    this.input = new StepInput(new KeyState())
    this.fb = new Framebuffer(1, 1)
    this.stats = new TermStats()
    this.clockNs = toI64(0)
    this.frameMs = FIRST_FRAME_MS
    this.taps = BREAK_LINK[LINK_TAPS]
    this.menus = BREAK_LINK[LINK_MENU]
    this.turned = false
  }
}

/** The run, kept between calls; null before init. */
const ROOT = new Array<BreakPage | null>(1)

/** The settings the page saved, from BREAK_LINK, or the defaults when it has none. */
const linkedSettings = (): BreakSettings => {
  const s = new BreakSettings()
  if (BREAK_LINK[LINK_LOADED] !== 1) {
    return s
  }
  s.fps = BREAK_LINK[LINK_SETTINGS]
  s.resolution = BREAK_LINK[LINK_SETTINGS + 1]
  s.graphics = BREAK_LINK[LINK_SETTINGS + 2]
  s.effects = BREAK_LINK[LINK_SETTINGS + 3]
  s.smoothing = BREAK_LINK[LINK_SETTINGS + 4] !== 0
  s.stats = BREAK_LINK[LINK_SETTINGS + 5] !== 0
  s.sound = BREAK_LINK[LINK_SETTINGS + 6] !== 0
  return s
}

/** Hand `s` to the page to keep, and count the save so it sees one. */
const keepSettings = (s: BreakSettings): void => {
  BREAK_LINK[LINK_SETTINGS] = s.fps
  BREAK_LINK[LINK_SETTINGS + 1] = s.resolution
  BREAK_LINK[LINK_SETTINGS + 2] = s.graphics
  BREAK_LINK[LINK_SETTINGS + 3] = s.effects
  BREAK_LINK[LINK_SETTINGS + 4] = s.smoothing ? 1 : 0
  BREAK_LINK[LINK_SETTINGS + 5] = s.stats ? 1 : 0
  BREAK_LINK[LINK_SETTINGS + 6] = s.sound ? 1 : 0
  BREAK_LINK[LINK_SAVES] = BREAK_LINK[LINK_SAVES] + 1
}

/** The help the intro breaks apart: BREAK_HELP_IN's when it holds one, else the compiler's. */
const startHelp = (): string => {
  const n: i32 = BREAK_HELP_IN[0]
  if (n <= 0 || n >= HELP_IN_WORDS) {
    return BREAK_HELP
  }
  const bytes: u8[] = []
  for (let i: i32 = 1; i <= n; i++) {
    bytes.push(toU8(BREAK_HELP_IN[i] & 255))
  }
  return String.fromBytes(bytes, 0, n)
}

/** Start a run, with the page's saved settings when it wrote some. */
export const init = (seed: i32): void => {
  BREAK_LINK[LINK_QUIT] = 0
  gameSetSize(GAME_MAX_WIDTH, GAME_MAX_HEIGHT)
  ROOT[0] = new BreakPage(new BreakDirector(toI64(seed), linkedSettings(), startHelp(), false))
}

/**
 * The canvas's size in CSS pixels; nish/page/game calls it as the canvas
 * resizes. A portrait canvas a finger plays on gets the frame turned.
 */
export const resize = (width: i32, height: i32): void => {
  BOX[0] = width
  BOX[1] = height
}

/** One sound's samples for the page; 0 past the last id. */
export const sound = (id: i32): i32 => {
  if (id < 0 || id >= SOUND_COUNT) {
    return 0
  }
  return gameWriteSamples(voiceSamples(id), SAMPLE_RATE)
}

/**
 * Escape on a page leads to the title and never past it: it skips the intro
 * to the title, and on the title it does nothing, so only the title's Quit (or
 * q) closes the game. A terminal's Escape quits from both. Elsewhere, in
 * Settings, How to play and a game, Escape is the director's as it is.
 */
const escapeToTitle = (d: BreakDirector, input: StepInput): void => {
  const intro: boolean = d.scene === SCENE_INTRO
  if (!intro && !(d.scene === SCENE_MENU && d.menu.screen === SCREEN_TITLE)) {
    return
  }
  const kept: TermEvent[] = []
  for (const e of input.events) {
    if (e.type !== EVENT_KEY || e.key !== KEY_ESCAPE) {
      kept.push(e)
    } else if (intro) {
      // A Space instead, which the intro takes as any key: skip to the title.
      e.key = KEY_SPACE
      kept.push(e)
    }
  }
  input.events = kept
}

/** A press of `key` that no key made, appended to this step's events. */
const pressFor = (input: StepInput, key: i32): void => {
  const e = new TermEvent(EVENT_KEY)
  e.key = key
  e.action = ACTION_PRESS
  input.events.push(e)
}

/** The frame column under the shown frame's pixel `x`, `y`: the same unless the frame was turned. */
const frameX = (run: BreakPage, x: i32, y: i32): f64 => toF64(run.turned ? y : x)

/** The frame row under the shown frame's pixel `x`, `y`; turned, its top is the shown frame's right. */
const frameY = (run: BreakPage, x: i32, y: i32): f64 => toF64(run.turned ? run.fb.height - 1 - x : y)

/**
 * What the page's touch asks this step. Its menu button is Escape, which
 * pauses a game and backs out of a menu. A tap acts on the menu line under
 * it, and elsewhere is Space: it serves, launches and resumes. A held finger
 * steers the paddle, along the frame's long side however it is shown.
 */
const touchInput = (run: BreakPage): void => {
  const d: BreakDirector = run.director
  if (BREAK_LINK[LINK_MENU] !== run.menus) {
    run.menus = BREAK_LINK[LINK_MENU]
    pressFor(run.input, KEY_ESCAPE)
  }
  if (BREAK_LINK[LINK_TAPS] !== run.taps) {
    run.taps = BREAK_LINK[LINK_TAPS]
    const x: i32 = BREAK_LINK[LINK_TAP_X]
    const y: i32 = BREAK_LINK[LINK_TAP_Y]
    if (!tapBreakDirector(d, frameX(run, x, y), frameY(run, x, y))) {
      pressFor(run.input, KEY_SPACE)
    }
  }
  const aim: i32 = BREAK_LINK[LINK_AIM] - 1
  aimBreakDirector(d, aim < 0 ? -1.0 : frameX(run, aim, BREAK_LINK[LINK_AIM_Y]))
}

/** One fixed step of 1/120 s on the page's input; `nowMs` is its step clock. */
export const step = (nowMs: f64): void => {
  const run: BreakPage | null = ROOT[0]
  if (run === null || BREAK_LINK[LINK_QUIT] !== 0) {
    return
  }
  const d: BreakDirector = run.director
  gameReadInput(run.input, nowMs)
  touchInput(run)
  escapeToTitle(d, run.input)
  if (!stepBreakDirector(d, run.input)) {
    BREAK_LINK[LINK_QUIT] = 1
  }
  // Turning sound on plays the hello, so the player hears it works; the page's audio needs no finding.
  if (d.soundChanged) {
    for (let i: i32 = 0; i < d.soundTurnedOn; i++) {
      gamePlaySound(SOUND_HELLO)
    }
  }
  if (d.saveWanted) {
    keepSettings(d.kept)
  }
  if (d.settings.sound) {
    for (const id of d.sounds) {
      gamePlaySound(id)
    }
  }
}

/** Draw the frame `alpha` of the way from the last step to this one; `frameMs` is the time since the last frame. */
export const draw = (alpha: f64, frameMs: f64): void => {
  const run: BreakPage | null = ROOT[0]
  if (run === null) {
    return
  }
  const d: BreakDirector = run.director
  const fb: Framebuffer = run.fb
  if (frameMs > 0.0 && frameMs < 1000.0) {
    run.frameMs = run.frameMs + (frameMs - run.frameMs) * 0.1
    run.clockNs = run.clockNs + toI64(frameMs * 1000000.0)
  }
  const fps: i32 = toI32(Math.round(1000.0 / run.frameMs))
  run.stats.tier = fps
  run.stats.frameCostMs = run.frameMs
  // A page has no link: a frame is on the screen when it is drawn.
  adaptBreakResolution(d, fps, 0.0, fb.height, run.clockNs)
  // A portrait screen touched: the frame turned, so a phone held sideways shows it upright and large.
  const turn: boolean = BREAK_LINK[LINK_TOUCH] === 1 && BOX[1] > BOX[0]
  sizeBreakFramebuffer(
    d,
    fb,
    turn ? GAME_MAX_HEIGHT : GAME_MAX_WIDTH,
    turn ? GAME_MAX_WIDTH : GAME_MAX_HEIGHT
  )
  drawBreakDirector(d, fb, alpha, run.stats)
  const w: i32 = fb.width
  const h: i32 = fb.height
  if (!turn) {
    const n: i32 = w * h
    for (let i: i32 = 0; i < n; i++) {
      GAME_FRAME[i] = fb.pixels[i]
    }
    gameSetSize(w, h)
  } else {
    // A quarter turn clockwise: fb's row y becomes the shown frame's column h - 1 - y.
    for (let y: i32 = 0; y < h; y++) {
      const row: i32 = y * w
      const column: i32 = h - 1 - y
      for (let x: i32 = 0; x < w; x++) {
        GAME_FRAME[x * h + column] = fb.pixels[row + x]
      }
    }
    gameSetSize(h, w)
  }
  run.turned = turn
}
