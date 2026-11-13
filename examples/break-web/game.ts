// The game behind the docs hero terminal, as a page runs it: the terminal
// game's director and scenes (src/break-director.ts), stepped and drawn over
// nish/host/game instead of a terminal. break.mjs is the page side, and
// build.mjs builds both into docs/site/break/.
//
// The director is an object graph, and a page calls this module once a step
// and once a frame: it lives in root storage (ROOT), which the module keeps
// between calls. The page and the module also share BREAK_LINK, a few words
// for what a page has and a terminal does not: settings kept in localStorage,
// and closing the overlay when the game quits.
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
import { KeyState } from "nish/term"
import { Framebuffer } from "nish/term-pixels"
import { TermStats } from "nish/term-rate"
import {
  BreakDirector,
  adaptBreakResolution,
  drawBreakDirector,
  sizeBreakFramebuffer,
  stepBreakDirector,
} from "../../src/break-director"
import { SOUND_COUNT } from "../../src/break-game"
import { BreakSettings } from "../../src/break-menu"
import { SAMPLE_RATE, SOUND_HELLO, voiceSamples } from "../../src/break-voices"

/** A frame time to start from, until frames are timed: 60 Hz, in milliseconds. */
const FIRST_FRAME_MS: f64 = 1000.0 / 60.0

/** What the help screen shows: the terminal's is `--help`, which a page has no use for. */
const HELP: string = "nish: a compiler\n"

/** BREAK_LINK's words; break.mjs reads and writes the same ones. */
const LINK_QUIT: i32 = 0
const LINK_SAVES: i32 = 1
const LINK_SETTINGS: i32 = 2
const LINK_LOADED: i32 = 9

/**
 * The words the page and the module share: [0] set when the game quits, [1]
 * counted up each time the settings are to be kept, [2..8] the settings in
 * BreakSettings' field order, [9] set by the page when [2..8] hold saved ones.
 */
export const BREAK_LINK = new Int32Array(10)

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

  constructor(director: BreakDirector) {
    this.director = director
    this.input = new StepInput(new KeyState())
    this.fb = new Framebuffer(1, 1)
    this.stats = new TermStats()
    this.clockNs = toI64(0)
    this.frameMs = FIRST_FRAME_MS
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

/** Start a run, with the page's saved settings when it wrote some. */
export const init = (seed: i32): void => {
  BREAK_LINK[LINK_QUIT] = 0
  gameSetSize(GAME_MAX_WIDTH, GAME_MAX_HEIGHT)
  ROOT[0] = new BreakPage(new BreakDirector(toI64(seed), linkedSettings(), HELP, false))
}

/** One sound's samples for the page; 0 past the last id. */
export const sound = (id: i32): i32 => {
  if (id < 0 || id >= SOUND_COUNT) {
    return 0
  }
  return gameWriteSamples(voiceSamples(id), SAMPLE_RATE)
}

/** One fixed step of 1/120 s on the page's input; `nowMs` is its step clock. */
export const step = (nowMs: f64): void => {
  const run: BreakPage | null = ROOT[0]
  if (run === null || BREAK_LINK[LINK_QUIT] !== 0) {
    return
  }
  const d: BreakDirector = run.director
  gameReadInput(run.input, nowMs)
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
  sizeBreakFramebuffer(d, fb, GAME_MAX_WIDTH, GAME_MAX_HEIGHT)
  drawBreakDirector(d, fb, alpha, run.stats)
  const n: i32 = fb.width * fb.height
  for (let i: i32 = 0; i < n; i++) {
    GAME_FRAME[i] = fb.pixels[i]
  }
  gameSetSize(fb.width, fb.height)
}
