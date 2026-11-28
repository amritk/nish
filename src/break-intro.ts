// The intro of `nish break`: the help it hides in comes apart into the title
// card. The help's opening lines are drawn as the terminal shows them, in
// their colours, with the brick rule under the title and its one missing
// brick. The missing brick drops into its gap, then every word and brick of
// the help falls away, a wall is laid across the screen course by course from
// the bottom up, and all but the menu's own six rows of it fall out, leaving
// the scene `break-menu.ts` opens on, whose logo then drops in.
//
// Like the menu it is pure: `stepBreakIntro` reads one step of input and
// answers whether the intro goes on, `drawBreakIntro` paints a framebuffer,
// and neither touches the terminal. Every array is made in `newBreakIntro`
// and reused, and anything that moves is drawn at `lerp(previous, current,
// alpha)`, as in the menu and the game.

import { Framebuffer } from "nish/term-pixels"
import { ACTION_PRESS, EVENT_KEY, KEY_CHAR, KEY_ESCAPE } from "nish/term"
import { StepInput } from "../std/input"
import {
  STEPS_PER_SECOND,
  View,
  WORLD_H,
  bevelBrick,
  clamp,
  drawParticles,
  drawText,
  fillLetterbox,
  glow,
  gradient,
  lerp,
  outBounce,
  outCubic,
  stepParticles,
  viewFor,
} from "./break-gfx"
import {
  RASTER_GLYPH_ADVANCE,
  RASTER_GLYPH_H,
  RasterParticles,
  rasterMix,
  rasterSpawnParticle,
} from "../std/raster"
import {
  BG_BOTTOM,
  BG_TOP,
  LETTERBOX,
  WALL_BRICK_H,
  WALL_BRICK_W,
  WALL_COLS,
  WALL_ROWS,
  WALL_TOP,
  wallColour,
} from "./break-menu"
import { SOUND_CLEAR, SOUND_STEEL, SOUND_WALL } from "./break-game"

// ---- The interface the director reads ---------------------------------------

/** `stepBreakIntro`'s answer while the intro goes on. */
export const INTRO_PLAYING: i32 = 0

/** `stepBreakIntro`'s answer once the title card is all that is left, or a key skipped to it. */
export const INTRO_DONE: i32 = 1

/** `stepBreakIntro`'s answer when the player pressed q or Esc. */
export const INTRO_QUIT: i32 = -1

// ---- The help as drawn ------------------------------------------------------

/** The help lines drawn: as many as fill the world at `LINE_H`. */
export const INTRO_LINES: i32 = 30

/** A column and a line of the help in world units: 80 columns fill the world's width. */
const COL_W: f64 = 4.0
const LINE_H: f64 = 6.0

/** Where the help's first column and first line start. */
const TEXT_X: f64 = 1.0
const TEXT_Y: f64 = 0.0

/** The columns of a help line cut into pieces: far more than the 80 the world shows. */
const CUT_COLUMNS: i32 = 1024

/** The colours the help's SGR codes stand for: the terminal's plain text, bold, faint, and the theme's three. */
const PLAIN: i32 = 0xd8d4f0
const BOLD: i32 = 0xf4f2ff
const FAINT: i32 = 0x7c7898
const MAGENTA: i32 = 0xe070f0
const CYAN: i32 = 0x58d8e8
const YELLOW: i32 = 0xf0cc58

/** The missing brick, which glows as it drops into its gap. */
const GAP_BRICK: i32 = 0xffd070

/** The terminal's dark the help sits on before the title's background fades in. */
const TERMINAL: i32 = 0x05040c

/** A piece's kinds: a run of text in one colour, or a run of `▀` drawn as a brick. */
const PIECE_TEXT: i32 = 0
const PIECE_BRICK: i32 = 1

// ---- The timeline, in steps -------------------------------------------------

/** The missing brick starts its drop, and the steps it takes to land. */
const GAP_FROM: i32 = 30
const GAP_STEPS: i32 = 36

/** The step the missing brick first touches down: `outBounce` lands at 1 / 2.75 of its drop. */
const GAP_CONTACT: i32 = GAP_FROM + 14

/** How far above its gap the missing brick starts. */
const GAP_HEIGHT: f64 = 40.0

/** The help starts to fall, bottom lines first, each piece up to `COLLAPSE_JITTER` steps late. */
const COLLAPSE_FROM: i32 = 84
const COLLAPSE_JITTER: i32 = 18

/** The steps over which the terminal's dark gives way to the title's background. */
const FADE_STEPS: i32 = 60

/** The first brick of the wall is laid, each course from the bottom up this many steps after the last. */
const SWEEP_FROM: i32 = 126
const COURSE_STEPS: i32 = 4

/** A brick's steps to slide into place, and how far it slides from. */
const LAY_STEPS: i32 = 10
const LAY_SLIDE: f64 = 24.0

/** The bricks below the menu's wall start to fall, bottom courses first, each up to `CLEAR_JITTER` steps late. */
const CLEAR_FROM: i32 = 256
const CLEAR_JITTER: i32 = 8

/** The longest the intro runs, whatever the falling bricks are doing: 5 s. */
const INTRO_MAX_STEPS: i32 = 600

/** Gravity on the help's falling pieces, and on the wall's, in world units a second squared. */
const FALL_GRAVITY: f64 = 540.0
const CLEAR_GRAVITY: f64 = 720.0

/** The courses the wall is laid in: enough to reach the bottom of the world. */
const SWEEP_ROWS: i32 = 22

/** The sparks alive at once. */
const SPARK_CAPACITY: i32 = 48

/** The intro: the help in pieces, the wall laid over the screen, and the clock both run on. */
export class BreakIntro {
  /** Each piece's world position now and a step ago, velocity, and width in columns. */
  xs: f64[]
  ys: f64[]
  prevXs: f64[]
  prevYs: f64[]
  vxs: f64[]
  vys: f64[]
  /** Each piece's text (empty for a brick), kind, colour, help line and the step it falls from. */
  texts: string[]
  kinds: i32[]
  colours: i32[]
  widths: i32[]
  lines: integer<0, 29>[]
  releases: i32[]

  /** Each wall brick's x now and a step ago, its y now and a step ago, velocity, and the steps it is laid and comes loose at (0 for never). */
  wallXs: f64[]
  wallPrevXs: f64[]
  wallYs: f64[]
  wallPrevYs: f64[]
  wallVxs: f64[]
  wallVys: f64[]
  wallLaid: i32[]
  wallReleases: i32[]

  /** The sounds this step asks for, as the game's `SOUND_*`; cleared at the top of each step. */
  sounds: i32[]
  sparks: RasterParticles
  /** The view `drawBreakIntro` reuses, so a frame allocates none. */
  view: View

  // The 32-bit fields last.
  /** Steps since the intro started. */
  tick: i32
  /** The piece the missing brick is, or -1 when the help's rule has no gap. */
  gap: i32
  /** The menu's effects setting, 0 low and 1 high; the director sets it each step. */
  effects: i32
  /** The xorshift state the falls' dice read; never 0. */
  rngState: i32

  /** An intro with no pieces yet; `newBreakIntro` is the way to make one. */
  constructor(seed: i32) {
    this.xs = []
    this.ys = []
    this.prevXs = []
    this.prevYs = []
    this.vxs = []
    this.vys = []
    this.texts = []
    this.kinds = []
    this.colours = []
    this.widths = []
    this.lines = []
    this.releases = []
    this.wallXs = []
    this.wallPrevXs = []
    this.wallYs = []
    this.wallPrevYs = []
    this.wallVxs = []
    this.wallVys = []
    this.wallLaid = []
    this.wallReleases = []
    this.sounds = []
    this.sparks = new RasterParticles(SPARK_CAPACITY)
    this.view = new View()
    this.tick = 0
    this.gap = -1
    this.effects = 1
    this.rngState = seed === 0 ? 0x2545f491 : seed
  }
}

/**
 * An intro over `help`, the text `--help` prints with its SGR colours in: its
 * first `INTRO_LINES` lines are cut into pieces, the missing brick of its
 * rule is found, and every fall and every brick of the wall is scheduled.
 */
export const newBreakIntro = (help: string, seed: i64): BreakIntro => {
  const low: i32 = toI32(seed & toI64(0x7fffffff))
  const high: i32 = toI32((seed >> toI64(31)) & toI64(0x7fffffff))
  const intro: BreakIntro = new BreakIntro(low ^ high)
  introCutHelp(intro, help)
  introFindGap(intro)
  introScheduleCollapse(intro)
  introScheduleWall(intro)
  return intro
}

/**
 * A number in [0, `sides`) from xorshift32, as the menu draws its dice, or 0
 * for a die with no sides. Every die the intro rolls has at most 256 sides.
 */
const introRoll = (intro: BreakIntro, sides: i32): i32 => {
  let x: i32 = intro.rngState
  x = x ^ (x << 13)
  x = x ^ (x >>> 17)
  x = x ^ (x << 5)
  intro.rngState = x
  if (sides <= 0) {
    return 0
  }
  const r: i32 = x % sides
  const k: i32 = r < 0 ? r + sides : r
  // `k` is below `sides`, so for the dice the intro rolls the test never
  // fails; it is what bounds the answer for the sums its callers make.
  if (k < 0 || k > 255) {
    return 0
  }
  return k
}

/** A number in [`lo`, `hi`], both ends included. */
const introRandom = (intro: BreakIntro, lo: integer<-100, 100>, hi: integer<-100, 100>): i32 =>
  lo + introRoll(intro, hi - lo + 1)

// ---- Cutting the help -------------------------------------------------------

/** The colour one SGR parameter `v` leaves the text in, from the colour before it. */
const introSgrParam = (v: i32, colour: i32): i32 => {
  if (v === 0) {
    return PLAIN
  }
  if (v === 1) {
    return colour === PLAIN ? BOLD : colour
  }
  if (v === 2) {
    return FAINT
  }
  if (v === 33) {
    return YELLOW
  }
  if (v === 35) {
    return MAGENTA
  }
  if (v === 36) {
    return CYAN
  }
  return colour
}

/** The colour an SGR parameter list leaves the text in, from the colour and boldness before it. */
const introSgrColour = (params: string, colour: i32): i32 => {
  let out: i32 = colour
  let value: i32 = 0
  let digits: boolean = false
  for (let i: i32 = 0; i < params.length; i++) {
    const c: i32 = params.charCodeAt(i)
    if (c >= 48 && c <= 57) {
      // No parameter the help is read for has more than two digits, so a
      // longer one stops growing rather than overflowing and matches none.
      if (value >= 0 && value < 100000) {
        value = value * 10 + (c - 48)
      }
      digits = true
      continue
    }
    if (c !== 59) {
      continue
    }
    out = introSgrParam(digits ? value : 0, out)
    value = 0
    digits = false
  }
  // The list ends a parameter the way a `;` does.
  return introSgrParam(digits ? value : 0, out)
}

/** Add a piece: `text` (empty for a brick) at `column` of `line`, `width` columns wide, raised `lift` above it. */
const introAddPiece = (
  intro: BreakIntro,
  kind: i32,
  text: string,
  colour: i32,
  line: integer<0, 29>,
  column: i32,
  width: i32,
  lift: f64
): void => {
  const x: f64 = TEXT_X + toF64(column) * COL_W
  const y: f64 = TEXT_Y + toF64(line) * LINE_H - lift
  intro.xs.push(x)
  intro.ys.push(y)
  intro.prevXs.push(x)
  intro.prevYs.push(y)
  const still: f64 = 0.0
  intro.vxs.push(still)
  intro.vys.push(still)
  intro.texts.push(text)
  intro.kinds.push(kind)
  intro.colours.push(colour)
  intro.widths.push(width)
  intro.lines.push(line)
  intro.releases.push(0)
}

/** Whether `help` holds `▀` (E2 96 80 in UTF-8) at byte `i`. */
const introUpperHalfAt = (help: string, i: i32): boolean =>
  i >= 0 &&
  i < toI32(help.length) - 2 &&
  help.charCodeAt(i) === 0xe2 &&
  help.charCodeAt(i + 1) === 0x96 &&
  help.charCodeAt(i + 2) === 0x80

/**
 * Cut the first `INTRO_LINES` lines of `help` into pieces: each run of
 * non-blank text in one colour becomes a text piece, each run of `▀` a brick,
 * placed at the column the terminal shows it in. An SGR escape changes the
 * colour and takes no column; any other UTF-8 character takes one.
 */
const introCutHelp = (intro: BreakIntro, help: string): void => {
  let line: i32 = 0
  let column: i32 = 0
  let colour: i32 = PLAIN
  let i: i32 = 0
  while (i >= 0 && i < help.length && line < INTRO_LINES) {
    const c: i32 = help.charCodeAt(i)
    if (c === 10) {
      line++
      column = 0
      i++
      continue
    }
    if (c === 27 && i < help.length - 1 && help.charCodeAt(i + 1) === 91) {
      let end: i32 = i + 2
      while (end < help.length && help.charCodeAt(end) !== 109 && help.charCodeAt(end) !== 10) {
        end++
      }
      if (end < help.length && help.charCodeAt(end) === 109) {
        colour = introSgrColour(help.substring(i + 2, end), colour)
        i = end + 1
      } else {
        i = end
      }
      continue
    }
    // Past `CUT_COLUMNS` a line is far off the world's right edge and is never
    // seen, so its text is passed over; its escapes above still set the colour.
    if (column < 0 || column >= CUT_COLUMNS) {
      i++
      continue
    }
    if (c === 32) {
      column++
      i++
      continue
    }
    if (introUpperHalfAt(help, i)) {
      const from: i32 = column
      while (column < CUT_COLUMNS && i >= 0 && i < help.length - 2 && introUpperHalfAt(help, i)) {
        column++
        i = i + 3
      }
      introAddPiece(intro, PIECE_BRICK, "", colour, line, from, column - from, 0.0)
      continue
    }
    const start: i32 = i
    const from: i32 = column
    while (i < help.length && column < CUT_COLUMNS) {
      const d: i32 = help.charCodeAt(i)
      if (d === 10 || d === 32 || d === 27 || introUpperHalfAt(help, i)) {
        break
      }
      // A UTF-8 continuation byte belongs to the character before it and takes no column.
      if ((d & 0xc0) !== 0x80) {
        column++
      }
      i++
    }
    introAddPiece(intro, PIECE_TEXT, help.substring(start, i), colour, line, from, column - from, 0.0)
  }
}

/**
 * Find the rule's missing brick: the first place two bricks on a line stand
 * a brick and a gap further apart than their neighbours, and add a brick
 * there, to drop in. It stays -1 when no rule has a gap.
 */
const introFindGap = (intro: BreakIntro): void => {
  const n: i32 = toI32(intro.kinds.length)
  // Every piece array is as long as `kinds`; the loop reads all four it uses.
  for (
    let i: i32 = 1;
    i < intro.kinds.length && i < intro.lines.length && i < intro.widths.length && i < intro.xs.length;
    i++
  ) {
    const line: integer<0, 29> = intro.lines[i]
    if (intro.kinds[i] !== PIECE_BRICK || intro.kinds[i - 1] !== PIECE_BRICK || line !== intro.lines[i - 1]) {
      continue
    }
    const width: i32 = intro.widths[i - 1]
    const end: f64 = intro.xs[i - 1] + toF64(width) * COL_W
    const space: i32 = toI32(Math.round((intro.xs[i] - end) / COL_W))
    // A piece is never wider than the columns cut, so `width + 2` fits.
    if (width > 0 && width <= CUT_COLUMNS && space >= width + 2) {
      const column: i32 = toI32(Math.round((end - TEXT_X) / COL_W) + 1.0)
      introAddPiece(intro, PIECE_BRICK, "", GAP_BRICK, line, column, width, GAP_HEIGHT)
      intro.gap = n
      return
    }
  }
}

/** Give every piece the step it falls from, bottom lines first, and the kick it falls with. */
const introScheduleCollapse = (intro: BreakIntro): void => {
  // Every piece array is as long as `releases`; the loop reads all four it uses.
  for (
    let i: i32 = 0;
    i < intro.releases.length && i < intro.lines.length && i < intro.vxs.length && i < intro.vys.length;
    i++
  ) {
    const line: integer<0, 29> = intro.lines[i]
    const fromBottom: i32 = INTRO_LINES - 1 - line
    intro.releases[i] = COLLAPSE_FROM + fromBottom + introRoll(intro, COLLAPSE_JITTER + 1)
    intro.vxs[i] = toF64(introRandom(intro, -40, 40))
    intro.vys[i] = -toF64(introRandom(intro, 10, 70))
  }
}

/**
 * Give every wall brick its home, the step it is laid (courses from the bottom
 * up, each one laid the other way from the last), and, below the menu's six
 * rows, the step it comes loose and the kick it falls with.
 */
const introScheduleWall = (intro: BreakIntro): void => {
  // The bricks are pushed in index order, `row * WALL_COLS + col`.
  for (let row: i32 = 0; row < SWEEP_ROWS; row++) {
    const course: i32 = SWEEP_ROWS - 1 - row
    for (let col: i32 = 0; col < WALL_COLS; col++) {
      const x: f64 = toF64(col) * WALL_BRICK_W
      const y: f64 = WALL_TOP + toF64(row) * WALL_BRICK_H
      intro.wallXs.push(x)
      intro.wallPrevXs.push(x)
      intro.wallYs.push(y)
      intro.wallPrevYs.push(y)
      const start: i32 = SWEEP_FROM + course * COURSE_STEPS
      intro.wallLaid.push(course % 2 === 0 ? start + (col * 3) / 2 : start + ((WALL_COLS - 1 - col) * 3) / 2)
      if (row >= WALL_ROWS) {
        intro.wallReleases.push(CLEAR_FROM + (course * 3) / 2 + introRoll(intro, CLEAR_JITTER + 1))
        intro.wallVxs.push(toF64(introRandom(intro, -25, 25)))
        intro.wallVys.push(-toF64(introRandom(intro, 0, 30)))
      } else {
        const still: f64 = 0.0
        intro.wallReleases.push(0)
        intro.wallVxs.push(still)
        intro.wallVys.push(still)
      }
    }
  }
}

// ---- Stepping ---------------------------------------------------------------

/**
 * One step: q or Esc quits, any other key skips to the title, and otherwise
 * the missing brick drops, the help falls, the wall is laid and its lower
 * courses fall out. Answers `INTRO_DONE` once nothing is left in the air.
 */
export const stepBreakIntro = (intro: BreakIntro, input: StepInput): i32 => {
  intro.sounds = []
  for (const e of input.events) {
    if (e.type !== EVENT_KEY || e.action !== ACTION_PRESS) {
      continue
    }
    if (e.key === KEY_ESCAPE || (e.key === KEY_CHAR && (e.code === 113 || e.code === 81))) {
      return INTRO_QUIT
    }
    return INTRO_DONE
  }
  // The clock stops where the intro ends at the latest: every step past it
  // answers `INTRO_DONE` and moves the pieces just as a later tick would.
  const last: i32 = intro.tick
  if (last >= 0 && last < INTRO_MAX_STEPS) {
    intro.tick = last + 1
  }
  const t: i32 = intro.tick
  introStepGap(intro, t)
  const pieces: boolean = introStepPieces(intro, t)
  const wall: boolean = introStepWall(intro, t)
  stepParticles(intro.sparks, 200.0, 1.5)
  if (t === SWEEP_FROM + (SWEEP_ROWS - 1) * COURSE_STEPS + ((WALL_COLS - 1) * 3) / 2 + LAY_STEPS) {
    intro.sounds.push(SOUND_CLEAR)
  }
  if (t >= INTRO_MAX_STEPS || (t > CLEAR_FROM && !pieces && !wall)) {
    return INTRO_DONE
  }
  return INTRO_PLAYING
}

/** The missing brick's drop into its gap, bouncing, with a puff of sparks and a clink where it first lands. */
const introStepGap = (intro: BreakIntro, t: i32): void => {
  const g: i32 = intro.gap
  // One step past the landing, so the step a moment ago is home too and a draw holds it still.
  // The clock never runs below 0, so `t < 0` never returns; it bounds `t - GAP_FROM` below.
  if (g < 0 || t < 0 || t > GAP_FROM + GAP_STEPS + 1) {
    return
  }
  // `gap` is always a piece, so this test never fails; it proves the reads below.
  if (
    g >= intro.lines.length ||
    g >= intro.ys.length ||
    g >= intro.prevYs.length ||
    g >= intro.xs.length ||
    g >= intro.widths.length
  ) {
    return
  }
  const home: f64 = TEXT_Y + toF64(intro.lines[g]) * LINE_H
  const drop: f64 = clamp(toF64(t - GAP_FROM) / toF64(GAP_STEPS), 0.0, 1.0)
  intro.prevYs[g] = intro.ys[g]
  intro.ys[g] = home - (1.0 - outBounce(drop)) * GAP_HEIGHT
  if (t === GAP_CONTACT) {
    // Read before the push, which ends what the checker knows of every array's length.
    const cx: f64 = intro.xs[g] + (toF64(intro.widths[g]) * COL_W) / 2.0
    intro.sounds.push(SOUND_STEEL)
    const count: i32 = intro.effects === 0 ? 3 : 10
    for (let k: i32 = 0; k < count; k++) {
      const vx: f64 = toF64(introRandom(intro, -60, 60))
      const vy: f64 = toF64(introRandom(intro, -70, -10))
      rasterSpawnParticle(intro.sparks, cx, home, vx, vy, 0.5, 1.2, GAP_BRICK)
    }
  }
}

/** Every falling piece's step under gravity; answers whether any piece is still on screen. */
const introStepPieces = (intro: BreakIntro, t: i32): boolean => {
  const dt: f64 = 1.0 / toF64(STEPS_PER_SECOND)
  let left: boolean = false
  // Every piece array is as long as `releases`; the loop reads all seven it uses.
  for (
    let i: i32 = 0;
    i < intro.releases.length &&
    i < intro.xs.length &&
    i < intro.ys.length &&
    i < intro.prevXs.length &&
    i < intro.prevYs.length &&
    i < intro.vxs.length &&
    i < intro.vys.length;
    i++
  ) {
    if (intro.ys[i] > WORLD_H) {
      continue
    }
    left = true
    if (t < intro.releases[i]) {
      continue
    }
    intro.prevXs[i] = intro.xs[i]
    intro.prevYs[i] = intro.ys[i]
    intro.vys[i] = intro.vys[i] + FALL_GRAVITY * dt
    intro.xs[i] = intro.xs[i] + intro.vxs[i] * dt
    intro.ys[i] = intro.ys[i] + intro.vys[i] * dt
  }
  return left
}

/**
 * Every wall brick below the menu's rows falling once it is loose, and a
 * course's clack as its first brick lands; answers whether any loose brick
 * is still on screen.
 */
const introStepWall = (intro: BreakIntro, t: i32): boolean => {
  // The clock never runs below 0, so this never returns; it bounds `t - LAY_STEPS` below.
  if (t < 0) {
    return false
  }
  const dt: f64 = 1.0 / toF64(STEPS_PER_SECOND)
  let left: boolean = false
  // The clacks are pushed after the loop, as a push ends what the checker
  // knows of every array's length; nothing else in the loop makes a sound,
  // so the step's sounds come out in the same order.
  let clacks: i32 = 0
  // Every wall array is as long as `wallReleases`; the loop reads all eight.
  for (
    let i: i32 = 0;
    i < intro.wallReleases.length &&
    i < intro.wallLaid.length &&
    i < intro.wallXs.length &&
    i < intro.wallYs.length &&
    i < intro.wallPrevXs.length &&
    i < intro.wallPrevYs.length &&
    i < intro.wallVxs.length &&
    i < intro.wallVys.length;
    i++
  ) {
    // A course's first brick starts one of the wall's `SWEEP_ROWS` rows, so
    // `clacks < SWEEP_ROWS` never fails; it bounds the count.
    if (t - LAY_STEPS === intro.wallLaid[i] && i % WALL_COLS === 0 && clacks < SWEEP_ROWS) {
      clacks++
    }
    if (intro.wallReleases[i] === 0 || intro.wallYs[i] > WORLD_H) {
      continue
    }
    left = true
    if (t < intro.wallReleases[i]) {
      continue
    }
    intro.wallPrevXs[i] = intro.wallXs[i]
    intro.wallPrevYs[i] = intro.wallYs[i]
    intro.wallVys[i] = intro.wallVys[i] + CLEAR_GRAVITY * dt
    intro.wallXs[i] = intro.wallXs[i] + intro.wallVxs[i] * dt
    intro.wallYs[i] = intro.wallYs[i] + intro.wallVys[i] * dt
  }
  for (let k: i32 = 0; k < clacks; k++) {
    intro.sounds.push(SOUND_WALL)
  }
  return left
}

// ---- Drawing ----------------------------------------------------------------

/**
 * The intro as it stands `alpha` of the way from the last step to the next,
 * into `fb`: the background fading from the terminal's dark to the title's,
 * the wall as laid so far, then the help's pieces and the sparks over it.
 */
export const drawBreakIntro = (intro: BreakIntro, fb: Framebuffer, alpha: f64): void => {
  const view: View = intro.view
  viewFor(view, fb, 0.0, 0.0)
  const a: f64 = clamp(alpha, 0.0, 1.0)
  const time: f64 = Math.max(toF64(intro.tick) - 1.0 + a, 0.0)
  const fade: f64 = clamp((time - toF64(COLLAPSE_FROM)) / toF64(FADE_STEPS), 0.0, 1.0)
  gradient(view, rasterMix(TERMINAL, BG_TOP, fade), rasterMix(TERMINAL, BG_BOTTOM, fade))
  introDrawWall(intro, view, a, time)
  introDrawPieces(intro, view, a)
  drawParticles(view, intro.sparks, a)
  fillLetterbox(view, LETTERBOX)
}

/**
 * The wall as laid by `time`: each brick slides in from the side its course
 * is laid from, out of the background into its row's colour, and the menu's
 * own six rows end where `break-menu.ts` draws them.
 */
const introDrawWall = (intro: BreakIntro, view: View, alpha: f64, time: f64): void => {
  // Every wall array is as long as `wallLaid`; the loop reads all five it uses.
  for (
    let i: i32 = 0;
    i < intro.wallLaid.length &&
    i < intro.wallXs.length &&
    i < intro.wallYs.length &&
    i < intro.wallPrevXs.length &&
    i < intro.wallPrevYs.length;
    i++
  ) {
    const laid: f64 = clamp((time - toF64(intro.wallLaid[i])) / toF64(LAY_STEPS), 0.0, 1.0)
    if (laid <= 0.0) {
      continue
    }
    const row: i32 = i / WALL_COLS
    const y: f64 = lerp(intro.wallPrevYs[i], intro.wallYs[i], alpha)
    if (y > WORLD_H) {
      continue
    }
    // The course, `SWEEP_ROWS - 1 - row`, is even exactly when the row is odd,
    // as `SWEEP_ROWS` is even; the row's parity needs no subtraction to bound.
    const side: f64 = row % 2 === 1 ? -1.0 : 1.0
    const settled: f64 = outCubic(laid)
    const x: f64 = lerp(intro.wallPrevXs[i], intro.wallXs[i], alpha) + side * (1.0 - settled) * LAY_SLIDE
    const colour: i32 = rasterMix(BG_TOP, wallColour(row), settled)
    bevelBrick(view, x + 0.5, y + 0.5, WALL_BRICK_W - 1.0, WALL_BRICK_H - 1.0, colour)
  }
}

/**
 * The help's pieces still on screen: text in the font at the largest scale
 * whose glyph steps fit a column, bricks as the top half of their line, and
 * the missing brick with a glow while it drops.
 */
const introDrawPieces = (intro: BreakIntro, view: View, alpha: f64): void => {
  const scale: i32 = Math.max(
    toI32(Math.floor((COL_W * view.scale) / toF64(RASTER_GLYPH_ADVANCE) + 0.000001)),
    1
  )
  const lift: f64 = (LINE_H - (toF64(RASTER_GLYPH_H) * toF64(scale)) / view.scale) / 2.0
  // Every piece array is as long as `kinds`; the loop reads all eight it uses.
  for (
    let i: i32 = 0;
    i < intro.kinds.length &&
    i < intro.xs.length &&
    i < intro.ys.length &&
    i < intro.prevXs.length &&
    i < intro.prevYs.length &&
    i < intro.texts.length &&
    i < intro.colours.length &&
    i < intro.widths.length;
    i++
  ) {
    const y: f64 = lerp(intro.prevYs[i], intro.ys[i], alpha)
    if (y > WORLD_H) {
      continue
    }
    const x: f64 = lerp(intro.prevXs[i], intro.xs[i], alpha)
    if (intro.kinds[i] === PIECE_TEXT) {
      drawText(view, x, y + lift, scale, intro.texts[i], intro.colours[i])
      continue
    }
    const w: f64 = toF64(intro.widths[i]) * COL_W - 0.5
    if (i === intro.gap && intro.effects !== 0) {
      glow(view, x + w / 2.0, y + LINE_H / 4.0, 10.0, 0x604010, 0.7)
    }
    bevelBrick(view, x, y + 0.5, w, LINE_H / 2.0 - 0.5, intro.colours[i])
  }
}
