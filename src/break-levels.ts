// The six walls of `nish break`, the brick breaker hidden in the CLI, and the
// curve that makes each one harder than the last. `src/break-game.ts` plays
// them; this module is data and arithmetic only, so a test can read a level's
// layout and its numbers without running a frame.
//
// A level is rows of `LEVEL_COLS` characters, one brick a character:
//
//   1 2 3  a normal brick taking that many hits
//   S      steel: unbreakable, and not counted toward clearing the level
//   X      explosive: breaking it breaks its eight neighbours, chaining
//   ?      always drops a power-up
//   .      empty
//
// Rows are one string with no separator, because a module constant can be a
// string and not an array: the layout costs no allocation and no code to build.

/** How many levels there are; the last one cleared wins the game. */
export const BREAK_LEVELS: i32 = 6

/** Bricks across every level's wall. */
export const LEVEL_COLS: i32 = 14

/** The most rows a level may have; the game sizes its brick grid by this. */
export const LEVEL_MAX_ROWS: i32 = 8

/** Brick kind: an empty cell. */
export const BRICK_NONE: i32 = 0

/** Brick kind: a normal brick; its hits left are kept beside it. */
export const BRICK_NORMAL: i32 = 1

/** Brick kind: steel, which only a fireball passes and nothing breaks. */
export const BRICK_STEEL: i32 = 2

/** Brick kind: an explosive brick, which breaks its neighbours when it goes. */
export const BRICK_EXPLOSIVE: i32 = 3

/** Brick kind: a mystery brick, which always drops a power-up. */
export const BRICK_MYSTERY: i32 = 4

/** `level` held to 1..`BREAK_LEVELS`, so any number names a real level. */
export const clampLevel = (level: i32): i32 => Math.min(Math.max(level, 1), BREAK_LEVELS)

/** The rows of `level` (clamped), `LEVEL_COLS` characters each, top first. */
// biome-ignore format: one row a line, so each wall reads as it plays
export const levelMap = (level: i32): string => {
  const n: i32 = clampLevel(level)
  if (n === 1) {
    // First Light: a short plain wall to learn the paddle on.
    return (
      ".111111111111." +
      ".111111111111." +
      ".111111?11111." +
      ".111111111111."
    )
  }
  if (n === 2) {
    // Checkerboard: twos between the ones, and a few mysteries to find.
    return (
      "12121212121212" +
      "21212?21212121" +
      "12121212121212" +
      "2121212121?121" +
      "1?121212121212" +
      "21212121212121"
    )
  }
  if (n === 3) {
    // The Gate: the wall sits behind a steel line with one gap, and steel posts below deflect the approach.
    return (
      "..2222222222.." +
      ".211111111112." +
      ".21?111111?12." +
      ".211111111112." +
      ".222222222222." +
      "SSSSSS..SSSSSS" +
      "..S........S.."
    )
  }
  if (n === 4) {
    // Powder Keg: explosives threaded through twos and threes; one good hit takes a row.
    return (
      "33333333333333" +
      "3222X2222X2223" +
      "32X222?222X223" +
      "3222X2222X2223" +
      "22222222222222" +
      "X222222?22222X"
    )
  }
  if (n === 5) {
    // Invaders: two of them in threes, mysteries for eyes, behind a steel line with four gaps.
    return (
      "..3..3...3..3." +
      ".333333.333333" +
      ".3?33?3.3?33?3" +
      ".333333.333333" +
      "..3..3...3..3." +
      ".3....3.3....3" +
      ".............." +
      "S.SS.SSSS.SS.S"
    )
  }
  // NISH: the name in threes under a roof of twos, and the whole wall advances on the paddle. No steel: a wall
  // that marches cannot hold a row nothing breaks, or the clock would always win.
  return (
    "222?222222?222" +
    "3..3.3.333.3.3" +
    "33.3.3.3...3.3" +
    "3.33.3.333.333" +
    "3..3.3...3.3.3" +
    "3..3.3.333.3.3"
  )
}

/** How many rows `level` (clamped) has. */
export const levelRows = (level: i32): i32 => toI32(levelMap(level).length) / LEVEL_COLS

/** The name the intro banner shows under `LEVEL n`. */
export const levelName = (level: i32): string => {
  const n: i32 = clampLevel(level)
  if (n === 1) {
    return "FIRST LIGHT"
  }
  if (n === 2) {
    return "CHECKERBOARD"
  }
  if (n === 3) {
    return "THE GATE"
  }
  if (n === 4) {
    return "POWDER KEG"
  }
  if (n === 5) {
    return "INVADERS"
  }
  return "NISH"
}

/** The brick kind (`BRICK_*`) a map character makes. */
export const brickKind = (c: i32): i32 => {
  if (c === 49 || c === 50 || c === 51) {
    return BRICK_NORMAL
  }
  if (c === 83) {
    return BRICK_STEEL
  }
  if (c === 88) {
    return BRICK_EXPLOSIVE
  }
  if (c === 63) {
    return BRICK_MYSTERY
  }
  return BRICK_NONE
}

/** The hits a map character takes to break: its digit for a normal brick, 1 for the rest, 0 for empty. */
export const brickHits = (c: i32): i32 => {
  if (c >= 49 && c <= 51) {
    return c - 48
  }
  return brickKind(c) === BRICK_NONE ? 0 : 1
}

// ---- The difficulty curve ---------------------------------------------------
//
// Each level multiplies: the ball is 1.25 times as fast, the paddle 0.8 times
// as wide, so speed over width, which is what makes a ball hard to catch,
// grows by 1.25 / 0.8 = 1.5625 a level. The speed-up a paddle hit adds grows
// 1.5 times a level and the chance a brick drops a power-up shrinks to 0.6 of
// the last level's, so late levels get faster within the level too and give
// less help. Every number is a formula of `k = level - 1`; nothing is tuned
// by hand per level.

/** Ball speed on level 1, in world units a second. */
const BASE_BALL_SPEED: f64 = 90.0

/** Paddle width on level 1, in world units. */
const BASE_PADDLE_WIDTH: f64 = 48.0

/** What a paddle hit multiplies the speed by on level 1, less one: 1%. */
const BASE_SPEED_UP: f64 = 0.01

/** The chance a broken brick drops a power-up on level 1: one in six. */
const BASE_DROP_CHANCE: f64 = 1.0 / 6.0

/** How far above its serve speed a ball may climb: 60%, so the cap rises with the level. */
const SPEED_CAP: f64 = 1.6

/** The numbers that make one level as hard as it is. */
export class LevelTuning {
  /** Serve speed in world units a second: 90 × 1.25^k. */
  ballSpeed: f64
  /** Paddle width in world units: 48 × 0.8^k. */
  paddleWidth: f64
  /** What each paddle hit adds to the speed, as a fraction: 1% × 1.5^k. */
  speedUp: f64
  /** The chance a broken brick drops a power-up: (1/6) × 0.6^k. */
  dropChance: f64
  /** The fastest the ball may go: `SPEED_CAP` × the serve speed. */
  maxSpeed: f64
  /** Seconds between the wall advancing a row; 0 where it stays put (every level but the last). */
  advanceSeconds: f64
  /** What the slow power-up multiplies the speed by: less slowing on the last level. */
  slowFactor: f64

  /** Level 1's numbers; `levelTuning` fills in the rest. */
  constructor() {
    this.ballSpeed = BASE_BALL_SPEED
    this.paddleWidth = BASE_PADDLE_WIDTH
    this.speedUp = BASE_SPEED_UP
    this.dropChance = BASE_DROP_CHANCE
    this.maxSpeed = BASE_BALL_SPEED * SPEED_CAP
    this.advanceSeconds = 0.0
    this.slowFactor = 0.6
  }
}

/** The tuning of `level` (clamped), each number from its formula. */
export const levelTuning = (level: i32): LevelTuning => {
  const n: i32 = clampLevel(level)
  const k: f64 = toF64(n - 1)
  const tuning = new LevelTuning()
  tuning.ballSpeed = BASE_BALL_SPEED * Math.pow(1.25, k)
  tuning.paddleWidth = BASE_PADDLE_WIDTH * Math.pow(0.8, k)
  tuning.speedUp = BASE_SPEED_UP * Math.pow(1.5, k)
  tuning.dropChance = BASE_DROP_CHANCE * Math.pow(0.6, k)
  tuning.maxSpeed = tuning.ballSpeed * SPEED_CAP
  tuning.advanceSeconds = n === BREAK_LEVELS ? 12.0 : 0.0
  tuning.slowFactor = n === BREAK_LEVELS ? 0.85 : 0.6
  return tuning
}
