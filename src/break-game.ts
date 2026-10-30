// The brick breaker behind `nish break`: one game's whole state, the step that
// advances it 1/120 of a second, and the draw that paints it. It is pure and
// deterministic: the state moves only by `stepBreakGame` with the input it is
// handed, every random number comes from the seed, and nothing here touches the
// terminal. The caller owns the clock and the screen; a test drives the same
// steps with scripted keys and reads the answers.
//
// The world is break-gfx's 320×180 units: a HUD strip across the top, the
// field below it between two rails, the wall of bricks near the top of the
// field and the paddle near the bottom. Every moving thing keeps where it was a
// step ago beside where it is, and the draw places it `alpha` of the way
// between them, so motion is smooth at any frame rate.
//
// Steady state allocates nothing: the balls, capsules, floating scores and
// particles are fixed pools made with the game, and numbers are drawn digit by
// digit from constant strings. Only loading a level makes anything new (its
// tuning), and that is once a level.
//
// Gameplay draws from `rng` and the effects from `fxRng`, so the effects
// setting, which changes how many particles fly, never changes the game.
import { Framebuffer } from "../std/term-pixels"
import { Rng } from "../std/random"
import {
  ACTION_PRESS,
  EVENT_KEY,
  KEY_CHAR,
  KEY_ENTER,
  KEY_ESCAPE,
  KEY_LEFT,
  KEY_RIGHT,
  KEY_SPACE,
  KEY_UP,
} from "../std/term"
import { TermInput } from "../std/term-io"
import {
  GLYPH_ADVANCE,
  NO_SHADOW,
  Particles,
  STEPS_PER_SECOND,
  Trail,
  View,
  WORLD_H,
  bevelBrick,
  blendRect,
  clamp,
  dim,
  disc,
  drawParticles,
  drawText,
  drawTextCentred,
  drawTrail,
  fillLetterbox,
  fillRect,
  fontScaleFor,
  glow,
  gradient,
  hue,
  lerp,
  mix,
  outBack,
  outBounce,
  outCubic,
  pixelX,
  pushTrail,
  rgb,
  spawnParticle,
  stepParticles,
  textWidth,
  viewFor,
} from "./break-gfx"
import {
  BRICK_EXPLOSIVE,
  BRICK_MYSTERY,
  BRICK_NONE,
  BRICK_STEEL,
  BREAK_LEVELS,
  LEVEL_COLS,
  LEVEL_MAX_ROWS,
  LevelTuning,
  brickHits,
  brickKind,
  clampLevel,
  levelMap,
  levelName,
  levelRows,
  levelTuning,
} from "./break-levels"

// ---- What a step answers ----------------------------------------------------

/** The game goes on: every phase inside it, the intro and the pause included. */
export const GAME_PLAYING: i32 = 0

/** The game-over screen was dismissed. */
export const GAME_OVER: i32 = 1

/** The victory screen was dismissed. */
export const GAME_WON: i32 = 2

/** The player quit from the pause screen with q or Esc. */
export const GAME_QUIT: i32 = 3

// ---- Phases -----------------------------------------------------------------

/** The wall drops in, the paddle rises and the banner names the level; any key skips it. */
export const PHASE_INTRO: i32 = 0

/** Play, with the serve banner up until a ball is launched. */
export const PHASE_PLAY: i32 = 1

/** Frozen under the controls; p, Space or Enter resumes, q or Esc quits. */
export const PHASE_PAUSE: i32 = 2

/** The wall is down: the bonuses tally into the score, then the next level. */
export const PHASE_CLEAR: i32 = 3

/** The last ball of the last life is gone. */
export const PHASE_OVER: i32 = 4

/** The last level is clear: fireworks. */
export const PHASE_WON: i32 = 5

/** Steps the intro lasts: a second and a half. */
export const INTRO_STEPS: i32 = 180

/** Steps the clear screen spends counting the bonuses into the score. */
export const TALLY_STEPS: i32 = 180

/** Steps the clear screen holds the total before the next level. */
export const CLEAR_HOLD_STEPS: i32 = 90

/** Steps the game-over and victory screens wait before a key dismisses them, so a held Space cannot skip them. */
export const DISMISS_STEPS: i32 = 120

// ---- Power-ups --------------------------------------------------------------

/** Capsule W: a paddle half as wide again, for 15 s. */
export const CAPSULE_WIDE: i32 = 0

/** Capsule M: two more balls, split from one in flight. */
export const CAPSULE_MULTI: i32 = 1

/** Capsule S: a slower ball, for 10 s. */
export const CAPSULE_SLOW: i32 = 2

/** Capsule C: the ball sticks to the paddle until Space, for 15 s. */
export const CAPSULE_CATCH: i32 = 3

/** Capsule F: the ball passes through every brick, steel included, breaking what breaks, for 8 s. */
export const CAPSULE_FIRE: i32 = 4

/** Capsule L: an extra life. */
export const CAPSULE_LIFE: i32 = 5

/** Steps each timed power-up lasts, by kind. */
export const WIDE_STEPS: i32 = 15 * 120
export const SLOW_STEPS: i32 = 10 * 120
export const CATCH_STEPS: i32 = 15 * 120
export const FIRE_STEPS: i32 = 8 * 120

/** The most lives a player can bank. */
export const MAX_LIVES: i32 = 9

/** The highest combo multiplier. */
export const MAX_COMBO: i32 = 8

// ---- The world --------------------------------------------------------------

/** One step in seconds. */
const DT: f64 = 1.0 / 120.0

/** Where the field starts below the HUD strip, and the ball's ceiling. */
export const FIELD_TOP: f64 = 14.0

/** The inside edge of the left rail. */
export const FIELD_LEFT: f64 = 6.0

/** The inside edge of the right rail. */
export const FIELD_RIGHT: f64 = 314.0

/** A brick cell's width: the field split into `LEVEL_COLS`. */
export const BRICK_W: f64 = 22.0

/** A brick cell's height. */
export const BRICK_H: f64 = 9.0

/** The top of the wall's first row. */
export const BRICK_TOP: f64 = 26.0

/** The paddle's top edge. */
export const PADDLE_Y: f64 = 164.0

/** The paddle's thickness. */
const PADDLE_H: f64 = 5.0

/** A ball's radius. */
export const BALL_R: f64 = 2.5

/** The steepest the paddle sends a ball from vertical: 70°, so never flatter than 20° from horizontal. */
export const MAX_BOUNCE: f64 = 1.2217304763960306

/** sin 20°: no ball travels flatter than this. */
const MIN_RISE: f64 = 0.3420201433256687

/** cos 20°: the run of a ball at its flattest. */
const MIN_RUN: f64 = 0.9396926207859084

/** The paddle's speed the moment a key goes down, in units a second. */
const PADDLE_START: f64 = 90.0

/** How fast a held key speeds the paddle up, in units a second squared. */
const PADDLE_ACCEL: f64 = 1200.0

/** The paddle's top speed. */
const PADDLE_MAX: f64 = 340.0

/** How fast a capsule falls. */
const CAPSULE_FALL: f64 = 45.0

/** A capsule's size. */
const CAPSULE_W: f64 = 16.0
const CAPSULE_H: f64 = 8.0

const MAX_BALLS: i32 = 8
const MAX_CAPSULES: i32 = 8
const MAX_FLOATERS: i32 = 16
const MAX_PARTICLES: i32 = 600
const TRAIL_POINTS: i32 = 14

/** What the collision sweep calls each thing it can hit, beside a brick's index. */
const HIT_NONE: i32 = -1
const HIT_LEFT: i32 = 1000
const HIT_RIGHT: i32 = 1001
const HIT_TOP: i32 = 1002
const HIT_PADDLE: i32 = 1003

/** A sweep never goes round more than this many bounces in one step. */
const MAX_BOUNCES: i32 = 8

/** No hit: further than any sweep's end. */
const NO_HIT: f64 = 2.0

/** A slab test's open end. */
const FAR: f64 = 1.0e30

// ---- The pools --------------------------------------------------------------

/** One ball: where it is, where it was a step ago, which way it goes, and its trail. */
export class Ball {
  /** World x now. */
  x: f64
  /** World y now. */
  y: f64
  /** World x a step ago. */
  prevX: f64
  /** World y a step ago. */
  prevY: f64
  /** The direction of travel, a unit vector; the speed is the game's. */
  dx: f64
  dy: f64
  /** Where on the paddle a stuck ball sits, from its centre. */
  stickOffset: f64
  /** The streak behind the ball. */
  trail: Trail
  /** Whether the slot holds a ball in play. */
  live: boolean
  /** Whether the ball rides the paddle, waiting for a serve or held by catch. */
  stuck: boolean

  /** An empty slot. */
  constructor() {
    this.x = 0.0
    this.y = 0.0
    this.prevX = 0.0
    this.prevY = 0.0
    this.dx = 0.0
    this.dy = -1.0
    this.stickOffset = 0.0
    this.trail = new Trail(TRAIL_POINTS)
    this.live = false
    this.stuck = false
  }
}

/** A falling power-up. */
export class Capsule {
  /** Its centre. */
  x: f64
  y: f64
  /** Its centre's y a step ago. */
  prevY: f64
  /** A `CAPSULE_*`. */
  kind: i32
  /** Whether the slot is falling. */
  live: boolean

  /** An empty slot. */
  constructor() {
    this.x = 0.0
    this.y = 0.0
    this.prevY = 0.0
    this.kind = 0
    this.live = false
  }
}

/** The points a broken brick scored, floating up from where it was. */
export class Floater {
  x: f64
  y: f64
  prevY: f64
  /** Seconds left. */
  life: f64
  /** The points shown. */
  value: i32
  /** Its colour. */
  colour: i32

  /** A dead floater. */
  constructor() {
    this.x = 0.0
    this.y = 0.0
    this.prevY = 0.0
    this.life = 0.0
    this.value = 0
    this.colour = 0
  }
}

// ---- The game ---------------------------------------------------------------

/** One game of brick breaker, from its first level to its last screen. */
export class BreakGame {
  /** The level's numbers, from its formulas. */
  tuning: LevelTuning
  /** Gameplay's random numbers: drops, capsule kinds, serve angles. */
  rng: Rng
  /** The effects' random numbers: particles and shake, so the effects setting cannot change the game. */
  fxRng: Rng
  /** The ball pool. */
  balls: Ball[]
  /** The capsule pool. */
  capsules: Capsule[]
  /** The floating-score pool. */
  floaters: Floater[]
  /** Sparks, debris and fireworks. */
  particles: Particles
  /** Where the world sits in the framebuffer, refitted each draw. */
  view: View
  /** Each cell's `BRICK_*`, row by row, `LEVEL_COLS` wide. */
  kinds: i32[]
  /** Each cell's hits left. */
  hits: i32[]
  /** Each cell's hits when the level began, which picks its colour and its points. */
  fullHits: i32[]
  /** Seconds of white flash left on each cell since it was hit. */
  flashes: f64[]
  /** The paddle's centre now and a step ago. */
  paddleX: f64
  prevPaddleX: f64
  /** The paddle's speed, signed. */
  paddleV: f64
  /** The wide power-up's share of the paddle, eased: 1 normal, 1.5 wide. */
  widthScale: f64
  prevWidthScale: f64
  /** How far the paddle sits below its place while the intro raises it. */
  /** The ball's speed in units a second before slow. */
  speed: f64
  /** What slow multiplies the speed by now, eased toward its target. */
  speedScale: f64
  /** How far the wall has advanced (the last level), now and a step ago, and where it is heading. */
  wallOffset: f64
  prevWallOffset: f64
  wallTarget: f64
  /** The view's shake in world units, now and a step ago, and how strong it is. */
  shakeX: f64
  shakeY: f64
  prevShakeX: f64
  prevShakeY: f64
  shake: f64
  /** 0 low (no glow, no trails, a quarter of the particles) or 1 high, the default. */
  effects: i32
  /** The level being played, 1..`BREAK_LEVELS`. */
  level: i32
  /** Rows in the level's wall. */
  rows: i32
  /** Breakable bricks left; 0 clears the level. */
  bricksLeft: i32
  score: i32
  lives: i32
  /** Bricks broken since the ball last touched the paddle. */
  combo: i32
  /** A `PHASE_*`. */
  phase: i32
  /** Steps since the phase began. */
  phaseTime: i32
  /** The phase a pause returns to. */
  pausedFrom: i32
  /** Steps the level has been in play with a ball launched, for the time bonus. */
  playSteps: i32
  /** Steps left on each timed power-up. */
  wideSteps: i32
  slowSteps: i32
  catchSteps: i32
  fireSteps: i32
  /** Steps since the wall last advanced. */
  advanceSteps: i32
  /** The clear screen's bonuses and the score before them. */
  timeBonus: i32
  livesBonus: i32
  scoreBefore: i32
  /** What the game answers once a last screen is dismissed or the player quits; `GAME_PLAYING` until then. */
  result: i32
  /** Steps since the game began, which drives the idle animations. */
  ticks: i32
  /** The collision sweep's last slab normal. */
  hitNx: i32
  hitNy: i32
  /** Whether a ball has been served since the last serve began. */
  launched: boolean

  /** An empty game; `newBreakGame` makes a real one. */
  constructor(seed: i32) {
    this.tuning = new LevelTuning()
    this.rng = new Rng(seed)
    this.fxRng = new Rng(seed ^ 1540483477)
    this.balls = []
    for (let i: i32 = 0; i < MAX_BALLS; i++) {
      this.balls.push(new Ball())
    }
    this.capsules = []
    for (let i: i32 = 0; i < MAX_CAPSULES; i++) {
      this.capsules.push(new Capsule())
    }
    this.floaters = []
    for (let i: i32 = 0; i < MAX_FLOATERS; i++) {
      this.floaters.push(new Floater())
    }
    this.particles = new Particles(MAX_PARTICLES)
    this.view = new View()
    const cells: i32 = LEVEL_COLS * LEVEL_MAX_ROWS
    this.kinds = new Array<i32>(cells)
    this.kinds.fill(0)
    this.hits = new Array<i32>(cells)
    this.hits.fill(0)
    this.fullHits = new Array<i32>(cells)
    this.fullHits.fill(0)
    this.flashes = new Array<f64>(cells)
    this.flashes.fill(0.0)
    this.paddleX = 160.0
    this.prevPaddleX = 160.0
    this.paddleV = 0.0
    this.widthScale = 1.0
    this.prevWidthScale = 1.0
    this.speed = 90.0
    this.speedScale = 1.0
    this.wallOffset = 0.0
    this.prevWallOffset = 0.0
    this.wallTarget = 0.0
    this.shakeX = 0.0
    this.shakeY = 0.0
    this.prevShakeX = 0.0
    this.prevShakeY = 0.0
    this.shake = 0.0
    this.effects = 1
    this.level = 1
    this.rows = 0
    this.bricksLeft = 0
    this.score = 0
    this.lives = 3
    this.combo = 0
    this.phase = PHASE_INTRO
    this.phaseTime = 0
    this.pausedFrom = PHASE_PLAY
    this.playSteps = 0
    this.wideSteps = 0
    this.slowSteps = 0
    this.catchSteps = 0
    this.fireSteps = 0
    this.advanceSteps = 0
    this.timeBonus = 0
    this.livesBonus = 0
    this.scoreBefore = 0
    this.result = GAME_PLAYING
    this.ticks = 0
    this.hitNx = 0
    this.hitNy = 0
    this.launched = false
  }
}

/** A 32-bit seed from a 64-bit one, both halves mixed in. */
const seedBits = (seed: i64): i32 => toI32(seed & 2147483647) ^ toI32((seed >> 31) & 2147483647)

/** A new game on `level` (clamped to 1..`BREAK_LEVELS`), its randomness all from `seed`, starting with the intro. */
export const newBreakGame = (level: i32, seed: i64): BreakGame => {
  const game = new BreakGame(seedBits(seed))
  loadLevel(game, clampLevel(level))
  return game
}

// ---- Level, serve and life --------------------------------------------------

/** Lay out `level`'s wall, take its tuning and start its intro; the score and lives carry over. */
export const loadLevel = (game: BreakGame, level: i32): void => {
  const n: i32 = clampLevel(level)
  game.level = n
  game.tuning = levelTuning(n)
  game.rows = Math.min(levelRows(n), LEVEL_MAX_ROWS)
  const map: string = levelMap(n)
  game.kinds.fill(BRICK_NONE)
  game.hits.fill(0)
  game.fullHits.fill(0)
  game.flashes.fill(0.0)
  game.bricksLeft = 0
  const cells: i32 = game.rows * LEVEL_COLS
  for (let i: i32 = 0; i < cells && i < map.length && i < game.kinds.length; i++) {
    const c: i32 = toI32(map.charCodeAt(i))
    game.kinds[i] = brickKind(c)
    if (i < toI32(game.hits.length) && i < toI32(game.fullHits.length)) {
      game.hits[i] = brickHits(c)
      game.fullHits[i] = brickHits(c)
    }
    if (breakable(game.kinds[i])) {
      game.bricksLeft = game.bricksLeft + 1
    }
  }
  game.speed = game.tuning.ballSpeed
  game.speedScale = 1.0
  game.wallOffset = 0.0
  game.prevWallOffset = 0.0
  game.wallTarget = 0.0
  game.advanceSteps = 0
  game.playSteps = 0
  game.combo = 0
  clearPowers(game)
  for (const b of game.balls) {
    b.live = false
    b.trail.clear()
  }
  for (const c of game.capsules) {
    c.live = false
  }
  game.paddleX = 160.0
  game.prevPaddleX = 160.0
  game.paddleV = 0.0
  serve(game)
  enterPhase(game, PHASE_INTRO)
}

/** Whether a brick of `kind` counts toward clearing the level. */
const breakable = (kind: i32): boolean => kind !== BRICK_NONE && kind !== BRICK_STEEL

/** Every timed power-up off, the paddle back to its width. */
const clearPowers = (game: BreakGame): void => {
  game.wideSteps = 0
  game.slowSteps = 0
  game.catchSteps = 0
  game.fireSteps = 0
  game.widthScale = 1.0
  game.prevWidthScale = 1.0
}

/** One ball on the paddle's centre, waiting for Space. */
const serve = (game: BreakGame): void => {
  for (const b of game.balls) {
    b.live = false
  }
  const b: Ball = game.balls[0]
  b.live = true
  b.stuck = true
  b.stickOffset = 0.0
  b.x = game.paddleX
  b.y = PADDLE_Y - BALL_R
  b.prevX = b.x
  b.prevY = b.y
  b.dx = 0.0
  b.dy = -1.0
  b.trail.clear()
  game.launched = false
}

const enterPhase = (game: BreakGame, phase: i32): void => {
  game.phase = phase
  game.phaseTime = 0
}

/** The paddle's width now: the level's, widened by the wide power-up. */
export const paddleWidth = (game: BreakGame): f64 => game.tuning.paddleWidth * game.widthScale

/** The ball's speed now, slow included. */
export const ballSpeed = (game: BreakGame): f64 => game.speed * game.speedScale

/** How many balls are in play. */
export const liveBalls = (game: BreakGame): i32 => {
  let n: i32 = 0
  for (const b of game.balls) {
    if (b.live) {
      n++
    }
  }
  return n
}

/** The kind of the brick at `col`, `row`, or `BRICK_NONE` off the wall. */
export const brickAt = (game: BreakGame, col: i32, row: i32): i32 => {
  const i: i32 = row * LEVEL_COLS + col
  if (col < 0 || col >= LEVEL_COLS || row < 0 || row >= game.rows || i >= toI32(game.kinds.length)) {
    return BRICK_NONE
  }
  return game.kinds[i]
}

/** The hits the brick at `col`, `row` has left, or 0 off the wall. */
export const hitsAt = (game: BreakGame, col: i32, row: i32): i32 => {
  const i: i32 = row * LEVEL_COLS + col
  if (col < 0 || col >= LEVEL_COLS || row < 0 || row >= game.rows || i >= toI32(game.hits.length)) {
    return 0
  }
  return game.hits[i]
}

/** The world x of the left edge of column `col`. */
export const brickX = (col: i32): f64 => FIELD_LEFT + toF64(col) * BRICK_W

/** The world y of the top of row `row`, the wall's advance included. */
export const brickY = (game: BreakGame, row: i32): f64 => BRICK_TOP + game.wallOffset + toF64(row) * BRICK_H

// ---- Input ------------------------------------------------------------------

/** Whether this step's events press `key` (for `KEY_CHAR`, the letter `code`, either case). */
const pressed = (input: TermInput, key: i32, code: i32): boolean => {
  for (const ev of input.events) {
    if (ev.type !== EVENT_KEY || ev.action !== ACTION_PRESS || ev.key !== key) {
      continue
    }
    if (key !== KEY_CHAR || ev.code === code || ev.code === code - 32) {
      return true
    }
  }
  return false
}

/** Whether this step's events press any key at all. */
const anyPress = (input: TermInput): boolean => {
  for (const ev of input.events) {
    if (ev.type === EVENT_KEY && ev.action === ACTION_PRESS) {
      return true
    }
  }
  return false
}

/** Space or Enter: what confirms. */
const confirmPressed = (input: TermInput): boolean =>
  pressed(input, KEY_SPACE, 0) || pressed(input, KEY_ENTER, 0)

/** -1 for left held, 1 for right, 0 for neither or both. */
const heldDirection = (input: TermInput): i32 => {
  const left: boolean = input.isDown(KEY_LEFT, 0) || input.isDown(KEY_CHAR, 97) || input.isDown(KEY_CHAR, 104)
  const right: boolean =
    input.isDown(KEY_RIGHT, 0) || input.isDown(KEY_CHAR, 100) || input.isDown(KEY_CHAR, 108)
  if (left === right) {
    return 0
  }
  return left ? -1 : 1
}

// ---- The step ---------------------------------------------------------------

/**
 * Advance `game` one step, 1/`STEPS_PER_SECOND` of a second, with this step's
 * `input`, and answer a `GAME_*`: `GAME_PLAYING` until the last screen is
 * dismissed or the player quits, and that answer from then on.
 */
export const stepBreakGame = (game: BreakGame, input: TermInput): i32 => {
  if (game.result !== GAME_PLAYING) {
    return game.result
  }
  if (game.phase === PHASE_PAUSE) {
    stepPause(game, input)
    return game.result
  }
  game.ticks = game.ticks + 1
  game.phaseTime = game.phaseTime + 1
  remember(game)
  if (game.phase === PHASE_INTRO) {
    if (anyPress(input) || game.phaseTime >= INTRO_STEPS) {
      enterPhase(game, PHASE_PLAY)
    }
  } else if (game.phase === PHASE_PLAY) {
    stepPlay(game, input)
  } else if (game.phase === PHASE_CLEAR) {
    stepClear(game, input)
  } else {
    stepLastScreen(game, input)
  }
  stepEffects(game)
  return game.result
}

/** Where everything is becomes where it was, before the step moves it. */
const remember = (game: BreakGame): void => {
  game.prevPaddleX = game.paddleX
  game.prevWidthScale = game.widthScale
  game.prevWallOffset = game.wallOffset
  game.prevShakeX = game.shakeX
  game.prevShakeY = game.shakeY
  for (const b of game.balls) {
    b.prevX = b.x
    b.prevY = b.y
  }
  for (const c of game.capsules) {
    c.prevY = c.y
  }
  for (const f of game.floaters) {
    f.prevY = f.y
  }
}

const stepPause = (game: BreakGame, input: TermInput): void => {
  if (pressed(input, KEY_ESCAPE, 0) || pressed(input, KEY_CHAR, 113)) {
    game.result = GAME_QUIT
  } else if (pressed(input, KEY_CHAR, 112) || confirmPressed(input)) {
    game.phase = game.pausedFrom
  }
}

const stepPlay = (game: BreakGame, input: TermInput): void => {
  if (pressed(input, KEY_CHAR, 112) || pressed(input, KEY_ESCAPE, 0) || pressed(input, KEY_CHAR, 113)) {
    game.pausedFrom = PHASE_PLAY
    game.phase = PHASE_PAUSE
    return
  }
  movePaddle(game, heldDirection(input))
  if (pressed(input, KEY_SPACE, 0) || pressed(input, KEY_UP, 0)) {
    launch(game)
  }
  stepPowers(game)
  for (const b of game.balls) {
    if (b.live) {
      stepBall(game, b)
    }
  }
  stepCapsules(game)
  if (game.launched) {
    game.playSteps = game.playSteps + 1
  }
  stepWall(game)
  if (game.phase !== PHASE_PLAY) {
    return
  }
  if (game.bricksLeft <= 0) {
    enterClear(game)
  } else if (liveBalls(game) === 0) {
    loseLife(game)
  }
}

/** Held keys speed the paddle up from `PADDLE_START` toward `PADDLE_MAX`; letting go or turning stops it. */
const movePaddle = (game: BreakGame, dir: i32): void => {
  if (dir === 0) {
    game.paddleV = 0.0
  } else {
    const d: f64 = toF64(dir)
    if (game.paddleV * d <= 0.0) {
      game.paddleV = PADDLE_START * d
    } else {
      game.paddleV = d * Math.min(Math.abs(game.paddleV) + PADDLE_ACCEL * DT, PADDLE_MAX)
    }
  }
  const half: f64 = paddleWidth(game) / 2.0
  game.paddleX = clamp(game.paddleX + game.paddleV * DT, FIELD_LEFT + half, FIELD_RIGHT - half)
  if (game.paddleX <= FIELD_LEFT + half || game.paddleX >= FIELD_RIGHT - half) {
    game.paddleV = 0.0
  }
  for (const b of game.balls) {
    if (b.live && b.stuck) {
      b.x = game.paddleX + b.stickOffset
      b.y = PADDLE_Y - BALL_R
    }
  }
}

/** Send every stuck ball off the paddle, angled by where it sits; a centred serve leans a little at random. */
const launch = (game: BreakGame): void => {
  for (const b of game.balls) {
    if (!b.live || !b.stuck) {
      continue
    }
    b.stuck = false
    const half: f64 = paddleWidth(game) / 2.0 + BALL_R
    let f: f64 = clamp(b.stickOffset / half, -1.0, 1.0)
    if (!game.launched && b.stickOffset === 0.0) {
      f = (game.rng.nextF64() - 0.5) * 0.5
    }
    aim(b, f * MAX_BOUNCE)
  }
  game.launched = true
}

/** Point `b` `angle` radians from straight up, positive to the right. */
const aim = (b: Ball, angle: f64): void => {
  b.dx = Math.sin(angle)
  b.dy = -Math.cos(angle)
}

/** Keep `b` from travelling flatter than 20° from horizontal, its directions' signs kept. */
const steepen = (b: Ball): void => {
  if (Math.abs(b.dy) >= MIN_RISE) {
    return
  }
  const sy: f64 = b.dy < 0.0 ? -1.0 : 1.0
  const sx: f64 = b.dx < 0.0 ? -1.0 : 1.0
  b.dy = sy * MIN_RISE
  b.dx = sx * MIN_RUN
}

const stepPowers = (game: BreakGame): void => {
  game.wideSteps = Math.max(game.wideSteps - 1, 0)
  game.slowSteps = Math.max(game.slowSteps - 1, 0)
  game.catchSteps = Math.max(game.catchSteps - 1, 0)
  game.fireSteps = Math.max(game.fireSteps - 1, 0)
  const wide: f64 = game.wideSteps > 0 ? 1.5 : 1.0
  game.widthScale = game.widthScale + (wide - game.widthScale) * 0.15
  const slow: f64 = game.slowSteps > 0 ? game.tuning.slowFactor : 1.0
  game.speedScale = game.speedScale + (slow - game.speedScale) * 0.05
}

// ---- The ball ---------------------------------------------------------------

/**
 * One step of one ball, swept: the segment it travels this step is tested
 * against the rails, the bricks under it and the paddle, it moves to the first
 * thing it touches, bounces, and sweeps on with what distance is left. Nothing
 * thin enough to step over exists for it, whatever its speed.
 */
const stepBall = (game: BreakGame, b: Ball): void => {
  if (b.stuck) {
    b.x = game.paddleX + b.stickOffset
    b.y = PADDLE_Y - BALL_R
    pushTrail(b.trail, b.x, b.y)
    return
  }
  // A paddle that moved into a falling ball sends it back up.
  if (b.dy > 0.0 && overPaddle(game, b.x, b.y) && b.y < PADDLE_Y + PADDLE_H / 2.0) {
    if (paddleBounce(game, b)) {
      pushTrail(b.trail, b.x, b.y)
      return
    }
  }
  let rest: f64 = ballSpeed(game) * DT
  let last: i32 = HIT_NONE
  for (let bounce: i32 = 0; bounce < MAX_BOUNCES && rest > 0.0; bounce++) {
    const mx: f64 = b.dx * rest
    const my: f64 = b.dy * rest
    let best: f64 = NO_HIT
    let id: i32 = HIT_NONE
    let nx: i32 = 0
    let ny: i32 = 0
    if (mx < 0.0 && b.x + mx < FIELD_LEFT + BALL_R && last !== HIT_LEFT) {
      best = Math.max((FIELD_LEFT + BALL_R - b.x) / mx, 0.0)
      id = HIT_LEFT
      nx = 1
      ny = 0
    }
    if (mx > 0.0 && b.x + mx > FIELD_RIGHT - BALL_R && last !== HIT_RIGHT) {
      const t: f64 = Math.max((FIELD_RIGHT - BALL_R - b.x) / mx, 0.0)
      if (t < best) {
        best = t
        id = HIT_RIGHT
        nx = -1
        ny = 0
      }
    }
    if (my < 0.0 && b.y + my < FIELD_TOP + BALL_R && last !== HIT_TOP) {
      const t: f64 = Math.max((FIELD_TOP + BALL_R - b.y) / my, 0.0)
      if (t < best) {
        best = t
        id = HIT_TOP
        nx = 0
        ny = 1
      }
    }
    // The bricks whose cells the swept ball's box overlaps.
    const c0: i32 = cellIndex((Math.min(b.x, b.x + mx) - BALL_R - FIELD_LEFT) / BRICK_W, LEVEL_COLS)
    const c1: i32 = cellIndex((Math.max(b.x, b.x + mx) + BALL_R - FIELD_LEFT) / BRICK_W, LEVEL_COLS)
    const top: f64 = BRICK_TOP + game.wallOffset
    const r0: i32 = cellIndex((Math.min(b.y, b.y + my) - BALL_R - top) / BRICK_H, game.rows)
    const r1: i32 = cellIndex((Math.max(b.y, b.y + my) + BALL_R - top) / BRICK_H, game.rows)
    for (let row: i32 = r0; row <= r1; row++) {
      for (let col: i32 = c0; col <= c1; col++) {
        const i: i32 = row * LEVEL_COLS + col
        if (i === last || brickAt(game, col, row) === BRICK_NONE) {
          continue
        }
        const x0: f64 = brickX(col)
        const y0: f64 = top + toF64(row) * BRICK_H
        const t: f64 = sweep(
          game,
          b.x,
          b.y,
          mx,
          my,
          x0 - BALL_R,
          y0 - BALL_R,
          x0 + BRICK_W + BALL_R,
          y0 + BRICK_H + BALL_R
        )
        if (t < best) {
          best = t
          id = i
          nx = game.hitNx
          ny = game.hitNy
        }
      }
    }
    if (my > 0.0 && last !== HIT_PADDLE) {
      const half: f64 = paddleWidth(game) / 2.0
      const t: f64 = sweep(
        game,
        b.x,
        b.y,
        mx,
        my,
        game.paddleX - half - BALL_R,
        PADDLE_Y - BALL_R,
        game.paddleX + half + BALL_R,
        PADDLE_Y + PADDLE_H + BALL_R
      )
      if (t < best) {
        best = t
        id = HIT_PADDLE
        nx = game.hitNx
        ny = game.hitNy
      }
    }
    if (id === HIT_NONE) {
      b.x = b.x + mx
      b.y = b.y + my
      rest = 0.0
      break
    }
    b.x = b.x + mx * best
    b.y = b.y + my * best
    rest = rest * (1.0 - best)
    last = id
    if (id === HIT_PADDLE) {
      if (ny < 0) {
        if (paddleBounce(game, b)) {
          rest = 0.0
        }
      } else {
        reflect(b, nx, 0)
      }
    } else if (id >= HIT_LEFT) {
      reflect(b, nx, ny)
    } else if (game.fireSteps > 0) {
      // A fireball breaks what it touches and carries on through, steel too.
      if (breakable(game.kinds[id])) {
        breakBrick(game, id)
      }
    } else {
      reflect(b, nx, ny)
      hitBrick(game, id)
    }
  }
  if (b.y > WORLD_H + BALL_R) {
    b.live = false
    b.trail.clear()
    return
  }
  pushTrail(b.trail, b.x, b.y)
}

/** `x` floored to a cell index and held to 0..`count`-1. */
const cellIndex = (x: f64, count: i32): i32 => toI32(clamp(Math.floor(x), 0.0, toF64(Math.max(count - 1, 0))))

/** Send `b` away from a surface facing `nx`, `ny`. */
const reflect = (b: Ball, nx: i32, ny: i32): void => {
  if (nx > 0) {
    b.dx = Math.abs(b.dx)
  } else if (nx < 0) {
    b.dx = -Math.abs(b.dx)
  }
  if (ny > 0) {
    b.dy = Math.abs(b.dy)
  } else if (ny < 0) {
    b.dy = -Math.abs(b.dy)
  }
  steepen(b)
}

/**
 * Where along the move `mx`, `my` from `x`, `y` a point first enters the box
 * `x0`..`x1` × `y0`..`y1`, as a fraction of the move, or `NO_HIT`. It leaves
 * the face it entered by in `hitNx`, `hitNy`. A point already inside, or one
 * only grazing an edge, does not hit: a ball embedded in a brick the wall moved
 * onto passes out of it rather than rattling.
 */
const sweep = (
  game: BreakGame,
  x: f64,
  y: f64,
  mx: f64,
  my: f64,
  x0: f64,
  y0: f64,
  x1: f64,
  y1: f64
): f64 => {
  let xIn: f64 = -FAR
  let xOut: f64 = FAR
  if (mx === 0.0) {
    if (x <= x0 || x >= x1) {
      return NO_HIT
    }
  } else {
    const a: f64 = (x0 - x) / mx
    const c: f64 = (x1 - x) / mx
    xIn = Math.min(a, c)
    xOut = Math.max(a, c)
  }
  let yIn: f64 = -FAR
  let yOut: f64 = FAR
  if (my === 0.0) {
    if (y <= y0 || y >= y1) {
      return NO_HIT
    }
  } else {
    const a: f64 = (y0 - y) / my
    const c: f64 = (y1 - y) / my
    yIn = Math.min(a, c)
    yOut = Math.max(a, c)
  }
  const enter: f64 = Math.max(xIn, yIn)
  const exit: f64 = Math.min(xOut, yOut)
  if (enter < 0.0 || enter > 1.0 || enter >= exit) {
    return NO_HIT
  }
  if (xIn > yIn) {
    game.hitNx = mx > 0.0 ? -1 : 1
    game.hitNy = 0
  } else {
    game.hitNx = 0
    game.hitNy = my > 0.0 ? -1 : 1
  }
  return enter
}

/** Whether a ball at `x`, `y` overlaps the paddle. */
const overPaddle = (game: BreakGame, x: f64, y: f64): boolean => {
  const half: f64 = paddleWidth(game) / 2.0 + BALL_R
  return (
    x > game.paddleX - half &&
    x < game.paddleX + half &&
    y > PADDLE_Y - BALL_R &&
    y < PADDLE_Y + PADDLE_H + BALL_R
  )
}

/**
 * The ball met the paddle's top: it leaves at an angle set by where it
 * landed, straight up at the centre and 70° out at the ends, a little faster,
 * and the combo ends. Under catch it sticks instead, and the answer is true.
 */
const paddleBounce = (game: BreakGame, b: Ball): boolean => {
  const half: f64 = paddleWidth(game) / 2.0 + BALL_R
  const f: f64 = clamp((b.x - game.paddleX) / half, -1.0, 1.0)
  aim(b, f * MAX_BOUNCE)
  b.y = Math.min(b.y, PADDLE_Y - BALL_R)
  game.speed = Math.min(game.speed * (1.0 + game.tuning.speedUp), game.tuning.maxSpeed)
  game.combo = 0
  if (game.catchSteps > 0) {
    b.stuck = true
    b.stickOffset = b.x - game.paddleX
    b.y = PADDLE_Y - BALL_R
    return true
  }
  return false
}

// ---- Bricks -----------------------------------------------------------------

/** The points brick `i` is worth before the combo: 10 a hit it took, 25 explosive, 15 mystery. */
const brickPoints = (game: BreakGame, i: i32): i32 => {
  const kind: i32 = game.kinds[i]
  if (kind === BRICK_EXPLOSIVE) {
    return 25
  }
  if (kind === BRICK_MYSTERY) {
    return 15
  }
  return 10 * Math.max(game.fullHits[i], 1)
}

/** A ball hit brick `i`: steel rings, a strong brick cracks, the last hit breaks it. */
const hitBrick = (game: BreakGame, i: i32): void => {
  if (
    i < 0 ||
    i >= toI32(game.kinds.length) ||
    i >= toI32(game.hits.length) ||
    i >= toI32(game.flashes.length)
  ) {
    return
  }
  game.flashes[i] = 0.15
  if (!breakable(game.kinds[i])) {
    return
  }
  game.hits[i] = game.hits[i] - 1
  if (game.hits[i] <= 0) {
    breakBrick(game, i)
  } else {
    burst(
      game,
      brickX(i % LEVEL_COLS) + BRICK_W / 2.0,
      brickY(game, i / LEVEL_COLS) + BRICK_H / 2.0,
      4,
      rgb(220, 220, 240)
    )
  }
}

/**
 * Brick `i` breaks: it scores its points times the combo, which grows, sends
 * up its sparks and its score, may drop a capsule, and an explosive one breaks
 * its eight neighbours, which may be explosive too.
 */
const breakBrick = (game: BreakGame, i: i32): void => {
  if (
    i < 0 ||
    i >= toI32(game.kinds.length) ||
    i >= toI32(game.hits.length) ||
    i >= toI32(game.fullHits.length)
  ) {
    return
  }
  const kind: i32 = game.kinds[i]
  if (!breakable(kind)) {
    return
  }
  const col: i32 = i % LEVEL_COLS
  const row: i32 = i / LEVEL_COLS
  const cx: f64 = brickX(col) + BRICK_W / 2.0
  const cy: f64 = brickY(game, row) + BRICK_H / 2.0
  const colour: i32 = brickColour(game, i)
  game.combo = Math.min(game.combo + 1, 1000)
  const points: i32 = brickPoints(game, i) * Math.min(game.combo, MAX_COMBO)
  game.score = game.score + points
  game.kinds[i] = BRICK_NONE
  game.hits[i] = 0
  game.bricksLeft = game.bricksLeft - 1
  floatScore(game, cx, cy, points, game.combo >= 2 ? rgb(255, 220, 90) : rgb(235, 235, 245))
  if (kind === BRICK_MYSTERY || game.rng.nextF64() < game.tuning.dropChance) {
    dropCapsule(game, cx, cy)
  }
  if (kind === BRICK_EXPLOSIVE) {
    burst(game, cx, cy, 36, rgb(255, 150, 40))
    burst(game, cx, cy, 12, rgb(255, 240, 180))
    game.shake = Math.min(game.shake + 3.0, 6.0)
    for (let dr: i32 = -1; dr <= 1; dr++) {
      for (let dc: i32 = -1; dc <= 1; dc++) {
        if (breakable(brickAt(game, col + dc, row + dr))) {
          breakBrick(game, (row + dr) * LEVEL_COLS + col + dc)
        }
      }
    }
  } else {
    burst(game, cx, cy, 12, colour)
  }
}

// ---- Capsules ---------------------------------------------------------------

/** A capsule of a random kind falls from `x`, `y`: W, M and S three parts in fourteen, C and F two, L one. */
const dropCapsule = (game: BreakGame, x: f64, y: f64): void => {
  const roll: i32 = game.rng.nextInt(0, 13)
  let kind: i32 = CAPSULE_LIFE
  if (roll < 3) {
    kind = CAPSULE_WIDE
  } else if (roll < 6) {
    kind = CAPSULE_MULTI
  } else if (roll < 9) {
    kind = CAPSULE_SLOW
  } else if (roll < 11) {
    kind = CAPSULE_CATCH
  } else if (roll < 13) {
    kind = CAPSULE_FIRE
  }
  spawnCapsule(game, x, y, kind)
}

/** A capsule of `kind` falling from `x`, `y`, in a free slot; with none free it is lost. */
export const spawnCapsule = (game: BreakGame, x: f64, y: f64, kind: i32): void => {
  for (const c of game.capsules) {
    if (!c.live) {
      c.live = true
      c.x = x
      c.y = y
      c.prevY = y
      c.kind = kind
      return
    }
  }
}

const stepCapsules = (game: BreakGame): void => {
  const half: f64 = paddleWidth(game) / 2.0
  for (const c of game.capsules) {
    if (!c.live) {
      continue
    }
    c.y = c.y + CAPSULE_FALL * DT
    const caught: boolean =
      c.y + CAPSULE_H / 2.0 >= PADDLE_Y &&
      c.y - CAPSULE_H / 2.0 <= PADDLE_Y + PADDLE_H &&
      c.x + CAPSULE_W / 2.0 >= game.paddleX - half &&
      c.x - CAPSULE_W / 2.0 <= game.paddleX + half
    if (caught) {
      c.live = false
      applyPower(game, c.kind)
      game.score = game.score + 50
      floatScore(game, c.x, PADDLE_Y - 6.0, 50, capsuleColour(c.kind))
      burst(game, c.x, PADDLE_Y, 10, capsuleColour(c.kind))
    } else if (c.y - CAPSULE_H / 2.0 > WORLD_H) {
      c.live = false
    }
  }
}

/** What catching a capsule of `kind` does. */
export const applyPower = (game: BreakGame, kind: i32): void => {
  if (kind === CAPSULE_WIDE) {
    game.wideSteps = WIDE_STEPS
  } else if (kind === CAPSULE_MULTI) {
    multiball(game)
  } else if (kind === CAPSULE_SLOW) {
    game.slowSteps = SLOW_STEPS
  } else if (kind === CAPSULE_CATCH) {
    game.catchSteps = CATCH_STEPS
  } else if (kind === CAPSULE_FIRE) {
    game.fireSteps = FIRE_STEPS
  } else {
    game.lives = Math.min(game.lives + 1, MAX_LIVES)
  }
}

/** Two more balls from the first in play, 25° either side of its course; a stuck one is served first. */
const multiball = (game: BreakGame): void => {
  let from: i32 = -1
  for (let i: i32 = 0; i < toI32(game.balls.length) && from < 0; i++) {
    if (game.balls[i].live) {
      from = i
    }
  }
  if (from < 0) {
    return
  }
  const src: Ball = game.balls[from]
  if (src.stuck) {
    src.stuck = false
    aim(src, 0.0)
    game.launched = true
  }
  const turn: f64 = (25.0 * Math.PI) / 180.0
  splitBall(game, src, turn)
  splitBall(game, src, -turn)
}

/** A new ball where `src` is, turned `angle` radians from its course, in a free slot if there is one. */
const splitBall = (game: BreakGame, src: Ball, angle: f64): void => {
  for (const b of game.balls) {
    if (b.live) {
      continue
    }
    b.live = true
    b.stuck = false
    b.x = src.x
    b.y = src.y
    b.prevX = src.prevX
    b.prevY = src.prevY
    const c: f64 = Math.cos(angle)
    const s: f64 = Math.sin(angle)
    b.dx = src.dx * c - src.dy * s
    b.dy = src.dx * s + src.dy * c
    steepen(b)
    b.trail.clear()
    return
  }
}

// ---- The wall, the clear and the last screens ----------------------------------

/** On the last level the wall advances a row every `advanceSeconds` while a ball is in play, and reaching the paddle ends the game. */
const stepWall = (game: BreakGame): void => {
  if (game.tuning.advanceSeconds <= 0.0) {
    return
  }
  if (game.launched) {
    game.advanceSteps = game.advanceSteps + 1
    if (toF64(game.advanceSteps) >= game.tuning.advanceSeconds * toF64(STEPS_PER_SECOND)) {
      game.advanceSteps = 0
      game.wallTarget = game.wallTarget + BRICK_H
      game.shake = Math.min(game.shake + 1.5, 6.0)
    }
  }
  game.wallOffset = game.wallOffset + (game.wallTarget - game.wallOffset) * 0.08
  if (wallBottom(game) >= PADDLE_Y) {
    game.lives = 0
    game.shake = 6.0
    enterPhase(game, PHASE_OVER)
  }
}

/** The bottom edge of the lowest row with a brick in it, or the wall's top with none. */
export const wallBottom = (game: BreakGame): f64 => {
  for (let row: i32 = game.rows - 1; row >= 0; row--) {
    for (let col: i32 = 0; col < LEVEL_COLS; col++) {
      if (brickAt(game, col, row) !== BRICK_NONE) {
        return brickY(game, row) + BRICK_H
      }
    }
  }
  return BRICK_TOP + game.wallOffset
}

/** The last ball fell: a life goes, the power-ups with it, and the next ball waits on the paddle. */
const loseLife = (game: BreakGame): void => {
  game.lives = Math.max(game.lives - 1, 0)
  game.combo = 0
  game.shake = Math.min(game.shake + 4.0, 6.0)
  clearPowers(game)
  for (const c of game.capsules) {
    c.live = false
  }
  if (game.lives === 0) {
    enterPhase(game, PHASE_OVER)
    return
  }
  serve(game)
}

/** The time bonus: 10 × level points a second under par, par 60 + 20 × level seconds. */
export const timeBonusFor = (level: i32, seconds: i32): i32 =>
  Math.max(60 + 20 * level - seconds, 0) * 10 * level

/** The lives bonus: 250 × level points a life left. */
export const livesBonusFor = (level: i32, lives: i32): i32 => lives * 250 * level

const enterClear = (game: BreakGame): void => {
  game.scoreBefore = game.score
  game.timeBonus = timeBonusFor(game.level, game.playSteps / STEPS_PER_SECOND)
  game.livesBonus = livesBonusFor(game.level, game.lives)
  for (const c of game.capsules) {
    c.live = false
  }
  for (const b of game.balls) {
    b.live = false
  }
  burst(game, 160.0, 90.0, 60, rgb(255, 230, 120))
  enterPhase(game, PHASE_CLEAR)
}

/** The bonus counted so far on the clear screen. */
export const tallied = (game: BreakGame): i32 => {
  const total: i32 = game.timeBonus + game.livesBonus
  if (game.phaseTime >= TALLY_STEPS) {
    return total
  }
  return toI32(Math.floor((toF64(total) * toF64(game.phaseTime)) / toF64(TALLY_STEPS)))
}

/** The bonuses count into the score, then hold; Space or Enter skips to the end; then the next level or victory. */
const stepClear = (game: BreakGame, input: TermInput): void => {
  if (confirmPressed(input)) {
    game.phaseTime = TALLY_STEPS + CLEAR_HOLD_STEPS
  }
  game.score = game.scoreBefore + tallied(game)
  if (game.phaseTime < TALLY_STEPS + CLEAR_HOLD_STEPS) {
    return
  }
  if (game.level >= BREAK_LEVELS) {
    enterPhase(game, PHASE_WON)
  } else {
    loadLevel(game, game.level + 1)
  }
}

/** Game over or victory: fireworks for a win, and after `DISMISS_STEPS` Space or Enter answers. */
const stepLastScreen = (game: BreakGame, input: TermInput): void => {
  if (game.phase === PHASE_WON && game.phaseTime % 30 === 1) {
    const x: f64 = game.fxRng.nextF64() * 240.0 + 40.0
    const y: f64 = game.fxRng.nextF64() * 70.0 + 30.0
    firework(game, x, y, hue(game.fxRng.nextF64()))
  }
  if (game.phaseTime >= DISMISS_STEPS && confirmPressed(input)) {
    game.result = game.phase === PHASE_WON ? GAME_WON : GAME_OVER
  }
}

// ---- Effects ----------------------------------------------------------------

/** How many of `n` particles the effects setting lets fly: all of them high, a quarter low. */
const particleCount = (game: BreakGame, n: i32): i32 => (game.effects === 0 ? (n + 3) / 4 : n)

/** Sparks flying out from `x`, `y`. */
const burst = (game: BreakGame, x: f64, y: f64, n: i32, colour: i32): void => {
  const count: i32 = particleCount(game, n)
  for (let i: i32 = 0; i < count; i++) {
    const a: f64 = game.fxRng.nextF64() * 2.0 * Math.PI
    const v: f64 = game.fxRng.nextF64() * 90.0 + 30.0
    const life: f64 = game.fxRng.nextF64() * 0.5 + 0.35
    spawnParticle(
      game.particles,
      x,
      y,
      Math.cos(a) * v,
      Math.sin(a) * v - 30.0,
      life,
      game.fxRng.nextF64() + 1.0,
      colour
    )
  }
}

/** A firework shell bursting at `x`, `y`: a ring of sparks that fall and fade. */
const firework = (game: BreakGame, x: f64, y: f64, colour: i32): void => {
  const count: i32 = particleCount(game, 48)
  for (let i: i32 = 0; i < count; i++) {
    const a: f64 = (toF64(i) / toF64(count)) * 2.0 * Math.PI
    const v: f64 = game.fxRng.nextF64() * 25.0 + 50.0
    spawnParticle(
      game.particles,
      x,
      y,
      Math.cos(a) * v,
      Math.sin(a) * v,
      game.fxRng.nextF64() * 0.4 + 1.1,
      1.5,
      colour
    )
  }
  spawnParticle(game.particles, x, y, 0.0, 0.0, 0.3, 6.0, rgb(255, 255, 255))
}

/** `points` floating up from `x`, `y`. */
const floatScore = (game: BreakGame, x: f64, y: f64, points: i32, colour: i32): void => {
  let slot: Floater = game.floaters[0]
  for (const f of game.floaters) {
    if (f.life < slot.life) {
      slot = f
    }
  }
  slot.x = x
  slot.y = y
  slot.prevY = y
  slot.life = 0.8
  slot.value = points
  slot.colour = colour
}

/** The particles, the floating scores, the brick flashes and the shake, every phase but pause. */
const stepEffects = (game: BreakGame): void => {
  stepParticles(game.particles, 140.0, 1.2)
  for (const f of game.floaters) {
    if (f.life > 0.0) {
      f.y = f.y - 22.0 * DT
      f.life = f.life - DT
    }
  }
  for (let i: i32 = 0; i < toI32(game.flashes.length); i++) {
    game.flashes[i] = Math.max(game.flashes[i] - DT, 0.0)
  }
  game.shake = Math.max(game.shake - 12.0 * DT, 0.0)
  if (game.shake > 0.0) {
    game.shakeX = (game.fxRng.nextF64() * 2.0 - 1.0) * game.shake
    game.shakeY = (game.fxRng.nextF64() * 2.0 - 1.0) * game.shake
  } else {
    game.shakeX = 0.0
    game.shakeY = 0.0
  }
}

// ---- Drawing ----------------------------------------------------------------

/** The x a draw at `alpha` puts ball `i` at: `alpha` of the way from its last position to this one. */
export const drawnBallX = (game: BreakGame, i: i32, alpha: f64): f64 => {
  if (i < 0 || i >= toI32(game.balls.length)) {
    return 0.0
  }
  return lerp(game.balls[i].prevX, game.balls[i].x, alpha)
}

/** The y a draw at `alpha` puts ball `i` at. */
export const drawnBallY = (game: BreakGame, i: i32, alpha: f64): f64 => {
  if (i < 0 || i >= toI32(game.balls.length)) {
    return 0.0
  }
  return lerp(game.balls[i].prevY, game.balls[i].y, alpha)
}

/** The level's base hue, in turns: each level its own palette. */
const levelHue = (level: i32): f64 => toF64(level - 1) * 0.13 + 0.55

/** The colour of capsule `kind`. */
const capsuleColour = (kind: i32): i32 => {
  if (kind === CAPSULE_WIDE) {
    return rgb(70, 140, 255)
  }
  if (kind === CAPSULE_MULTI) {
    return rgb(80, 220, 120)
  }
  if (kind === CAPSULE_SLOW) {
    return rgb(240, 200, 60)
  }
  if (kind === CAPSULE_CATCH) {
    return rgb(190, 110, 255)
  }
  if (kind === CAPSULE_FIRE) {
    return rgb(255, 100, 40)
  }
  return rgb(255, 90, 150)
}

/** The letter on capsule `kind`. */
const capsuleLetter = (kind: i32): string => {
  if (kind === CAPSULE_WIDE) {
    return "W"
  }
  if (kind === CAPSULE_MULTI) {
    return "M"
  }
  if (kind === CAPSULE_SLOW) {
    return "S"
  }
  if (kind === CAPSULE_CATCH) {
    return "C"
  }
  if (kind === CAPSULE_FIRE) {
    return "F"
  }
  return "L"
}

/** A brick's face: steel grey, explosive embers, mystery rainbow, and a normal brick its row's hue, deeper the more hits it takes. */
const brickColour = (game: BreakGame, i: i32): i32 => {
  if (i < 0 || i >= toI32(game.kinds.length) || i >= toI32(game.fullHits.length)) {
    return 0
  }
  const kind: i32 = game.kinds[i]
  const t: f64 = toF64(game.ticks) / toF64(STEPS_PER_SECOND)
  if (kind === BRICK_STEEL) {
    return rgb(150, 156, 172)
  }
  if (kind === BRICK_EXPLOSIVE) {
    return mix(rgb(190, 40, 20), rgb(255, 170, 40), Math.sin(t * 7.0) * 0.5 + 0.5)
  }
  if (kind === BRICK_MYSTERY) {
    return hue(t * 0.4 + toF64(i % LEVEL_COLS) * 0.05)
  }
  const row: i32 = i / LEVEL_COLS
  const face: i32 = hue(levelHue(game.level) + toF64(row) * 0.06)
  return dim(face, toF64(game.fullHits[i] - 1) * -0.18 + 1.0)
}

/** The digit `d` as a constant string, so drawing a number allocates nothing. */
const digit = (d: i32): string => {
  if (d === 0) {
    return "0"
  }
  if (d === 1) {
    return "1"
  }
  if (d === 2) {
    return "2"
  }
  if (d === 3) {
    return "3"
  }
  if (d === 4) {
    return "4"
  }
  if (d === 5) {
    return "5"
  }
  if (d === 6) {
    return "6"
  }
  if (d === 7) {
    return "7"
  }
  if (d === 8) {
    return "8"
  }
  return "9"
}

/** `LEVEL n` as a constant string. */
const levelLabel = (level: i32): string => {
  if (level <= 1) {
    return "LEVEL 1"
  }
  if (level === 2) {
    return "LEVEL 2"
  }
  if (level === 3) {
    return "LEVEL 3"
  }
  if (level === 4) {
    return "LEVEL 4"
  }
  if (level === 5) {
    return "LEVEL 5"
  }
  return "LEVEL 6"
}

/** How many digits `value` (at least 0) has. */
const digits = (value: i32): i32 => {
  let n: i32 = 1
  let v: i32 = Math.max(value, 0)
  while (v >= 10) {
    v = v / 10
    n++
  }
  return n
}

/** The width in pixels of `value` drawn at font `scale`. */
const numberWidth = (value: i32, scale: i32): i32 => (digits(value) * GLYPH_ADVANCE - 1) * scale

/**
 * `value` with its top-left at pixel column `px` and world `y`, digit by
 * digit. Each digit's pixel column is turned back into a world x a quarter
 * pixel past it, which `drawText` rounds to exactly that column.
 */
const drawNumberAt = (
  view: View,
  px: i32,
  y: f64,
  scale: i32,
  value: i32,
  colour: i32,
  shadow: i32
): void => {
  if (scale < 1 || !(view.scale > 0.0)) {
    return
  }
  const n: i32 = digits(value)
  let v: i32 = Math.max(value, 0)
  for (let k: i32 = n - 1; k >= 0; k--) {
    const d: string = digit(v % 10)
    v = v / 10
    const x: f64 = (toF64(px + k * GLYPH_ADVANCE * scale) - view.offsetX + 0.25) / view.scale
    if (shadow !== NO_SHADOW) {
      const sx: f64 = x + toF64(scale) / view.scale
      drawText(view, sx, y + toF64(scale) / view.scale, scale, d, shadow)
    }
    drawText(view, x, y, scale, d, colour)
  }
}

/** `value` with its top-left at world `x`, `y`. */
const drawNumber = (view: View, x: f64, y: f64, scale: i32, value: i32, colour: i32, shadow: i32): void => {
  drawNumberAt(
    view,
    toI32(clamp(Math.floor(pixelX(view, x) + 0.5), -1.0e6, 1.0e6)),
    y,
    scale,
    value,
    colour,
    shadow
  )
}

/** `value` centred on world `cx`, its top at `y`. */
const drawNumberCentred = (
  view: View,
  cx: f64,
  y: f64,
  scale: i32,
  value: i32,
  colour: i32,
  shadow: i32
): void => {
  const px: f64 = Math.floor(pixelX(view, cx) + 0.5) - toF64(numberWidth(value, scale) / 2)
  drawNumberAt(view, toI32(clamp(px, -1.0e6, 1.0e6)), y, scale, value, colour, shadow)
}

/** The seconds into the phase a draw at `alpha` shows, between the last step and this one. */
const phaseSeconds = (game: BreakGame, alpha: f64): f64 =>
  Math.max(toF64(game.phaseTime - 1) + clamp(alpha, 0.0, 1.0), 0.0) / toF64(STEPS_PER_SECOND)

/**
 * Paint `game` into `fb` as it stands `alpha` (0 to 1) of the way from the
 * last step to this one: the background, the wall, the capsules, the paddle,
 * the balls, the sparks and the scores, then the HUD and whatever screen the
 * phase puts over it. Any framebuffer size draws, an empty one included.
 */
export const drawBreakGame = (game: BreakGame, fb: Framebuffer, alpha: f64): void => {
  const a: f64 = clamp(alpha, 0.0, 1.0)
  const view: View = game.view
  viewFor(view, fb, lerp(game.prevShakeX, game.shakeX, a), lerp(game.prevShakeY, game.shakeY, a))
  const base: f64 = levelHue(game.level)
  gradient(view, mix(rgb(10, 10, 24), hue(base), 0.12), rgb(2, 2, 8))
  if (!(view.scale > 0.0)) {
    return
  }
  drawField(view, base)
  drawWall(game, view, a)
  drawCapsules(game, view, a)
  drawPaddle(game, view, a)
  drawBalls(game, view, a)
  drawParticles(view, game.particles, a)
  drawFloaters(game, view, a)
  drawHud(game, view)
  drawScreen(game, view, a)
  fillLetterbox(view, rgb(0, 0, 0))
}

/** The rails and the HUD strip. */
const drawField = (view: View, base: f64): void => {
  const rail: i32 = mix(rgb(40, 44, 64), hue(base), 0.25)
  fillRect(view, 0.0, 0.0, 320.0, FIELD_TOP - 2.0, rgb(6, 6, 14))
  fillRect(view, 0.0, FIELD_TOP - 2.0, 320.0, 2.0, rail)
  fillRect(view, 0.0, FIELD_TOP, FIELD_LEFT, WORLD_H - FIELD_TOP, rail)
  fillRect(view, FIELD_RIGHT, FIELD_TOP, 320.0 - FIELD_RIGHT, WORLD_H - FIELD_TOP, rail)
  fillRect(view, FIELD_LEFT - 1.0, FIELD_TOP, 1.0, WORLD_H - FIELD_TOP, add2(rail))
  fillRect(view, FIELD_RIGHT, FIELD_TOP, 1.0, WORLD_H - FIELD_TOP, add2(rail))
}

/** A rail's lit edge. */
const add2 = (c: i32): i32 => mix(c, rgb(255, 255, 255), 0.25)

/** The integer font scale for a glyph about `size` world units tall, at least 1 wherever the view draws. */
const fontScale = (view: View, size: f64): i32 => Math.max(fontScaleFor(view, size), 1)

/** The bricks; in the intro each row drops in, bottom row first, landing with a bounce. */
const drawWall = (game: BreakGame, view: View, alpha: f64): void => {
  const wall: f64 = lerp(game.prevWallOffset, game.wallOffset, alpha)
  const intro: boolean = game.phase === PHASE_INTRO
  const t: f64 = phaseSeconds(game, alpha)
  const glyph: i32 = fontScaleFor(view, BRICK_H - 2.0)
  for (let row: i32 = 0; row < game.rows; row++) {
    let y: f64 = BRICK_TOP + wall + toF64(row) * BRICK_H
    if (intro) {
      const delay: f64 = toF64(game.rows - 1 - row) * 0.09
      const p: f64 = clamp((t - delay) / 0.7, 0.0, 1.0)
      y = y - (1.0 - outBounce(p)) * (y + BRICK_H + 4.0)
    }
    for (let col: i32 = 0; col < LEVEL_COLS; col++) {
      const i: i32 = row * LEVEL_COLS + col
      const kind: i32 = brickAt(game, col, row)
      if (kind === BRICK_NONE || i >= toI32(game.flashes.length) || i >= toI32(game.hits.length)) {
        continue
      }
      const x: f64 = brickX(col)
      let face: i32 = brickColour(game, i)
      if (game.flashes[i] > 0.0) {
        face = mix(face, rgb(255, 255, 255), game.flashes[i] / 0.15)
      }
      bevelBrick(view, x + 1.0, y + 1.0, BRICK_W - 2.0, BRICK_H - 2.0, face)
      if (kind === BRICK_STEEL) {
        disc(view, x + 4.0, y + BRICK_H / 2.0, 1.0, rgb(90, 94, 110))
        disc(view, x + BRICK_W - 4.0, y + BRICK_H / 2.0, 1.0, rgb(90, 94, 110))
      } else if (kind === BRICK_EXPLOSIVE || kind === BRICK_MYSTERY) {
        if (glyph >= 1) {
          drawTextCentred(
            view,
            x + BRICK_W / 2.0,
            y + 1.0,
            glyph,
            kind === BRICK_MYSTERY ? "?" : "*",
            rgb(30, 20, 30),
            NO_SHADOW
          )
        }
      } else {
        // A strong brick shows its hits left as notches.
        for (let k: i32 = 1; k < game.hits[i]; k++) {
          fillRect(
            view,
            x + BRICK_W / 2.0 - 4.0 + toF64(k - 1) * 6.0,
            y + BRICK_H / 2.0 - 0.5,
            2.0,
            1.0,
            dim(face, 0.45)
          )
        }
      }
    }
  }
}

const drawCapsules = (game: BreakGame, view: View, alpha: f64): void => {
  const glyph: i32 = fontScaleFor(view, CAPSULE_H - 1.0)
  for (const c of game.capsules) {
    if (!c.live) {
      continue
    }
    const y: f64 = lerp(c.prevY, c.y, alpha)
    const colour: i32 = capsuleColour(c.kind)
    const r: f64 = CAPSULE_H / 2.0
    if (game.effects > 0) {
      glow(view, c.x, y, CAPSULE_W, colour, 0.35)
    }
    fillRect(view, c.x - CAPSULE_W / 2.0 + r, y - r, CAPSULE_W - 2.0 * r, CAPSULE_H, colour)
    disc(view, c.x - CAPSULE_W / 2.0 + r, y, r, colour)
    disc(view, c.x + CAPSULE_W / 2.0 - r, y, r, colour)
    fillRect(
      view,
      c.x - CAPSULE_W / 2.0 + r,
      y - r + 1.0,
      CAPSULE_W - 2.0 * r,
      1.0,
      mix(colour, rgb(255, 255, 255), 0.5)
    )
    if (glyph >= 1) {
      drawTextCentred(view, c.x, y - 3.0, glyph, capsuleLetter(c.kind), rgb(20, 16, 28), NO_SHADOW)
    }
  }
}

/** The paddle: a bevelled bar with rounded ends, glowing under catch or fire; in the intro it rises into place. */
const drawPaddle = (game: BreakGame, view: View, alpha: f64): void => {
  const x: f64 = lerp(game.prevPaddleX, game.paddleX, alpha)
  const w: f64 = game.tuning.paddleWidth * lerp(game.prevWidthScale, game.widthScale, alpha)
  let y: f64 = PADDLE_Y
  if (game.phase === PHASE_INTRO) {
    y = y + (1.0 - outCubic(clamp(phaseSeconds(game, alpha) / 0.8, 0.0, 1.0))) * 24.0
  }
  let colour: i32 = rgb(205, 214, 235)
  if (game.fireSteps > 0) {
    colour = rgb(255, 150, 80)
  } else if (game.catchSteps > 0) {
    colour = rgb(200, 150, 255)
  }
  if (game.effects > 0) {
    glow(view, x, y + PADDLE_H / 2.0, w * 0.6, colour, 0.25)
  }
  const r: f64 = PADDLE_H / 2.0
  disc(view, x - w / 2.0 + r, y + r, r, dim(colour, 0.8))
  disc(view, x + w / 2.0 - r, y + r, r, dim(colour, 0.8))
  bevelBrick(view, x - w / 2.0 + r, y, Math.max(w - 2.0 * r, 1.0), PADDLE_H, colour)
}

const drawBalls = (game: BreakGame, view: View, alpha: f64): void => {
  const fire: boolean = game.fireSteps > 0
  const colour: i32 = fire ? rgb(255, 170, 60) : rgb(255, 255, 255)
  const trailColour: i32 = fire ? rgb(255, 90, 30) : mix(hue(levelHue(game.level)), rgb(255, 255, 255), 0.4)
  for (let i: i32 = 0; i < toI32(game.balls.length); i++) {
    const b: Ball = game.balls[i]
    if (!b.live) {
      continue
    }
    const x: f64 = drawnBallX(game, i, alpha)
    const y: f64 = drawnBallY(game, i, alpha)
    if (game.effects > 0) {
      drawTrail(view, b.trail, BALL_R * 0.9, trailColour, 0.5)
      glow(view, x, y, BALL_R * 4.0, trailColour, 0.55)
    }
    disc(view, x, y, BALL_R, colour)
  }
}

const drawFloaters = (game: BreakGame, view: View, alpha: f64): void => {
  const scale: i32 = fontScale(view, 5.0)
  for (const f of game.floaters) {
    if (f.life <= 0.0) {
      continue
    }
    const y: f64 = lerp(f.prevY, f.y, alpha)
    drawNumberCentred(
      view,
      f.x,
      y - 3.0,
      scale,
      f.value,
      dim(f.colour, clamp(f.life / 0.4, 0.0, 1.0)),
      NO_SHADOW
    )
  }
}

/**
 * The HUD strip: the score at the left with the combo beside it, the level in
 * the middle, the lives as balls at the right and the timed power-ups before
 * them, each a letter over the bar of time it has left. Where a glyph would be
 * under 7 pixels the strip goes compact: the score and the lives, no labels.
 */
const drawHud = (game: BreakGame, view: View): void => {
  const fit: i32 = fontScaleFor(view, 7.0)
  const compact: boolean = fit < 1
  const scale: i32 = Math.max(fit, 1)
  const white: i32 = rgb(235, 238, 250)
  drawNumber(view, FIELD_LEFT, 2.5, scale, game.score, white, compact ? NO_SHADOW : rgb(0, 0, 0))
  for (let i: i32 = 0; i < game.lives && i < MAX_LIVES; i++) {
    disc(view, FIELD_RIGHT - 3.0 - toF64(i) * 8.0, 6.0, 2.5, rgb(255, 255, 255))
  }
  let x: f64 = FIELD_RIGHT - 12.0 - toF64(game.lives) * 8.0
  x = drawPower(view, x, game.fireSteps, FIRE_STEPS, CAPSULE_FIRE, compact, scale)
  x = drawPower(view, x, game.catchSteps, CATCH_STEPS, CAPSULE_CATCH, compact, scale)
  x = drawPower(view, x, game.slowSteps, SLOW_STEPS, CAPSULE_SLOW, compact, scale)
  x = drawPower(view, x, game.wideSteps, WIDE_STEPS, CAPSULE_WIDE, compact, scale)
  if (compact) {
    return
  }
  if (game.combo >= 2) {
    const px: i32 =
      toI32(clamp(Math.floor(pixelX(view, FIELD_LEFT) + 0.5), -1.0e6, 1.0e6)) +
      numberWidth(game.score, scale) +
      4 * scale
    const wx: f64 = (toF64(px) - view.offsetX + 0.25) / view.scale
    drawText(view, wx, 2.5, scale, "x", rgb(255, 210, 80))
    drawNumberAt(
      view,
      px + GLYPH_ADVANCE * scale,
      2.5,
      scale,
      Math.min(game.combo, MAX_COMBO),
      rgb(255, 210, 80),
      NO_SHADOW
    )
  }
  drawTextCentred(view, 160.0, 2.5, scale, levelLabel(game.level), dim(white, 0.8), rgb(0, 0, 0))
}

/** One timed power-up in the HUD, its right edge at `x`, if it is on; answers where the next one's right edge goes. */
const drawPower = (
  view: View,
  x: f64,
  left: i32,
  full: i32,
  kind: i32,
  compact: boolean,
  scale: i32
): f64 => {
  if (left <= 0) {
    return x
  }
  const colour: i32 = capsuleColour(kind)
  const w: f64 = 16.0
  const share: f64 = clamp(toF64(left) / toF64(Math.max(full, 1)), 0.0, 1.0)
  fillRect(view, x - w, 10.0, w, 1.5, dim(colour, 0.3))
  fillRect(view, x - w, 10.0, w * share, 1.5, colour)
  if (!compact) {
    drawTextCentred(view, x - w / 2.0, 1.5, scale, capsuleLetter(kind), colour, NO_SHADOW)
  }
  return x - w - 4.0
}

/** What the phase puts over the field: the intro banner, the serve prompt, the pause, the tally, the last screens. */
const drawScreen = (game: BreakGame, view: View, alpha: f64): void => {
  const t: f64 = phaseSeconds(game, alpha)
  const big: i32 = fontScale(view, 14.0)
  const small: i32 = fontScale(view, 7.0)
  const shadow: i32 = rgb(0, 0, 0)
  const white: i32 = rgb(240, 242, 255)
  const gold: i32 = rgb(255, 214, 90)
  if (game.phase === PHASE_INTRO) {
    const y: f64 = lerp(-24.0, 92.0, outBack(clamp(t / 0.6, 0.0, 1.0)))
    drawTextCentred(view, 160.0, y, big, levelLabel(game.level), white, shadow)
    drawTextCentred(view, 160.0, y + 20.0, small, levelName(game.level), gold, shadow)
  } else if (game.phase === PHASE_PLAY) {
    if (!game.launched && game.ticks % 70 < 48) {
      drawTextCentred(view, 160.0, 120.0, small, "PRESS SPACE", white, shadow)
    }
  } else if (game.phase === PHASE_PAUSE) {
    blendRect(view, 0.0, 0.0, 320.0, WORLD_H, rgb(0, 0, 0), 0.6)
    drawTextCentred(view, 160.0, 46.0, big, "PAUSED", white, shadow)
    drawTextCentred(view, 160.0, 76.0, small, "ARROWS MOVE", dim(white, 0.8), shadow)
    drawTextCentred(view, 160.0, 88.0, small, "SPACE LAUNCH", dim(white, 0.8), shadow)
    drawTextCentred(view, 160.0, 100.0, small, "P RESUME", dim(white, 0.8), shadow)
    drawTextCentred(view, 160.0, 112.0, small, "Q QUIT", dim(white, 0.8), shadow)
  } else if (game.phase === PHASE_CLEAR) {
    blendRect(view, 0.0, 0.0, 320.0, WORLD_H, rgb(0, 0, 0), 0.35 * clamp(t * 3.0, 0.0, 1.0))
    const y: f64 = lerp(-24.0, 50.0, outBack(clamp(t / 0.5, 0.0, 1.0)))
    drawTextCentred(view, 160.0, y, big, "LEVEL CLEAR", gold, shadow)
    const counted: i32 = tallied(game)
    const time: i32 = Math.min(counted, game.timeBonus)
    drawTextCentred(view, 120.0, 84.0, small, "TIME", dim(white, 0.8), shadow)
    drawNumberCentred(view, 200.0, 84.0, small, time, white, shadow)
    drawTextCentred(view, 120.0, 98.0, small, "LIVES", dim(white, 0.8), shadow)
    drawNumberCentred(view, 200.0, 98.0, small, counted - time, white, shadow)
    drawTextCentred(view, 120.0, 116.0, small, "SCORE", gold, shadow)
    drawNumberCentred(view, 200.0, 116.0, small, game.score, gold, shadow)
  } else {
    const won: boolean = game.phase === PHASE_WON
    blendRect(view, 0.0, 0.0, 320.0, WORLD_H, rgb(0, 0, 0), 0.5 * clamp(t * 2.0, 0.0, 1.0))
    const y: f64 = lerp(-24.0, 56.0, outBounce(clamp(t / 0.9, 0.0, 1.0)))
    drawTextCentred(view, 160.0, y, big, won ? "YOU WIN" : "GAME OVER", won ? gold : rgb(255, 90, 90), shadow)
    drawNumberCentred(view, 160.0, 92.0, big, game.score, white, shadow)
    if (game.phaseTime >= DISMISS_STEPS && game.ticks % 70 < 48) {
      drawTextCentred(view, 160.0, 124.0, small, "PRESS SPACE", dim(white, 0.8), shadow)
    }
  }
}

/** The pixel width of `text` at `scale`, for a caller laying out beside it. */
export const breakTextWidth = (text: string, scale: i32): i32 => textWidth(text, scale)
