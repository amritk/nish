// The title card of `nish break`, the brick breaker hidden in the CLI: the
// NISH BREAK logo in bricks under a rainbow shimmer, an attract-mode ball
// knocking holes in a dim wall that grows back, the menu, the settings screen,
// the how-to-play overlay and the outro that crumbles the logo into the game.
//
// It is pure: `stepBreakMenu` reads one step of input and answers what the
// director should do next, `drawBreakMenu` paints a framebuffer, and neither
// touches the terminal. The director owns the terminal, applies settings and
// switches to the game.
//
// Like the game it follows two rules. Every array is made in `newBreakMenu`
// and reused, so a step or a frame allocates nothing. And anything that moves
// is drawn at `lerp(previous, current, alpha)` (or at a time that `alpha`
// carries between steps), so a frame rate above the step rate stays smooth.

// The import order is deliberate. break-gfx and its `../std/term-pixels` load
// first, so term-pixels is the root package's here as it is under break-gfx
// alone; term-io comes as `../std/term-io` after them, a root module of its
// own, so the `nish` modules it pulls in follow it and not break-gfx. Either
// way round, break-gfx's checked dump would differ from the one it has alone.
import { Framebuffer } from "../std/term-pixels"
import {
  NO_SHADOW,
  Particles,
  STEPS_PER_SECOND,
  Trail,
  View,
  WORLD_H,
  WORLD_W,
  add,
  bevelBrick,
  blendRect,
  clamp,
  dim,
  disc,
  drawParticles,
  drawTextCentred,
  drawText,
  drawTextShadow,
  drawTrail,
  fillLetterbox,
  fillRect,
  fontScaleFor,
  glow,
  gradient,
  hue,
  lerp,
  mix,
  outBounce,
  outCubic,
  pushTrail,
  spawnParticle,
  stepParticles,
  viewFor,
} from "./break-gfx"
import {
  ACTION_PRESS,
  ACTION_REPEAT,
  EVENT_KEY,
  KEY_CHAR,
  KEY_DOWN,
  KEY_ENTER,
  KEY_ESCAPE,
  KEY_LEFT,
  KEY_RIGHT,
  KEY_SPACE,
  KEY_UP,
  TermEvent,
} from "nish/term"
import { TermInput } from "../std/term-io"

// ---- The interface the director reads ---------------------------------------

/** `stepBreakMenu`'s answer while the menu carries on. */
export const MENU_STAY: i32 = 0

/** `stepBreakMenu`'s answer when the player picked Quit (or pressed q or Esc). */
export const MENU_QUIT: i32 = -1

/**
 * `stepBreakMenu`'s answer when the player left Settings having changed the
 * frame rate or the graphics, which are read when the terminal opens: the
 * director reopens it, and the menu stays where it was.
 */
export const MENU_APPLY: i32 = -2

/** How many frame rates Settings offers; `fpsChoice` reads them (a module may not hold an array constant). */
export const FPS_CHOICE_COUNT: i32 = 5

/** How many resolutions Settings offers; `resolutionChoice` reads them. */
export const RESOLUTION_CHOICE_COUNT: i32 = 5

/**
 * The frame rate at `index` of the choices 0, 30, 60, 120 and 240, where 0 is
 * adaptive (up to 120) and the rest are fixed. An index out of range reads as
 * the nearest end, so a stale setting still names a rate.
 */
export const fpsChoice = (index: i32): i32 => {
  const i: i32 = Math.min(Math.max(index, 0), FPS_CHOICE_COUNT - 1)
  if (i === 0) {
    return 0
  }
  if (i === 1) {
    return 30
  }
  if (i === 2) {
    return 60
  }
  return i === 3 ? 120 : 240
}

/**
 * The framebuffer height at `index` of the choices 270, 360, 540, 720 and
 * 1080 (16:9), clamped like `fpsChoice`.
 */
export const resolutionChoice = (index: i32): i32 => {
  const i: i32 = Math.min(Math.max(index, 0), RESOLUTION_CHOICE_COUNT - 1)
  if (i === 0) {
    return 270
  }
  if (i === 1) {
    return 360
  }
  if (i === 2) {
    return 540
  }
  return i === 3 ? 720 : 1080
}

/** What the Settings screen edits; the director reads it and applies it. */
export class BreakSettings {
  /** An index for `fpsChoice`: 0 is adaptive. */
  fps: i32
  /** An index for `resolutionChoice`: 2 is 540. */
  resolution: i32
  /** -1 lets the terminal choose; otherwise a `GRAPHICS_*` from `std/term-pixels`. */
  graphics: i32
  /** 0 low (no glow, no trails, a third of the sparks), 1 high. */
  effects: i32
  /** Whether frames are interpolated by `alpha`. */
  smoothing: boolean
  /** Whether the frame-rate overlay is shown. */
  stats: boolean

  /** The defaults: adaptive frame rate, 540 lines, automatic graphics, smoothing on, high effects, no stats. */
  constructor() {
    this.fps = 0
    this.resolution = 2
    this.graphics = -1
    this.smoothing = true
    this.effects = 1
    this.stats = false
  }
}

// ---- Screens and layout -----------------------------------------------------

/** The title screen and its five items. */
export const SCREEN_TITLE: i32 = 0

/** The how-to-play overlay. */
export const SCREEN_HOWTO: i32 = 1

/** The Settings screen. */
export const SCREEN_SETTINGS: i32 = 2

/** The outro, after Play or Start level, until the wipe has cleared the screen. */
export const SCREEN_OUTRO: i32 = 3

/** The levels the game has; Start level cycles through 1 to this. */
const MENU_LEVELS: i32 = 6

/** The title items, top to bottom: Play, Start level, How to play, Settings, Quit. */
const ITEM_COUNT: i32 = 5
/** Where `tick` goes back to 0: 2^30, half the i32 range. */
const TICK_WRAP: i32 = 1073741824
const ITEM_PLAY: i32 = 0
const ITEM_LEVEL: i32 = 1
const ITEM_HOWTO: i32 = 2
const ITEM_SETTINGS: i32 = 3

/** The Settings rows, top to bottom; the last is Back. */
const ROW_COUNT: i32 = 7
const ROW_FPS: i32 = 0
const ROW_RESOLUTION: i32 = 1
const ROW_GRAPHICS: i32 = 2
const ROW_SMOOTHING: i32 = 3
const ROW_EFFECTS: i32 = 4
const ROW_STATS: i32 = 5
const ROW_BACK: i32 = 6

/** The outro's length in steps (1 s): the step it reaches is the one that answers the level. */
export const OUTRO_STEPS: i32 = 120

/** The outro step from which the wipe runs, so it closes over the last 0.35 s. */
const WIPE_FROM: i32 = 78

/** The steps over which the menu items fade out once the outro starts (0.4 s). */
const FADE_STEPS: i32 = 48

/** The world y of the first title item, and the step to the next. */
const ITEM_TOP: f64 = 82.0
const ITEM_GAP: f64 = 13.0

/** The world y of the first Settings row, and the step to the next. */
const ROW_TOP: f64 = 86.0
const ROW_GAP: f64 = 10.0

/** The panel Settings and How to play draw over the lower half of the world. */
const PANEL_X: f64 = 16.0
const PANEL_Y: f64 = 72.0
const PANEL_W: f64 = 288.0
const PANEL_H: f64 = 104.0

/** The share of the way to its target the sliding highlight closes each step. */
const HIGHLIGHT_EASE: f64 = 0.22

// ---- The logo ---------------------------------------------------------------

/**
 * NISH and BREAK as five rows of cells, `#` a brick, each row run into the
 * next: NISH is 19 cells wide and BREAK 24.
 */
const LOGO_NISH: string =
  "#...#.###..###.#..###..#..#..#....#..##.#.#..#...##..#####..##..#.....#.#..##...#.###.###..#..#"
const LOGO_BREAK: string =
  "###..###..####..##..#..##..#.#..#.#....#..#.#.#.###..###..###..####.##..#..#.#.#..#....#..#.#.#.###..#..#.####.#..#.#..#"
const NISH_COLS: i32 = 19
const BREAK_COLS: i32 = 24

/** A logo cell in world units: the lettering is 192 wide at its widest. */
const CELL_W: f64 = 8.0
const CELL_H: f64 = 5.0

/** The world y of NISH's top row, and of BREAK's. */
const NISH_TOP: f64 = 10.0
const BREAK_TOP: f64 = 40.0

/** How far above home a logo brick starts its drop, and the steps the drop takes. */
const DROP_HEIGHT: f64 = 80.0
const DROP_STEPS: f64 = 54.0

/** Steps between one logo column starting its drop and the next. */
const DROP_STAGGER: f64 = 1.4

/** Gravity on a loose logo brick in the outro, in world units a second squared. */
const OUTRO_GRAVITY: f64 = 540.0

// ---- The attract wall -------------------------------------------------------

/** The background wall: 16 columns of 20-unit bricks across the world, 6 rows deep. */
const WALL_COLS: i32 = 16
const WALL_ROWS: i32 = 6
const WALL_BRICK_W: f64 = 20.0
const WALL_BRICK_H: f64 = 8.0
const WALL_TOP: f64 = 6.0

/** The steps a knocked-out brick stays away before it grows back: 4 s and up to 2 s more. */
const REGROW_STEPS: i32 = 480
const REGROW_SPREAD: i32 = 240

/** The steps a returning brick takes to grow to full size. */
const GROW_STEPS: i32 = 24

/** The attract ball's radius and its slowest vertical speed (so it never skims a wall for ever). */
const BALL_R: f64 = 2.5
const BALL_MIN_VY: f64 = 30.0

/** The points the ball's trail keeps, and the sparks alive at once. */
const TRAIL_POINTS: i32 = 10
const SPARK_CAPACITY: i32 = 160

// ---- Colours ----------------------------------------------------------------

const BG_TOP: i32 = 0x0a0820
const BG_BOTTOM: i32 = 0x1e0c30
/** What a fading item fades into: the background where the items sit. */
const BG_MID: i32 = 0x160a2a
const LETTERBOX: i32 = 0x05040c
const WIPE: i32 = 0x05040c
const PANEL: i32 = 0x0c0a1c
const WHITE: i32 = 0xf4f2ff
const TEXT: i32 = 0xd8d4f0
const MUTED: i32 = 0x8a84b0
const SHADOW: i32 = 0x02020a
const BALL: i32 = 0xfff4d8

// ---- Input ------------------------------------------------------------------

/** What one key means to the menu. */
const ACT_NONE: i32 = 0
const ACT_UP: i32 = 1
const ACT_DOWN: i32 = 2
const ACT_LEFT: i32 = 3
const ACT_RIGHT: i32 = 4
const ACT_PICK: i32 = 5
const ACT_BACK: i32 = 6
const ACT_QUIT: i32 = 7

/** The menu: what is on screen, what is selected, and the attract scene behind it. */
export class BreakMenu {
  /** What the Settings screen edits; the director reads it after `MENU_APPLY` and each frame. */
  settings: BreakSettings
  /** The highlight bar's world y now and a step ago; it slides toward the selected line. */
  highlightY: f64
  prevHighlightY: f64

  /** Each logo brick's home, position now and a step ago, velocity, column and the outro step it comes loose. */
  homeXs: f64[]
  homeYs: f64[]
  xs: f64[]
  ys: f64[]
  prevXs: f64[]
  prevYs: f64[]
  vxs: f64[]
  vys: f64[]
  columns: i32[]
  releases: i32[]

  /** Each wall brick's steps until it grows back (0 when it is there), and steps since it last grew back. */
  wallAway: i32[]
  wallAge: i32[]

  /** The attract ball, now and a step ago, and its velocity in world units a second. */
  ballX: f64
  ballY: f64
  prevBallX: f64
  prevBallY: f64
  ballVX: f64
  ballVY: f64
  trail: Trail
  sparks: Particles
  /** The view `drawBreakMenu` reuses, so a frame allocates none. */
  view: View

  // The 32-bit fields last, widest first above them, so the padding is at most the tail after them.
  /** A `SCREEN_*`. */
  screen: i32
  /** Steps since the menu was made: the clock every time-driven animation reads. */
  tick: i32
  /** The title item selected, 0 to 4. */
  selected: i32
  /** The level Play and Start level begin at, 1 to 6. */
  level: i32
  /** The Settings row selected, 0 to 6. */
  row: i32
  /** The frame rate and graphics when Settings opened, to tell whether leaving needs `MENU_APPLY`. */
  entryFps: i32
  entryGraphics: i32
  /** Steps since the outro started. */
  outroTick: i32
  /** The xorshift state the attract scene's dice read; never 0, where xorshift would stick. */
  rngState: i32

  /** A menu on the title screen; `newBreakMenu` is the way to make one. */
  constructor(level: i32, seed: i32, settings: BreakSettings) {
    this.settings = settings
    this.screen = SCREEN_TITLE
    this.tick = 0
    this.selected = ITEM_PLAY
    this.level = Math.min(Math.max(level, 1), MENU_LEVELS)
    this.row = ROW_FPS
    this.highlightY = ITEM_TOP
    this.prevHighlightY = ITEM_TOP
    this.entryFps = settings.fps
    this.entryGraphics = settings.graphics
    this.outroTick = 0
    const bricks: i32 = logoBrickCount()
    this.homeXs = new Array<f64>(bricks)
    this.homeXs.fill(0.0)
    this.homeYs = new Array<f64>(bricks)
    this.homeYs.fill(0.0)
    this.xs = new Array<f64>(bricks)
    this.xs.fill(0.0)
    this.ys = new Array<f64>(bricks)
    this.ys.fill(0.0)
    this.prevXs = new Array<f64>(bricks)
    this.prevXs.fill(0.0)
    this.prevYs = new Array<f64>(bricks)
    this.prevYs.fill(0.0)
    this.vxs = new Array<f64>(bricks)
    this.vxs.fill(0.0)
    this.vys = new Array<f64>(bricks)
    this.vys.fill(0.0)
    this.columns = new Array<i32>(bricks)
    this.columns.fill(0)
    this.releases = new Array<i32>(bricks)
    this.releases.fill(0)
    this.wallAway = new Array<i32>(WALL_COLS * WALL_ROWS)
    this.wallAway.fill(0)
    this.wallAge = new Array<i32>(WALL_COLS * WALL_ROWS)
    this.wallAge.fill(GROW_STEPS)
    this.rngState = seed === 0 ? 0x2545f491 : seed
    this.ballX = WORLD_W / 2.0
    this.ballY = WORLD_H - 20.0
    this.prevBallX = this.ballX
    this.prevBallY = this.ballY
    this.ballVX = 0.0
    this.ballVY = 0.0
    this.trail = new Trail(TRAIL_POINTS)
    this.sparks = new Particles(SPARK_CAPACITY)
    this.view = new View()
  }
}

/** A menu on the title screen with the default settings, Start level at `level` (clamped to 1..6). */
export const newBreakMenu = (level: i32, seed: i64): BreakMenu =>
  newBreakMenuWith(level, seed, new BreakSettings())

/**
 * A menu like `newBreakMenu`'s that edits `settings` in place, so the director
 * can hand the old menu's settings to the next one and keep them across games.
 */
export const newBreakMenuWith = (level: i32, seed: i64, settings: BreakSettings): BreakMenu => {
  // The generator keeps 32 bits; fold the high half of the seed into the low so both count.
  const low: i32 = toI32(seed & toI64(0x7fffffff))
  const high: i32 = toI32((seed >> toI64(31)) & toI64(0x7fffffff))
  const menu: BreakMenu = new BreakMenu(level, low ^ high, settings)
  layOutLogo(menu)
  serveBall(menu)
  return menu
}

/**
 * A number in [`lo`, `hi`], both ends included, from Marsaglia's xorshift32.
 * The menu keeps its own rather than `std/random`'s `Rng`, whose private
 * `mix` would clash with break-gfx's `mix` in one program; a slight modulo
 * bias does not matter to sparks and slants.
 */
const menuRandom = (menu: BreakMenu, lo: i32, hi: i32): i32 => {
  let x: i32 = menu.rngState
  x = x ^ (x << 13)
  x = x ^ (x >>> 17)
  x = x ^ (x << 5)
  menu.rngState = x
  return lo + ((x >>> 1) % (hi - lo + 1))
}

/** The bricks in the logo: one for each `#` of both words. */
const logoBrickCount = (): i32 => countBricks(LOGO_NISH) + countBricks(LOGO_BREAK)

/** The `#` cells of one word's bitmap. */
const countBricks = (cells: string): i32 => {
  let n: i32 = 0
  for (let i: i32 = 0; i < toI32(cells.length); i++) {
    if (cells.charCodeAt(i) === 35) {
      n++
    }
  }
  return n
}

/** Place every logo brick at home, centred on the world, and draw the order they come loose in. */
const layOutLogo = (menu: BreakMenu): void => {
  const next: i32 = layOutWord(menu, LOGO_NISH, NISH_COLS, NISH_TOP, 0, (BREAK_COLS - NISH_COLS) / 2)
  layOutWord(menu, LOGO_BREAK, BREAK_COLS, BREAK_TOP, next, 0)
}

/**
 * Place one word's bricks from slot `first` on, its rows `cols` cells wide
 * from world y `top`; `shift` is the word's first column in the logo's
 * 24-column grid, which the shimmer's hue runs along. Answers the next free slot.
 */
const layOutWord = (menu: BreakMenu, cells: string, cols: i32, top: f64, first: i32, shift: i32): i32 => {
  const left: f64 = (WORLD_W - toF64(cols) * CELL_W) / 2.0
  let slot: i32 = first
  for (let i: i32 = 0; i < toI32(cells.length); i++) {
    if (cells.charCodeAt(i) !== 35 || slot < 0 || slot >= toI32(menu.homeXs.length)) {
      continue
    }
    const col: i32 = i % cols
    const row: i32 = i / cols
    menu.homeXs[slot] = left + toF64(col) * CELL_W
    menu.homeYs[slot] = top + toF64(row) * CELL_H
    menu.columns[slot] = col + shift
    // Columns come loose left to right with a little jitter, so the logo crumbles rather than drops.
    // The first outro step is 1, so a release of 0 would never be kicked loose.
    menu.releases[slot] = toI32(toF64(col + shift) * 0.7) + menuRandom(menu, 1, 10)
    slot++
  }
  return slot
}

/** Put the attract ball near the bottom, heading up and out at a random slant. */
const serveBall = (menu: BreakMenu): void => {
  const side: f64 = menuRandom(menu, 0, 1) === 0 ? -1.0 : 1.0
  menu.ballX = WORLD_W / 2.0
  menu.ballY = WORLD_H - 20.0
  menu.prevBallX = menu.ballX
  menu.prevBallY = menu.ballY
  menu.ballVX = side * toF64(menuRandom(menu, 55, 80))
  menu.ballVY = -toF64(menuRandom(menu, 55, 70))
  menu.trail.clear()
}

// ---- Stepping ---------------------------------------------------------------

/**
 * One step of the menu: the attract scene moves, the highlight slides, and the
 * step's key presses act. It answers `MENU_STAY`, `MENU_QUIT`, `MENU_APPLY`,
 * or the level to play on the step the outro ends.
 */
export const stepBreakMenu = (menu: BreakMenu, input: TermInput): i32 => {
  // Wrapped long before i32 runs out, so a menu left open for months does not
  // panic on the checked add; the animations jump once a billion steps.
  menu.tick = menu.tick >= TICK_WRAP ? 0 : menu.tick + 1
  stepWall(menu)
  stepBall(menu)
  stepParticles(menu.sparks, 160.0, 1.5)
  menu.prevHighlightY = menu.highlightY
  if (menu.screen === SCREEN_OUTRO) {
    return stepOutro(menu, input)
  }
  let answer: i32 = MENU_STAY
  const entered: i32 = menu.screen
  for (const e of input.events) {
    // One screen change a step: the rest of a burst was aimed at the screen just left.
    if (answer !== MENU_STAY || menu.screen !== entered) {
      break
    }
    if (e.type !== EVENT_KEY || (e.action !== ACTION_PRESS && e.action !== ACTION_REPEAT)) {
      continue
    }
    const act: i32 = actionOf(e)
    // A held arrow keeps moving, but a held Esc or Enter acts once: its repeats
    // would otherwise close How to play and then quit, or open Settings and cycle it.
    const moves: boolean = act === ACT_UP || act === ACT_DOWN || act === ACT_LEFT || act === ACT_RIGHT
    if (e.action === ACTION_REPEAT && !moves) {
      continue
    }
    if (menu.screen === SCREEN_TITLE) {
      answer = actOnTitle(menu, act)
    } else if (menu.screen === SCREEN_HOWTO) {
      answer = actOnHowTo(menu, act)
    } else {
      answer = actOnSettings(menu, act)
    }
  }
  slideHighlight(menu)
  return answer
}

/** What key event `e` asks of the menu, as an `ACT_*`. */
const actionOf = (e: TermEvent): i32 => {
  if (e.key === KEY_UP) {
    return ACT_UP
  }
  if (e.key === KEY_DOWN) {
    return ACT_DOWN
  }
  if (e.key === KEY_LEFT) {
    return ACT_LEFT
  }
  if (e.key === KEY_RIGHT) {
    return ACT_RIGHT
  }
  if (e.key === KEY_ENTER || e.key === KEY_SPACE) {
    return ACT_PICK
  }
  if (e.key === KEY_ESCAPE) {
    return ACT_BACK
  }
  if (e.key !== KEY_CHAR) {
    return ACT_NONE
  }
  // Letters either case: W/S and A/D for one hand, k/j and h/l for vi.
  const c: i32 = e.code >= 65 && e.code <= 90 ? e.code + 32 : e.code
  if (c === 119 || c === 107) {
    return ACT_UP
  }
  if (c === 115 || c === 106) {
    return ACT_DOWN
  }
  if (c === 97 || c === 104) {
    return ACT_LEFT
  }
  if (c === 100 || c === 108) {
    return ACT_RIGHT
  }
  return c === 113 ? ACT_QUIT : ACT_NONE
}

/** `value` stepped by `by` within 0..`count`-1, wrapping round at either end. */
const wrap = (value: i32, by: i32, count: i32): i32 => {
  const next: i32 = value + by
  if (next < 0) {
    return count - 1
  }
  return next >= count ? 0 : next
}

/** A title-screen action: arrows move or change the level, and only a pick or a quit leaves. */
const actOnTitle = (menu: BreakMenu, act: i32): i32 => {
  if (act === ACT_UP || act === ACT_DOWN) {
    menu.selected = wrap(menu.selected, act === ACT_UP ? -1 : 1, ITEM_COUNT)
  } else if ((act === ACT_LEFT || act === ACT_RIGHT) && menu.selected === ITEM_LEVEL) {
    menu.level = wrap(menu.level - 1, act === ACT_LEFT ? -1 : 1, MENU_LEVELS) + 1
  } else if (act === ACT_BACK || act === ACT_QUIT) {
    return MENU_QUIT
  } else if (act === ACT_PICK) {
    return pickTitle(menu)
  }
  return MENU_STAY
}

/** The selected item picked. Opening Settings records the frame rate and graphics, so leaving can tell whether the director must reapply. */
const pickTitle = (menu: BreakMenu): i32 => {
  if (menu.selected === ITEM_PLAY || menu.selected === ITEM_LEVEL) {
    startOutro(menu)
  } else if (menu.selected === ITEM_HOWTO) {
    menu.screen = SCREEN_HOWTO
  } else if (menu.selected === ITEM_SETTINGS) {
    menu.screen = SCREEN_SETTINGS
    menu.row = ROW_FPS
    menu.entryFps = menu.settings.fps
    menu.entryGraphics = menu.settings.graphics
    snapHighlight(menu)
  } else {
    return MENU_QUIT
  }
  return MENU_STAY
}

/** Act on the how-to-play overlay: Esc, Enter or Space close it, and q still quits. */
const actOnHowTo = (menu: BreakMenu, act: i32): i32 => {
  if (act === ACT_QUIT) {
    return MENU_QUIT
  }
  if (act === ACT_BACK || act === ACT_PICK) {
    menu.screen = SCREEN_TITLE
  }
  return MENU_STAY
}

/** A Settings action: Enter cycles like Right so one key works every row, except on Back, where it leaves. */
const actOnSettings = (menu: BreakMenu, act: i32): i32 => {
  if (act === ACT_QUIT) {
    return MENU_QUIT
  }
  if (act === ACT_UP || act === ACT_DOWN) {
    menu.row = wrap(menu.row, act === ACT_UP ? -1 : 1, ROW_COUNT)
  } else if (act === ACT_LEFT || act === ACT_RIGHT) {
    cycleSetting(menu.settings, menu.row, act === ACT_LEFT ? -1 : 1)
  } else if (act === ACT_BACK || (act === ACT_PICK && menu.row === ROW_BACK)) {
    return leaveSettings(menu)
  } else if (act === ACT_PICK) {
    cycleSetting(menu.settings, menu.row, 1)
  }
  return MENU_STAY
}

/** Back to the title, answering `MENU_APPLY` when the frame rate or graphics changed while Settings was open. */
const leaveSettings = (menu: BreakMenu): i32 => {
  menu.screen = SCREEN_TITLE
  snapHighlight(menu)
  const changed: boolean =
    menu.settings.fps !== menu.entryFps || menu.settings.graphics !== menu.entryGraphics
  return changed ? MENU_APPLY : MENU_STAY
}

/**
 * Step the setting on `row` by `by`, wrapping. Graphics runs auto, kitty,
 * sixel, half-block, ascii: the best first, as the terminal would choose.
 */
export const cycleSetting = (settings: BreakSettings, row: i32, by: i32): void => {
  if (row === ROW_FPS) {
    settings.fps = wrap(Math.min(Math.max(settings.fps, 0), FPS_CHOICE_COUNT - 1), by, FPS_CHOICE_COUNT)
  } else if (row === ROW_RESOLUTION) {
    const at: i32 = Math.min(Math.max(settings.resolution, 0), RESOLUTION_CHOICE_COUNT - 1)
    settings.resolution = wrap(at, by, RESOLUTION_CHOICE_COUNT)
  } else if (row === ROW_GRAPHICS) {
    settings.graphics = graphicsAt(wrap(graphicsSlot(settings.graphics), by, 5))
  } else if (row === ROW_SMOOTHING) {
    settings.smoothing = !settings.smoothing
  } else if (row === ROW_EFFECTS) {
    settings.effects = settings.effects === 0 ? 1 : 0
  } else if (row === ROW_STATS) {
    settings.stats = !settings.stats
  }
}

/** Where a graphics setting sits in Settings' order: auto 0, then kitty (3) down to ascii (0) at 4. */
const graphicsSlot = (graphics: i32): i32 => (graphics < 0 || graphics > 3 ? 0 : 4 - graphics)

/** The graphics setting at a slot of Settings' order: `graphicsSlot` backwards. */
const graphicsAt = (slot: i32): i32 => (slot <= 0 || slot > 4 ? -1 : 4 - slot)

/** The world y the highlight bar belongs at for the screen's selection. */
const highlightTarget = (menu: BreakMenu): f64 =>
  menu.screen === SCREEN_SETTINGS
    ? ROW_TOP + toF64(menu.row) * ROW_GAP
    : ITEM_TOP + toF64(menu.selected) * ITEM_GAP

/** Move the highlight part of the way to its target, so it slides and settles. */
const slideHighlight = (menu: BreakMenu): void => {
  const target: f64 = highlightTarget(menu)
  const next: f64 = menu.highlightY + (target - menu.highlightY) * HIGHLIGHT_EASE
  menu.highlightY = Math.abs(target - next) < 0.01 ? target : next
}

/** Put the highlight on its target at once, as a screen opens, so it does not slide in from another list. */
const snapHighlight = (menu: BreakMenu): void => {
  menu.highlightY = highlightTarget(menu)
  menu.prevHighlightY = menu.highlightY
}

// ---- The attract scene ------------------------------------------------------

/** The index of the wall brick under world `x`, `y`, or -1 off the wall. */
const wallCellAt = (x: f64, y: f64): i32 => {
  if (x < 0.0 || y < WALL_TOP || x >= WORLD_W) {
    return -1
  }
  const col: i32 = toI32(Math.floor(x / WALL_BRICK_W))
  const row: i32 = toI32(Math.floor((y - WALL_TOP) / WALL_BRICK_H))
  if (col < 0 || col >= WALL_COLS || row < 0 || row >= WALL_ROWS) {
    return -1
  }
  return row * WALL_COLS + col
}

/** Whether the ball's square overlaps wall brick `cell`, where a returning brick must wait. */
const ballOverlaps = (menu: BreakMenu, cell: i32): boolean => {
  const x: f64 = toF64(cell % WALL_COLS) * WALL_BRICK_W
  const y: f64 = WALL_TOP + toF64(cell / WALL_COLS) * WALL_BRICK_H
  return (
    menu.ballX + BALL_R > x &&
    menu.ballX - BALL_R < x + WALL_BRICK_W &&
    menu.ballY + BALL_R > y &&
    menu.ballY - BALL_R < y + WALL_BRICK_H
  )
}

/** Count down the bricks that are away and grow back the ones whose time is up, unless the ball is in the way. */
const stepWall = (menu: BreakMenu): void => {
  const n: i32 = Math.min(toI32(menu.wallAway.length), toI32(menu.wallAge.length))
  for (let i: i32 = 0; i < n; i++) {
    if (menu.wallAway[i] > 1 || (menu.wallAway[i] === 1 && !ballOverlaps(menu, i))) {
      menu.wallAway[i] = menu.wallAway[i] - 1
      if (menu.wallAway[i] === 0) {
        menu.wallAge[i] = 0
      }
    } else if (menu.wallAway[i] === 0 && menu.wallAge[i] < GROW_STEPS) {
      menu.wallAge[i] = menu.wallAge[i] + 1
    }
  }
}

/** Knock wall brick `cell` out: it goes away for a while and bursts into sparks of its colour. */
const knock = (menu: BreakMenu, cell: i32): void => {
  if (cell < 0 || cell >= toI32(menu.wallAway.length)) {
    return
  }
  menu.wallAway[cell] = REGROW_STEPS + menuRandom(menu, 0, REGROW_SPREAD)
  const cx: f64 = (toF64(cell % WALL_COLS) + 0.5) * WALL_BRICK_W
  const cy: f64 = WALL_TOP + (toF64(cell / WALL_COLS) + 0.5) * WALL_BRICK_H
  const colour: i32 = add(wallColour(cell / WALL_COLS), 0x303030)
  const count: i32 = menu.settings.effects === 0 ? 2 : 8
  for (let i: i32 = 0; i < count; i++) {
    const vx: f64 = toF64(menuRandom(menu, -60, 60))
    const vy: f64 = toF64(menuRandom(menu, -70, 20))
    const life: f64 = toF64(menuRandom(menu, 40, 80)) / 100.0
    spawnParticle(menu.sparks, cx, cy, vx, vy, life, 1.5, colour)
  }
}

/** One step of the attract ball: it bounces off the world's edges and knocks out any wall brick it meets. */
const stepBall = (menu: BreakMenu): void => {
  const dt: f64 = 1.0 / toF64(STEPS_PER_SECOND)
  menu.prevBallX = menu.ballX
  menu.prevBallY = menu.ballY
  // Each axis moves on its own, so a brick met on one axis reflects only that one.
  let x: f64 = menu.ballX + menu.ballVX * dt
  if (x < BALL_R || x > WORLD_W - BALL_R) {
    menu.ballVX = -menu.ballVX
    x = clamp(x, BALL_R, WORLD_W - BALL_R)
  }
  const hitX: i32 = wallCellAt(x + (menu.ballVX > 0.0 ? BALL_R : -BALL_R), menu.ballY)
  if (hitX >= 0 && menu.wallAway[hitX] === 0) {
    knock(menu, hitX)
    menu.ballVX = -menu.ballVX
    x = menu.ballX
  }
  menu.ballX = x
  let y: f64 = menu.ballY + menu.ballVY * dt
  if (y < BALL_R || y > WORLD_H - BALL_R) {
    menu.ballVY = -menu.ballVY
    y = clamp(y, BALL_R, WORLD_H - BALL_R)
  }
  const hitY: i32 = wallCellAt(menu.ballX, y + (menu.ballVY > 0.0 ? BALL_R : -BALL_R))
  if (hitY >= 0 && menu.wallAway[hitY] === 0) {
    knock(menu, hitY)
    menu.ballVY = -menu.ballVY
    y = menu.ballY
  }
  menu.ballY = y
  if (Math.abs(menu.ballVY) < BALL_MIN_VY) {
    menu.ballVY = menu.ballVY < 0.0 ? -BALL_MIN_VY : BALL_MIN_VY
  }
  // The trail gets where the ball was before this step, the start of the
  // segment the frame interpolates along, so it never runs ahead of the drawn ball.
  pushTrail(menu.trail, menu.prevBallX, menu.prevBallY)
}

// ---- The outro --------------------------------------------------------------

/** Start the outro: every logo brick is set loose where it is drawn now and waits for its release step. */
const startOutro = (menu: BreakMenu): void => {
  menu.screen = SCREEN_OUTRO
  menu.outroTick = 0
  const time: f64 = toF64(menu.tick - 1)
  const n: i32 = logoSlots(menu)
  for (let i: i32 = 0; i < n; i++) {
    menu.xs[i] = menu.homeXs[i]
    menu.ys[i] = titleLogoY(menu, i, time)
    menu.prevXs[i] = menu.xs[i]
    menu.prevYs[i] = menu.ys[i]
    menu.vxs[i] = 0.0
    menu.vys[i] = 0.0
  }
}

/** The logo slots every parallel array holds: they are made the same length, so this is all of them. */
const logoSlots = (menu: BreakMenu): i32 => {
  const n: i32 = Math.min(toI32(menu.homeXs.length), toI32(menu.homeYs.length))
  const m: i32 = Math.min(
    Math.min(toI32(menu.xs.length), toI32(menu.ys.length)),
    Math.min(toI32(menu.prevXs.length), toI32(menu.prevYs.length))
  )
  const k: i32 = Math.min(
    Math.min(toI32(menu.vxs.length), toI32(menu.vys.length)),
    Math.min(toI32(menu.columns.length), toI32(menu.releases.length))
  )
  return Math.min(n, Math.min(m, k))
}

/**
 * One outro step: bricks whose time has come jump loose and fall, the rest
 * wait. Any key press skips to the end; the last step answers the level.
 */
const stepOutro = (menu: BreakMenu, input: TermInput): i32 => {
  menu.outroTick = menu.outroTick + 1
  for (const e of input.events) {
    if (e.type === EVENT_KEY && e.action === ACTION_PRESS) {
      return menu.level
    }
  }
  const dt: f64 = 1.0 / toF64(STEPS_PER_SECOND)
  const n: i32 = logoSlots(menu)
  for (let i: i32 = 0; i < n; i++) {
    menu.prevXs[i] = menu.xs[i]
    menu.prevYs[i] = menu.ys[i]
    if (menu.releases[i] === menu.outroTick) {
      loosen(menu, i)
    }
    if (menu.releases[i] <= menu.outroTick) {
      menu.vys[i] = menu.vys[i] + OUTRO_GRAVITY * dt
      menu.xs[i] = menu.xs[i] + menu.vxs[i] * dt
      menu.ys[i] = menu.ys[i] + menu.vys[i] * dt
    }
  }
  return menu.outroTick >= OUTRO_STEPS ? menu.level : MENU_STAY
}

/** Kick logo brick `i` up and away from the centre, with a puff of sparks where it was. */
const loosen = (menu: BreakMenu, i: i32): void => {
  menu.vxs[i] = (menu.xs[i] + CELL_W / 2.0 - WORLD_W / 2.0) * 0.8 + toF64(menuRandom(menu, -30, 30))
  menu.vys[i] = -toF64(menuRandom(menu, 40, 120))
  const colour: i32 = add(logoColour(menu.columns[i], 0.0), 0x404040)
  const count: i32 = menu.settings.effects === 0 ? 1 : 3
  for (let k: i32 = 0; k < count; k++) {
    const vx: f64 = toF64(menuRandom(menu, -50, 50))
    const vy: f64 = toF64(menuRandom(menu, -80, 0))
    spawnParticle(menu.sparks, menu.xs[i] + CELL_W / 2.0, menu.ys[i] + CELL_H / 2.0, vx, vy, 0.6, 1.5, colour)
  }
}

// ---- Drawing ----------------------------------------------------------------

/**
 * The menu as it stands `alpha` of the way from the last step to the next,
 * into `fb`. A framebuffer too small to hold the world draws nothing but the
 * background.
 */
export const drawBreakMenu = (menu: BreakMenu, fb: Framebuffer, alpha: f64): void => {
  const view: View = menu.view
  viewFor(view, fb, 0.0, 0.0)
  const a: f64 = clamp(alpha, 0.0, 1.0)
  const time: f64 = Math.max(toF64(menu.tick - 1) + a, 0.0)
  gradient(view, BG_TOP, BG_BOTTOM)
  drawWall(menu, view, a)
  drawBall(menu, view, a)
  drawParticles(view, menu.sparks, a)
  drawLogo(menu, view, a, time)
  const fade: f64 = itemsFade(menu, time, a)
  if (menu.screen === SCREEN_SETTINGS) {
    drawSettings(menu, view, a, time)
  } else if (menu.screen === SCREEN_HOWTO) {
    drawHowTo(view, time)
  } else if (fade > 0.0) {
    drawTitle(menu, view, a, time, fade)
  }
  if (menu.screen === SCREEN_OUTRO) {
    drawWipe(view, toF64(menu.outroTick - 1) + a, time)
  }
  fillLetterbox(view, LETTERBOX)
}

/** How visible the title items are: they fade in after the logo lands and out as the outro starts. */
const itemsFade = (menu: BreakMenu, time: f64, alpha: f64): f64 => {
  const fadeIn: f64 = clamp((time - 50.0) / 30.0, 0.0, 1.0)
  if (menu.screen !== SCREEN_OUTRO) {
    return fadeIn
  }
  const out: f64 = clamp((toF64(menu.outroTick - 1) + alpha) / toF64(FADE_STEPS), 0.0, 1.0)
  return fadeIn * (1.0 - out)
}

/** A wall row's face: the rainbow, dimmed well back so the menu reads over it. */
const wallColour = (row: i32): i32 => dim(hue((toF64(row) / toF64(WALL_ROWS)) * 0.6 + 0.55), 0.3)

/** The attract wall: every brick there, and returning ones growing from their centre. */
const drawWall = (menu: BreakMenu, view: View, alpha: f64): void => {
  const n: i32 = Math.min(toI32(menu.wallAway.length), toI32(menu.wallAge.length))
  for (let i: i32 = 0; i < n; i++) {
    if (menu.wallAway[i] !== 0) {
      continue
    }
    const grown: f64 =
      menu.wallAge[i] >= GROW_STEPS
        ? 1.0
        : clamp((toF64(menu.wallAge[i] - 1) + alpha) / toF64(GROW_STEPS), 0.0, 1.0)
    if (grown <= 0.0) {
      continue
    }
    const size: f64 = outCubic(grown)
    const w: f64 = (WALL_BRICK_W - 1.0) * size
    const h: f64 = (WALL_BRICK_H - 1.0) * size
    const cx: f64 = (toF64(i % WALL_COLS) + 0.5) * WALL_BRICK_W
    const cy: f64 = WALL_TOP + (toF64(i / WALL_COLS) + 0.5) * WALL_BRICK_H
    bevelBrick(view, cx - w / 2.0, cy - h / 2.0, w, h, wallColour(i / WALL_COLS))
  }
}

/** The attract ball with its glow and trail (high effects only), at its interpolated position. */
const drawBall = (menu: BreakMenu, view: View, alpha: f64): void => {
  const x: f64 = lerp(menu.prevBallX, menu.ballX, alpha)
  const y: f64 = lerp(menu.prevBallY, menu.ballY, alpha)
  if (menu.settings.effects !== 0) {
    glow(view, x, y, 12.0, 0x705020, 0.6)
    drawTrail(view, menu.trail, BALL_R, 0xffc070, 0.45)
  }
  disc(view, x, y, BALL_R, BALL)
}

/**
 * A logo brick's colour: the rainbow along the logo's columns, drifting with
 * `time`, under a white band that sweeps across every few seconds.
 */
const logoColour = (column: i32, time: f64): i32 => {
  const base: i32 = hue(toF64(column) / 30.0 + time / 300.0)
  const x: f64 = toF64(column) * CELL_W
  const sweep: f64 = time * 1.8
  const band: f64 = sweep - Math.floor(sweep / 480.0) * 480.0 - 60.0
  const near: f64 = clamp(toF64(1) - Math.abs(x - band) / 28.0, 0.0, 1.0)
  return mix(base, WHITE, near * 0.75)
}

/** A logo brick's y on the title at `time`: dropping in with a bounce, then bobbing on a slow wave. */
const titleLogoY = (menu: BreakMenu, i: i32, time: f64): f64 => {
  const column: f64 = toF64(menu.columns[i])
  const drop: f64 = clamp((time - column * DROP_STAGGER) / DROP_STEPS, 0.0, 1.0)
  const bob: f64 = Math.sin(time * 0.045 - column * 0.35) * 1.2
  return menu.homeYs[i] - (1.0 - outBounce(drop)) * DROP_HEIGHT + bob * drop
}

/**
 * The logo: brick lettering where each cell gets at least 2 framebuffer
 * pixels, else the words as text. In the outro the bricks are where the step
 * put them; on the title they follow `titleLogoY`.
 */
const drawLogo = (menu: BreakMenu, view: View, alpha: f64, time: f64): void => {
  if (CELL_H * view.scale < 2.0) {
    drawSmallTitle(view, time)
    return
  }
  const n: i32 = logoSlots(menu)
  const outro: boolean = menu.screen === SCREEN_OUTRO
  for (let i: i32 = 0; i < n; i++) {
    const x: f64 = outro ? lerp(menu.prevXs[i], menu.xs[i], alpha) : menu.homeXs[i]
    const y: f64 = outro ? lerp(menu.prevYs[i], menu.ys[i], alpha) : titleLogoY(menu, i, time)
    bevelBrick(view, x, y, CELL_W - 0.5, CELL_H - 0.5, logoColour(menu.columns[i], time))
  }
}

/** The title as text, for a framebuffer too small for brick lettering, in the shimmer's colours. */
const drawSmallTitle = (view: View, time: f64): void => {
  const scale: i32 = Math.max(fontScaleFor(view, 14.0), 1)
  drawTextCentred(
    view,
    WORLD_W / 2.0,
    20.0,
    scale,
    "NISH BREAK",
    logoColour(toI32(time / 8.0) % 24, time),
    SHADOW
  )
}

/** The text scale for the menu's lines, or 0 when 7 world units are under 7 pixels and the compact layout applies. */
const lineScale = (view: View): i32 => fontScaleFor(view, 7.0)

/** The title items, the sliding highlight and the footer, faded by `fade`. */
const drawTitle = (menu: BreakMenu, view: View, alpha: f64, time: f64, fade: f64): void => {
  const scale: i32 = lineScale(view)
  const accent: i32 = hue(time / 400.0)
  if (scale < 1) {
    // Compact: the selected item alone, between arrows, where the list would be.
    drawTextCentred(view, WORLD_W / 2.0, 104.0, 1, "<", mix(BG_MID, MUTED, fade), NO_SHADOW)
    drawTextCentred(
      view,
      WORLD_W / 2.0,
      116.0,
      1,
      itemLabel(menu, menu.selected),
      mix(BG_MID, WHITE, fade),
      NO_SHADOW
    )
    drawTextCentred(view, WORLD_W / 2.0, 128.0, 1, ">", mix(BG_MID, MUTED, fade), NO_SHADOW)
    return
  }
  const y: f64 = lerp(menu.prevHighlightY, menu.highlightY, alpha)
  drawBar(view, y, 120.0, accent, fade)
  for (let i: i32 = 0; i < ITEM_COUNT; i++) {
    const colour: i32 = i === menu.selected ? WHITE : TEXT
    drawTextCentred(
      view,
      WORLD_W / 2.0,
      ITEM_TOP + toF64(i) * ITEM_GAP,
      scale,
      itemLabel(menu, i),
      mix(BG_MID, colour, fade),
      mix(BG_MID, SHADOW, fade)
    )
  }
  drawTextCentred(
    view,
    WORLD_W / 2.0,
    166.0,
    scale,
    "you found the wall.",
    mix(BG_MID, MUTED, fade),
    NO_SHADOW
  )
}

/**
 * The highlight behind the line whose text tops out at world `y`: a dark bar
 * `width` wide with a glowing accent stripe each side, faded by `fade`.
 */
const drawBar = (view: View, y: f64, width: f64, accent: i32, fade: f64): void => {
  const left: f64 = (WORLD_W - width) / 2.0
  blendRect(view, left, y - 2.0, width, 11.0, accent, 0.22 * fade)
  fillRect(view, left - 3.0, y - 2.0, 2.0, 11.0, mix(BG_MID, accent, fade))
  fillRect(view, left + width + 1.0, y - 2.0, 2.0, 11.0, mix(BG_MID, accent, fade))
}

/** Title item `i`'s label; Start level carries the level between arrows. */
const itemLabel = (menu: BreakMenu, i: i32): string => {
  if (i === ITEM_PLAY) {
    return "Play"
  }
  if (i === ITEM_LEVEL) {
    return levelLabel(menu.level)
  }
  if (i === ITEM_HOWTO) {
    return "How to play"
  }
  return i === ITEM_SETTINGS ? "Settings" : "Quit"
}

/** "Start level < n >" for each level, spelled out so a frame builds no string. */
const levelLabel = (level: i32): string => {
  if (level <= 1) {
    return "Start level  < 1 >"
  }
  if (level === 2) {
    return "Start level  < 2 >"
  }
  if (level === 3) {
    return "Start level  < 3 >"
  }
  if (level === 4) {
    return "Start level  < 4 >"
  }
  return level === 5 ? "Start level  < 5 >" : "Start level  < 6 >"
}

/** The dark panel Settings and How to play sit on, with a rainbow rule along its top. */
const drawPanel = (view: View, time: f64): void => {
  blendRect(view, PANEL_X, PANEL_Y, PANEL_W, PANEL_H, PANEL, 0.86)
  fillRect(view, PANEL_X, PANEL_Y, PANEL_W, 1.0, hue(time / 400.0))
}

/** The Settings rows, each `name < value >`, the highlight, and the selected row's hint at the foot. */
const drawSettings = (menu: BreakMenu, view: View, alpha: f64, time: f64): void => {
  drawPanel(view, time)
  const scale: i32 = lineScale(view)
  if (scale < 1) {
    // Compact: the selected row alone.
    drawTextCentred(view, WORLD_W / 2.0, 96.0, 1, rowName(menu.row), MUTED, NO_SHADOW)
    drawTextCentred(view, WORLD_W / 2.0, 112.0, 1, rowValue(menu.settings, menu.row), WHITE, NO_SHADOW)
    return
  }
  const accent: i32 = hue(time / 400.0)
  drawBar(view, lerp(menu.prevHighlightY, menu.highlightY, alpha), 240.0, accent, 1.0)
  for (let r: i32 = 0; r < ROW_COUNT; r++) {
    const y: f64 = ROW_TOP + toF64(r) * ROW_GAP
    const on: boolean = r === menu.row
    drawTextShadow(view, 48.0, y, scale, rowName(r), on ? WHITE : TEXT, SHADOW)
    if (r !== ROW_BACK) {
      const arrows: i32 = on ? accent : MUTED
      drawText(view, 196.0, y, scale, "<", arrows)
      drawTextCentred(view, 234.0, y, scale, rowValue(menu.settings, r), on ? WHITE : TEXT, SHADOW)
      drawText(view, 268.0, y, scale, ">", arrows)
    }
  }
  drawTextCentred(view, WORLD_W / 2.0, 160.0, scale, rowHint(menu.settings, menu.row), MUTED, NO_SHADOW)
}

/** Settings row `r`'s name, lower case like the rest of the menu's text. */
const rowName = (r: i32): string => {
  if (r === ROW_FPS) {
    return "frame rate"
  }
  if (r === ROW_RESOLUTION) {
    return "resolution"
  }
  if (r === ROW_GRAPHICS) {
    return "graphics"
  }
  if (r === ROW_SMOOTHING) {
    return "smoothing"
  }
  if (r === ROW_EFFECTS) {
    return "effects"
  }
  return r === ROW_STATS ? "stats" : "back"
}

/** Settings row `r`'s value as it reads on screen. */
export const rowValue = (settings: BreakSettings, r: i32): string => {
  if (r === ROW_FPS) {
    return fpsLabel(settings.fps)
  }
  if (r === ROW_RESOLUTION) {
    return resolutionLabel(settings.resolution)
  }
  if (r === ROW_GRAPHICS) {
    return graphicsLabel(graphicsSlot(settings.graphics))
  }
  if (r === ROW_SMOOTHING) {
    return settings.smoothing ? "on" : "off"
  }
  if (r === ROW_EFFECTS) {
    return settings.effects === 0 ? "low" : "high"
  }
  if (r === ROW_STATS) {
    return settings.stats ? "on" : "off"
  }
  return ""
}

/** The frame rate at choice `i` as text. */
const fpsLabel = (i: i32): string => {
  const fps: i32 = fpsChoice(i)
  if (fps === 0) {
    return "auto"
  }
  if (fps === 30) {
    return "30"
  }
  if (fps === 60) {
    return "60"
  }
  return fps === 120 ? "120" : "240"
}

/** The resolution at choice `i` as text. */
const resolutionLabel = (i: i32): string => {
  const lines: i32 = resolutionChoice(i)
  if (lines === 270) {
    return "270p"
  }
  if (lines === 360) {
    return "360p"
  }
  if (lines === 540) {
    return "540p"
  }
  return lines === 720 ? "720p" : "1080p"
}

/** The graphics at Settings slot `slot` as text. */
const graphicsLabel = (slot: i32): string => {
  if (slot === 1) {
    return "kitty"
  }
  if (slot === 2) {
    return "sixel"
  }
  if (slot === 3) {
    return "half-block"
  }
  return slot === 4 ? "ascii" : "auto"
}

/** One line on what row `r`'s setting trades, for the foot of the panel. */
export const rowHint = (settings: BreakSettings, r: i32): string => {
  if (r === ROW_FPS) {
    return settings.fps <= 0
      ? "adaptive: up to 120, less when it must"
      : "fixed rates turn the adaptive controller off"
  }
  if (r === ROW_RESOLUTION) {
    return "the largest frame; a slow terminal gets less"
  }
  if (r === ROW_GRAPHICS) {
    return settings.graphics < 0 ? "the best the terminal answers for" : "forced, if the terminal can show it"
  }
  if (r === ROW_SMOOTHING) {
    return settings.smoothing ? "frames blend between steps" : "every frame shows a whole step"
  }
  if (r === ROW_EFFECTS) {
    return settings.effects === 0 ? "no glow, no trails, fewer sparks" : "glow, trails and every spark"
  }
  if (r === ROW_STATS) {
    return "frame rate and backend in a corner"
  }
  return "frame rate and graphics reopen the terminal"
}

/** The how-to-play overlay: the controls, then the power-up capsules with what each does. */
const drawHowTo = (view: View, time: f64): void => {
  drawPanel(view, time)
  const scale: i32 = Math.max(lineScale(view), 1)
  // In the compact layout a line is taller than its world slot, so the lines spread to fit.
  const step: f64 = view.scale > 0.0 ? Math.max((toF64(scale) * 9.0) / view.scale, 10.0) : 10.0
  let y: f64 = PANEL_Y + 6.0
  drawTextCentred(view, WORLD_W / 2.0, y, scale, "how to play", WHITE, SHADOW)
  y = y + step
  drawTextCentred(view, WORLD_W / 2.0, y, scale, "<- -> or A D   move the paddle", TEXT, SHADOW)
  y = y + step
  drawTextCentred(view, WORLD_W / 2.0, y, scale, "space or up    launch the ball", TEXT, SHADOW)
  y = y + step
  drawTextCentred(view, WORLD_W / 2.0, y, scale, "p   pause      q   quit, paused", TEXT, SHADOW)
  y = y + step + 2.0
  drawTextCentred(view, WORLD_W / 2.0, y, scale, "catch the capsules that fall:", MUTED, NO_SHADOW)
  y = y + step + 2.0
  for (let k: i32 = 0; k < 6; k++) {
    drawCapsule(view, toF64(k) * 44.0 + 50.0, y, scale, k, time)
  }
  drawTextCentred(view, WORLD_W / 2.0, y + step * 2.0 + 2.0, scale, "esc to go back", MUTED, NO_SHADOW)
}

/**
 * Power-up `k` as the game drops it: a lettered capsule centred on world `cx`
 * with its top at `y`, bobbing a little out of step with its neighbours, and
 * its name under it.
 */
const drawCapsule = (view: View, cx: f64, y: f64, scale: i32, k: i32, time: f64): void => {
  const colour: i32 = hue(toF64(k) / 6.0)
  const bob: f64 = Math.sin(time * 0.06 + toF64(k)) * 1.0
  const top: f64 = y + bob
  disc(view, cx - 7.0, top + 4.0, 4.0, colour)
  disc(view, cx + 7.0, top + 4.0, 4.0, colour)
  fillRect(view, cx - 7.0, top, 14.0, 8.0, colour)
  drawTextCentred(
    view,
    cx,
    top + 0.5,
    scale,
    capsuleLetter(k),
    SHADOW,
    NO_SHADOW
  )
  drawTextCentred(view, cx, y + 12.0, scale, capsuleName(k), TEXT, NO_SHADOW)
}

/** Power-up `k`'s letter on its capsule. */
const capsuleLetter = (k: i32): string => {
  if (k === 0) {
    return "W"
  }
  if (k === 1) {
    return "M"
  }
  if (k === 2) {
    return "S"
  }
  if (k === 3) {
    return "C"
  }
  return k === 4 ? "F" : "L"
}

/** What power-up `k` does, in a word. */
const capsuleName = (k: i32): string => {
  if (k === 0) {
    return "wide"
  }
  if (k === 1) {
    return "multi"
  }
  if (k === 2) {
    return "slow"
  }
  if (k === 3) {
    return "catch"
  }
  return k === 4 ? "fire" : "life"
}

/**
 * The outro's wipe at outro time `t` (in steps): from `WIPE_FROM` a dark sheet
 * comes down from the top with a bright edge, covering the world by the
 * outro's last drawn frame.
 */
const drawWipe = (view: View, t: f64, time: f64): void => {
  const f: f64 = clamp((t - toF64(WIPE_FROM)) / toF64(OUTRO_STEPS - 1 - WIPE_FROM), 0.0, 1.0)
  if (f <= 0.0) {
    return
  }
  const edge: f64 = outCubic(f) * (WORLD_H + 2.0)
  fillRect(view, -1.0, -1.0, WORLD_W + 2.0, edge + 1.0, WIPE)
  if (f < 1.0) {
    fillRect(view, -1.0, edge - 1.0, WORLD_W + 2.0, 1.5, hue(time / 400.0))
  }
}
