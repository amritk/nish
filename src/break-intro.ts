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
import { TermInput } from "nish/term-io"
import {
  GLYPH_ADVANCE,
  GLYPH_H,
  Particles,
  STEPS_PER_SECOND,
  View,
  WORLD_H,
  bevelBrick,
  clamp,
  drawParticles,
  drawText,
  fillLetterbox,
  gfxMix,
  glow,
  gradient,
  lerp,
  outBounce,
  outCubic,
  spawnParticle,
  stepParticles,
  viewFor,
} from "./break-gfx"
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
  lines: i32[]
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
  sparks: Particles
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
    const bricks: i32 = WALL_COLS * SWEEP_ROWS
    this.wallXs = new Array<f64>(bricks)
    this.wallXs.fill(0.0)
    this.wallPrevXs = new Array<f64>(bricks)
    this.wallPrevXs.fill(0.0)
    this.wallYs = new Array<f64>(bricks)
    this.wallYs.fill(0.0)
    this.wallPrevYs = new Array<f64>(bricks)
    this.wallPrevYs.fill(0.0)
    this.wallVxs = new Array<f64>(bricks)
    this.wallVxs.fill(0.0)
    this.wallVys = new Array<f64>(bricks)
    this.wallVys.fill(0.0)
    this.wallLaid = new Array<i32>(bricks)
    this.wallLaid.fill(0)
    this.wallReleases = new Array<i32>(bricks)
    this.wallReleases.fill(0)
    this.sounds = []
    this.sparks = new Particles(SPARK_CAPACITY)
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

/** A number in [`lo`, `hi`], both ends included, from xorshift32, as the menu draws its dice. */
const introRandom = (intro: BreakIntro, lo: i32, hi: i32): i32 => {
  let x: i32 = intro.rngState
  x = x ^ (x << 13)
  x = x ^ (x >>> 17)
  x = x ^ (x << 5)
  intro.rngState = x
  const span: i32 = hi - lo + 1
  if (span <= 0) {
    return lo
  }
  const r: i32 = x % span
  return lo + (r < 0 ? r + span : r)
}

// ---- Cutting the help -------------------------------------------------------

/** The colour an SGR parameter list leaves the text in, from the colour and boldness before it. */
const introSgrColour = (params: string, colour: i32): i32 => {
  let out: i32 = colour
  let value: i32 = 0
  let digits: boolean = false
  for (let i: i32 = 0; i <= toI32(params.length); i++) {
    const c: i32 = i < toI32(params.length) ? params.charCodeAt(i) : 59
    if (c >= 48 && c <= 57) {
      value = value * 10 + (c - 48)
      digits = true
      continue
    }
    if (c !== 59) {
      continue
    }
    const v: i32 = digits ? value : 0
    if (v === 0) {
      out = PLAIN
    } else if (v === 1) {
      out = out === PLAIN ? BOLD : out
    } else if (v === 2) {
      out = FAINT
    } else if (v === 33) {
      out = YELLOW
    } else if (v === 35) {
      out = MAGENTA
    } else if (v === 36) {
      out = CYAN
    }
    value = 0
    digits = false
  }
  return out
}

/** Add a piece: `text` (empty for a brick) at `column` of `line`, `width` columns wide. */
const introAddPiece = (
  intro: BreakIntro,
  kind: i32,
  text: string,
  colour: i32,
  line: i32,
  column: i32,
  width: i32
): void => {
  const x: f64 = TEXT_X + toF64(column) * COL_W
  const y: f64 = TEXT_Y + toF64(line) * LINE_H
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
  i + 2 < toI32(help.length) &&
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
  const n: i32 = toI32(help.length)
  let line: i32 = 0
  let column: i32 = 0
  let colour: i32 = PLAIN
  let i: i32 = 0
  while (i < n && line < INTRO_LINES) {
    const c: i32 = help.charCodeAt(i)
    if (c === 10) {
      line++
      column = 0
      i++
      continue
    }
    if (c === 27 && i + 1 < n && help.charCodeAt(i + 1) === 91) {
      let end: i32 = i + 2
      while (end < n && help.charCodeAt(end) !== 109 && help.charCodeAt(end) !== 10) {
        end++
      }
      if (end < n && help.charCodeAt(end) === 109) {
        colour = introSgrColour(help.substring(i + 2, end), colour)
        i = end + 1
      } else {
        i = end
      }
      continue
    }
    if (c === 32) {
      column++
      i++
      continue
    }
    if (introUpperHalfAt(help, i)) {
      const from: i32 = column
      while (introUpperHalfAt(help, i)) {
        column++
        i = i + 3
      }
      introAddPiece(intro, PIECE_BRICK, "", colour, line, from, column - from)
      continue
    }
    const start: i32 = i
    const from: i32 = column
    while (i < n) {
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
    introAddPiece(intro, PIECE_TEXT, help.substring(start, i), colour, line, from, column - from)
  }
}

/**
 * Find the rule's missing brick: the first place two bricks on a line stand
 * a brick and a gap further apart than their neighbours, and add a brick
 * there, to drop in. It stays -1 when no rule has a gap.
 */
const introFindGap = (intro: BreakIntro): void => {
  const n: i32 = toI32(intro.kinds.length)
  for (let i: i32 = 1; i < n; i++) {
    if (
      intro.kinds[i] !== PIECE_BRICK ||
      intro.kinds[i - 1] !== PIECE_BRICK ||
      intro.lines[i] !== intro.lines[i - 1]
    ) {
      continue
    }
    const width: i32 = intro.widths[i - 1]
    const end: f64 = intro.xs[i - 1] + toF64(width) * COL_W
    const space: i32 = toI32(Math.round((intro.xs[i] - end) / COL_W))
    if (width > 0 && space >= width + 2) {
      const column: i32 = toI32(Math.round((end - TEXT_X) / COL_W)) + 1
      introAddPiece(intro, PIECE_BRICK, "", GAP_BRICK, intro.lines[i], column, width)
      intro.gap = n
      const last: i32 = intro.gap
      intro.ys[last] = intro.ys[last] - GAP_HEIGHT
      intro.prevYs[last] = intro.ys[last]
      return
    }
  }
}

/** Give every piece the step it falls from, bottom lines first, and the kick it falls with. */
const introScheduleCollapse = (intro: BreakIntro): void => {
  const n: i32 = toI32(intro.releases.length)
  for (let i: i32 = 0; i < n; i++) {
    const fromBottom: i32 = INTRO_LINES - 1 - intro.lines[i]
    intro.releases[i] = COLLAPSE_FROM + fromBottom + introRandom(intro, 0, COLLAPSE_JITTER)
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
  for (let row: i32 = 0; row < SWEEP_ROWS; row++) {
    const course: i32 = SWEEP_ROWS - 1 - row
    for (let col: i32 = 0; col < WALL_COLS; col++) {
      const i: i32 = row * WALL_COLS + col
      const order: i32 = course % 2 === 0 ? col : WALL_COLS - 1 - col
      intro.wallXs[i] = toF64(col) * WALL_BRICK_W
      intro.wallPrevXs[i] = intro.wallXs[i]
      intro.wallYs[i] = WALL_TOP + toF64(row) * WALL_BRICK_H
      intro.wallPrevYs[i] = intro.wallYs[i]
      intro.wallLaid[i] = SWEEP_FROM + course * COURSE_STEPS + (order * 3) / 2
      if (row >= WALL_ROWS) {
        intro.wallReleases[i] = CLEAR_FROM + (course * 3) / 2 + introRandom(intro, 0, CLEAR_JITTER)
        intro.wallVxs[i] = toF64(introRandom(intro, -25, 25))
        intro.wallVys[i] = -toF64(introRandom(intro, 0, 30))
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
export const stepBreakIntro = (intro: BreakIntro, input: TermInput): i32 => {
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
  intro.tick = intro.tick + 1
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
  if (g < 0 || t > GAP_FROM + GAP_STEPS + 1) {
    return
  }
  const home: f64 = TEXT_Y + toF64(intro.lines[g]) * LINE_H
  const drop: f64 = clamp(toF64(t - GAP_FROM) / toF64(GAP_STEPS), 0.0, 1.0)
  intro.prevYs[g] = intro.ys[g]
  intro.ys[g] = home - (1.0 - outBounce(drop)) * GAP_HEIGHT
  if (t === GAP_CONTACT) {
    intro.sounds.push(SOUND_STEEL)
    const count: i32 = intro.effects === 0 ? 3 : 10
    const cx: f64 = intro.xs[g] + (toF64(intro.widths[g]) * COL_W) / 2.0
    for (let k: i32 = 0; k < count; k++) {
      const vx: f64 = toF64(introRandom(intro, -60, 60))
      const vy: f64 = toF64(introRandom(intro, -70, -10))
      spawnParticle(intro.sparks, cx, home, vx, vy, 0.5, 1.2, GAP_BRICK)
    }
  }
}

/** Every falling piece's step under gravity; answers whether any piece is still on screen. */
const introStepPieces = (intro: BreakIntro, t: i32): boolean => {
  const dt: f64 = 1.0 / toF64(STEPS_PER_SECOND)
  let left: boolean = false
  const n: i32 = toI32(intro.releases.length)
  for (let i: i32 = 0; i < n; i++) {
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
  const dt: f64 = 1.0 / toF64(STEPS_PER_SECOND)
  let left: boolean = false
  const n: i32 = toI32(intro.wallReleases.length)
  for (let i: i32 = 0; i < n; i++) {
    if (t === intro.wallLaid[i] + LAY_STEPS && i % WALL_COLS === 0) {
      intro.sounds.push(SOUND_WALL)
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
  const time: f64 = Math.max(toF64(intro.tick - 1) + a, 0.0)
  const fade: f64 = clamp((time - toF64(COLLAPSE_FROM)) / toF64(FADE_STEPS), 0.0, 1.0)
  gradient(view, gfxMix(TERMINAL, BG_TOP, fade), gfxMix(TERMINAL, BG_BOTTOM, fade))
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
  const n: i32 = toI32(intro.wallLaid.length)
  for (let i: i32 = 0; i < n; i++) {
    const laid: f64 = clamp((time - toF64(intro.wallLaid[i])) / toF64(LAY_STEPS), 0.0, 1.0)
    if (laid <= 0.0) {
      continue
    }
    const row: i32 = i / WALL_COLS
    const y: f64 = lerp(intro.wallPrevYs[i], intro.wallYs[i], alpha)
    if (y > WORLD_H) {
      continue
    }
    const course: i32 = SWEEP_ROWS - 1 - row
    const side: f64 = course % 2 === 0 ? -1.0 : 1.0
    const settled: f64 = outCubic(laid)
    const x: f64 = lerp(intro.wallPrevXs[i], intro.wallXs[i], alpha) + side * (1.0 - settled) * LAY_SLIDE
    const colour: i32 = gfxMix(BG_TOP, wallColour(row), settled)
    bevelBrick(view, x + 0.5, y + 0.5, WALL_BRICK_W - 1.0, WALL_BRICK_H - 1.0, colour)
  }
}

/**
 * The help's pieces still on screen: text in the font at the largest scale
 * whose glyph steps fit a column, bricks as the top half of their line, and
 * the missing brick with a glow while it drops.
 */
const introDrawPieces = (intro: BreakIntro, view: View, alpha: f64): void => {
  const scale: i32 = Math.max(toI32(Math.floor((COL_W * view.scale) / toF64(GLYPH_ADVANCE) + 0.000001)), 1)
  const lift: f64 = (LINE_H - toF64(GLYPH_H * scale) / view.scale) / 2.0
  const n: i32 = toI32(intro.kinds.length)
  for (let i: i32 = 0; i < n; i++) {
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
