// The brick breaker behind `nish break` (`src/break-game.ts`, `src/break-levels.ts`),
// driven step by step: the difficulty formulas, every phase from the intro to
// the last screen, the swept ball against the rails, the bricks and the paddle,
// each power-up, combos, the clear and its tally, the advancing wall, pause and
// quit, the sounds each step asks for, and the draw at every scene and size.
// The negatives are the inputs a screen must ignore (a confirm before the
// dismiss delay, a step after the result) and the framebuffers too small to
// draw in, which must never panic.
import { Suite } from "../../../std/testing"
import { Framebuffer } from "../../../std/term-pixels"
import {
  ACTION_PRESS,
  ACTION_RELEASE,
  EVENT_KEY,
  KEY_CHAR,
  KEY_ENTER,
  KEY_ESCAPE,
  KEY_RIGHT,
  KEY_SPACE,
  KeyState,
  TermEvent
} from "../../../std/term"
import { TermInput } from "../../../std/term-io"
import { GLYPH_H, dim, gfxRgb } from "../../../src/break-gfx"
import {
  BRICK_EXPLOSIVE,
  BRICK_MYSTERY,
  BRICK_NONE,
  BRICK_NORMAL,
  BRICK_STEEL,
  BREAK_LEVELS,
  LEVEL_COLS,
  brickHits,
  brickKind,
  clampLevel,
  levelName,
  levelRows,
  levelTuning
} from "../../../src/break-levels"
import {
  BALL_R,
  BRICK_H,
  BRICK_TOP,
  BRICK_W,
  BreakGame,
  CAPSULE_CATCH,
  CAPSULE_FIRE,
  CAPSULE_LIFE,
  CAPSULE_MULTI,
  CAPSULE_SLOW,
  CAPSULE_WIDE,
  CATCH_STEPS,
  CLEAR_HOLD_STEPS,
  DISMISS_STEPS,
  FIELD_LEFT,
  FIELD_RIGHT,
  FIELD_TOP,
  FIRE_STEPS,
  GAME_OVER,
  GAME_PLAYING,
  GAME_QUIT,
  GAME_WON,
  INTRO_STEPS,
  MAX_BOUNCE,
  MAX_COMBO,
  MAX_LIVES,
  PADDLE_Y,
  PHASE_CLEAR,
  PHASE_INTRO,
  PHASE_OVER,
  PHASE_PAUSE,
  PHASE_PLAY,
  PHASE_WON,
  SLOW_STEPS,
  SOUND_ADVANCE,
  SOUND_BREAK,
  SOUND_CAPSULE,
  SOUND_CLEAR,
  SOUND_CRACK,
  SOUND_EXPLODE,
  SOUND_LAUNCH,
  SOUND_LOSE,
  SOUND_OVER,
  SOUND_PADDLE,
  SOUND_STEEL,
  SOUND_WALL,
  TALLY_STEPS,
  WIDE_STEPS,
  applyPower,
  ballSpeed,
  breakTextWidth,
  brickAt,
  brickX,
  brickY,
  drawBreakGame,
  drawnBallX,
  drawnBallY,
  hitsAt,
  liveBalls,
  livesBonusFor,
  loadLevel,
  newBreakGame,
  paddleWidth,
  spawnCapsule,
  stepBreakGame,
  tallied,
  timeBonusFor,
  wallBottom
} from "../../../src/break-game"

/** `t.eqF64`, as a function so its literal arguments are typed `f64` by the parameters. */
const eqF = (t: Suite, name: string, actual: f64, expected: f64): boolean => t.eqF64(name, actual, expected)

/** `t.nearF64`, as a function for the same reason. */
const nearF = (t: Suite, name: string, actual: f64, expected: f64, tolerance: f64): boolean =>
  t.nearF64(name, actual, expected, tolerance)

/** The clock every key event is applied at: held keys never time out. */
const NOW: f64 = 0.0

// ---- Input --------------------------------------------------------------------

const keyEvent = (key: i32, code: i32, action: i32): TermEvent => {
  const e = new TermEvent(EVENT_KEY)
  e.key = key
  e.code = code
  e.action = action
  return e
}

/** A step with no input. */
const idle = (game: BreakGame, input: TermInput): i32 => {
  input.events = []
  return stepBreakGame(game, input)
}

/** A step with one key pressed, as a fresh press: it never reaches the held keys, so a second tap is not a repeat. */
const tap = (game: BreakGame, input: TermInput, key: i32, code: i32): i32 => {
  input.events = [keyEvent(key, code, ACTION_PRESS)]
  return stepBreakGame(game, input)
}

const idleFor = (game: BreakGame, input: TermInput, steps: i32): void => {
  for (let i: i32 = 0; i < steps; i++) {
    idle(game, input)
  }
}

const newInput = (): TermInput => new TermInput(new KeyState())

/** A game on `level` past its intro, the ball still on the paddle. */
const playing = (level: i32, input: TermInput): BreakGame => {
  const game = newBreakGame(level, toI64(7))
  tap(game, input, KEY_CHAR, 122)
  return game
}

/** Ball 0 set flying from `x`, `y` along `dx`, `dy`. */
const fly = (game: BreakGame, x: f64, y: f64, dx: f64, dy: f64): void => {
  const b = game.balls[0]
  b.live = true
  b.stuck = false
  b.x = x
  b.y = y
  b.prevX = x
  b.prevY = y
  b.dx = dx
  b.dy = dy
  game.launched = true
}

const colCentre = (col: i32): f64 => brickX(col) + BRICK_W / 2.0

const liveCapsules = (game: BreakGame): i32 => {
  let n: i32 = 0
  for (const c of game.capsules) {
    if (c.live) {
      n++
    }
  }
  return n
}

const liveParticles = (game: BreakGame): i32 => {
  let n: i32 = 0
  for (let i: i32 = 0; i < game.particles.capacity(); i++) {
    if (game.particles.lives[i] > 0.0) {
      n++
    }
  }
  return n
}

/** Every brick of the wall gone, so the next play step clears the level. */
const emptyWall = (game: BreakGame): void => {
  game.kinds.fill(BRICK_NONE)
  game.hits.fill(0)
  game.bricksLeft = 0
}

/** Whether the last step asked for sound `id`. */
const asked = (game: BreakGame, id: i32): boolean => game.sounds.indexOf(id) >= 0

/** Steps `game` up to `steps` times, stopping at the first step that asks for `id`; answers whether one did. */
const heard = (game: BreakGame, input: TermInput, id: i32, steps: i32): boolean => {
  for (let i: i32 = 0; i < steps; i++) {
    idle(game, input)
    if (asked(game, id)) {
      return true
    }
  }
  return false
}

/** Whether the last step asked for any sound twice. */
const repeated = (game: BreakGame): boolean => {
  for (let i: i32 = 0; i < toI32(game.sounds.length); i++) {
    if (game.sounds.indexOf(game.sounds[i]) !== i) {
      return true
    }
  }
  return false
}

// ---- The difficulty curve -------------------------------------------------------

const testLevels = (t: Suite): void => {
  t.eqI32("six levels", BREAK_LEVELS, 6)
  t.eqI32("level 0 clamps to 1", clampLevel(0), 1)
  t.eqI32("level 7 clamps to 6", clampLevel(7), 6)
  t.eqI32("newBreakGame clamps a low level", newBreakGame(-3, toI64(1)).level, 1)
  t.eqI32("newBreakGame clamps a high level", newBreakGame(99, toI64(1)).level, 6)
  t.eqStr("level 1 is First Light", levelName(1), "FIRST LIGHT")
  t.eqStr("level 6 is NISH", levelName(6), "NISH")
  t.eqI32("level 1 has 4 rows", levelRows(1), 4)
  t.eqI32("level 5 has 8 rows", levelRows(5), 8)
  t.eqI32("'3' is a normal brick", brickKind(51), BRICK_NORMAL)
  t.eqI32("'3' takes three hits", brickHits(51), 3)
  t.eqI32("'S' is steel", brickKind(83), BRICK_STEEL)
  t.eqI32("'X' is explosive", brickKind(88), BRICK_EXPLOSIVE)
  t.eqI32("'?' is a mystery", brickKind(63), BRICK_MYSTERY)
  t.eqI32("'.' is empty and takes no hits", brickHits(46), 0)
  let rising: boolean = true
  let formulas: boolean = true
  for (let n: i32 = 1; n <= BREAK_LEVELS; n++) {
    const k: f64 = toF64(n - 1)
    const tu = levelTuning(n)
    formulas =
      formulas &&
      Math.abs(tu.ballSpeed - Math.pow(1.25, k) * 90.0) < 1.0e-9 &&
      Math.abs(tu.paddleWidth - Math.pow(0.8, k) * 48.0) < 1.0e-9 &&
      Math.abs(tu.speedUp - Math.pow(1.5, k) * 0.01) < 1.0e-12 &&
      Math.abs(tu.dropChance - Math.pow(0.6, k) / 6.0) < 1.0e-12 &&
      Math.abs(tu.maxSpeed - tu.ballSpeed * 1.6) < 1.0e-9
    if (n > 1) {
      const prev = levelTuning(n - 1)
      const ratio: f64 = tu.ballSpeed / tu.paddleWidth / (prev.ballSpeed / prev.paddleWidth)
      rising = rising && ratio >= 1.5
    }
  }
  t.ok("every level's numbers are their formulas", formulas)
  t.ok("speed over width grows at least 1.5x a level", rising)
  nearF(t, "level 6 serves at 90 x 1.25^5", levelTuning(6).ballSpeed, 274.658203125, 1.0e-9)
  nearF(t, "level 6's paddle is 48 x 0.8^5", levelTuning(6).paddleWidth, 15.72864, 1.0e-9)
  eqF(t, "level 5's wall stays put", levelTuning(5).advanceSeconds, NOW)
  eqF(t, "level 6's wall advances every 12 s", levelTuning(6).advanceSeconds, 12.0)
  eqF(t, "slow slows to 0.6", levelTuning(1).slowFactor, 0.6)
  eqF(t, "slow slows less on level 6", levelTuning(6).slowFactor, 0.85)
  const game = newBreakGame(1, toI64(1))
  t.eqI32("level 1 has 48 bricks to break", game.bricksLeft, 48)
  eqF(t, "the game takes its level's serve speed", ballSpeed(game), 90.0)
  eqF(t, "the game takes its level's paddle", paddleWidth(game), 48.0)
  const gate = newBreakGame(3, toI64(1))
  t.eqI32("steel does not count toward a clear", gate.bricksLeft, 58)
  t.eqI32("level 3 row 5 is steel", brickAt(gate, 0, 5), BRICK_STEEL)
  t.eqI32("a two takes two hits", hitsAt(gate, 2, 0), 2)
  t.eqI32("off the grid is empty", brickAt(gate, LEVEL_COLS, 0), BRICK_NONE)
  t.eqI32("off the grid takes no hits", hitsAt(gate, -1, 0), 0)
}

// ---- Intro, serve and launch ---------------------------------------------------

const testIntro = (t: Suite): void => {
  const input = newInput()
  const game = newBreakGame(1, toI64(7))
  t.eqI32("a new game starts in its intro", game.phase, PHASE_INTRO)
  t.eqI32("a new game has three lives", game.lives, 3)
  idleFor(game, input, INTRO_STEPS - 1)
  t.eqI32("the intro lasts its steps", game.phase, PHASE_INTRO)
  t.eqI32("the intro answers playing", idle(game, input), GAME_PLAYING)
  t.eqI32("the intro ends on its own", game.phase, PHASE_PLAY)
  const skipped = newBreakGame(1, toI64(7))
  tap(skipped, input, KEY_CHAR, 120)
  t.eqI32("a key skips the intro", skipped.phase, PHASE_PLAY)
  t.ok("the ball waits on the paddle", skipped.balls[0].stuck)
  t.eqI32("one ball is served", liveBalls(skipped), 1)

  // A held key moves the paddle, faster the longer it is held, and the stuck ball rides along.
  const start: f64 = skipped.paddleX
  input.keys.apply([keyEvent(KEY_RIGHT, 0, ACTION_PRESS)], NOW)
  input.events = []
  stepBreakGame(skipped, input)
  const first: f64 = skipped.paddleX - start
  idleFor(skipped, input, 20)
  const later: f64 = skipped.paddleX - skipped.prevPaddleX
  input.keys.apply([keyEvent(KEY_RIGHT, 0, ACTION_RELEASE)], NOW)
  t.ok("a held key moves the paddle right", first > 0.0)
  t.ok("a held key speeds the paddle up", later > first)
  eqF(t, "the stuck ball rides the paddle", skipped.balls[0].x, skipped.paddleX)
  idleFor(skipped, input, 600)
  t.ok("the paddle stops at the right rail", skipped.paddleX <= FIELD_RIGHT - paddleWidth(skipped) / 2.0)
  eqF(t, "a released key stops the paddle", skipped.paddleV, NOW)

  tap(skipped, input, KEY_SPACE, 0)
  t.ok("space launches the ball", !skipped.balls[0].stuck)
  t.ok("the ball leaves upward", skipped.balls[0].dy < 0.0)
  t.ok("a launch starts the clock", skipped.launched)
  t.eqI32("the clock counts launched steps", skipped.playSteps, 1)

  const a = playing(1, input)
  const b = newBreakGame(1, toI64(8))
  tap(b, input, KEY_CHAR, 122)
  tap(a, input, KEY_SPACE, 0)
  tap(b, input, KEY_SPACE, 0)
  t.ok("the serve angle comes from the seed", a.balls[0].dx !== b.balls[0].dx)
  t.ok("the serve stays within 18 degrees of upright", Math.abs(a.balls[0].dx) <= Math.sin(MAX_BOUNCE / 4.0) + 1.0e-9)
  const c = playing(1, input)
  tap(c, input, KEY_SPACE, 0)
  eqF(t, "the same seed serves the same way", c.balls[0].dx, a.balls[0].dx)
}

// ---- The swept ball -----------------------------------------------------------------

const testPhysics = (t: Suite): void => {
  const input = newInput()

  const left = playing(1, input)
  fly(left, 12.0, 100.0, -0.8, -0.6)
  idleFor(left, input, 8)
  t.ok("the left rail turns the ball right", left.balls[0].dx > 0.0)
  t.ok("the ball never passes the left rail", left.balls[0].x >= FIELD_LEFT + BALL_R)

  const right = playing(1, input)
  fly(right, FIELD_RIGHT - 6.0, 100.0, 0.8, -0.6)
  idleFor(right, input, 8)
  t.ok("the right rail turns the ball left", right.balls[0].dx < 0.0)
  t.ok("the ball never passes the right rail", right.balls[0].x <= FIELD_RIGHT - BALL_R)

  // Column 0 of level 1 is empty, so a ball straight up it meets the ceiling.
  const top = playing(1, input)
  fly(top, colCentre(0), 60.0, 0.0, -1.0)
  idleFor(top, input, 70)
  t.ok("the ceiling turns the ball down", top.balls[0].dy > 0.0)
  t.ok("the ball never passes the ceiling", top.balls[0].y >= FIELD_TOP + BALL_R - 1.0e-9)

  const brick = playing(1, input)
  const before: i32 = brick.bricksLeft
  fly(brick, colCentre(5), 70.0, 0.0, -1.0)
  idleFor(brick, input, 12)
  t.ok("a brick turns the ball down", brick.balls[0].dy > 0.0)
  t.eqI32("the brick hit breaks", brickAt(brick, 5, 3), BRICK_NONE)
  t.eqI32("the brick above it stands", brickAt(brick, 5, 2), BRICK_NORMAL)
  t.eqI32("one brick fewer to clear", brick.bricksLeft, before - 1)
  t.eqI32("a one-hit brick scores 10", brick.score, 10)
  t.eqI32("a break starts the combo", brick.combo, 1)
  t.ok("the ball stops at the brick's face", brick.balls[0].y >= brickY(brick, 3) + BRICK_H + BALL_R - 1.0e-9)

  // Far past any speed the curve reaches, the sweep still meets a 9-unit brick: 2000 u/s is 16.7 units a step.
  const fast = playing(6, input)
  fast.speed = 2000.0
  fly(fast, colCentre(4), 150.0, 0.0, -1.0)
  let steps: i32 = 0
  while (hitsAt(fast, 4, 0) === 2 && steps < 100) {
    idle(fast, input)
    steps++
  }
  t.eqI32("a ball at 2000 u/s dents the brick it meets", hitsAt(fast, 4, 0), 1)
  t.ok("a ball at 2000 u/s bounces off a brick", fast.balls[0].dy > 0.0)
  t.ok("a ball at 2000 u/s never enters a brick", fast.balls[0].y >= brickY(fast, 0) + BRICK_H + BALL_R - 1.0e-9)

  const fall = playing(6, input)
  fall.speed = 2000.0
  fly(fall, fall.paddleX, 100.0, 0.0, 1.0)
  steps = 0
  while (fall.balls[0].dy > 0.0 && steps < 100) {
    idle(fall, input)
    steps++
  }
  t.ok("a ball at 2000 u/s comes back off the paddle", fall.balls[0].live && fall.balls[0].dy < 0.0)
  t.ok("a ball at 2000 u/s never enters the paddle", fall.balls[0].y <= PADDLE_Y - BALL_R + 1.0e-9)
}

const testPaddle = (t: Suite): void => {
  const input = newInput()
  const centre = playing(1, input)
  centre.combo = 5
  fly(centre, centre.paddleX, PADDLE_Y - 10.0, 0.0, 1.0)
  idleFor(centre, input, 20)
  nearF(t, "the paddle's centre sends the ball straight up", centre.balls[0].dx, 0.0, 1.0e-9)
  t.ok("the paddle sends the ball up", centre.balls[0].dy < 0.0)
  nearF(t, "a paddle hit speeds the ball up by the level's speed-up", ballSpeed(centre), 90.9, 1.0e-9)
  t.eqI32("a paddle hit ends the combo", centre.combo, 0)

  const edge = playing(1, input)
  const half: f64 = paddleWidth(edge) / 2.0
  const x: f64 = edge.paddleX + half
  fly(edge, x, PADDLE_Y - 10.0, 0.0, 1.0)
  idleFor(edge, input, 20)
  const f: f64 = half / (half + BALL_R)
  nearF(t, "the paddle's end turns the ball out", edge.balls[0].dx, Math.sin(f * MAX_BOUNCE), 1.0e-9)
  t.ok("no bounce leaves flatter than 70 degrees", Math.abs(edge.balls[0].dx) <= Math.sin(MAX_BOUNCE) + 1.0e-9)

  const leftEdge = playing(1, input)
  fly(leftEdge, leftEdge.paddleX - half, PADDLE_Y - 10.0, 0.0, 1.0)
  idleFor(leftEdge, input, 20)
  nearF(t, "the left end turns the ball left", leftEdge.balls[0].dx, -Math.sin(f * MAX_BOUNCE), 1.0e-9)

  const capped = playing(1, input)
  capped.speed = capped.tuning.maxSpeed
  fly(capped, capped.paddleX, PADDLE_Y - 10.0, 0.0, 1.0)
  idleFor(capped, input, 10)
  eqF(t, "a paddle hit never passes the speed cap", ballSpeed(capped), capped.tuning.maxSpeed)
}

// ---- Bricks, combos and capsules -------------------------------------------------

const testBricks = (t: Suite): void => {
  const input = newInput()

  // A line of explosives across row 3: hitting the last one breaks the rest, and their neighbours.
  const keg = playing(1, input)
  for (let col: i32 = 3; col <= 6; col++) {
    keg.kinds[3 * LEVEL_COLS + col] = BRICK_EXPLOSIVE
  }
  const before: i32 = keg.bricksLeft
  fly(keg, colCentre(6), 70.0, 0.0, -1.0)
  idleFor(keg, input, 12)
  t.eqI32("the explosive hit breaks", brickAt(keg, 6, 3), BRICK_NONE)
  t.eqI32("an explosion breaks its neighbour above", brickAt(keg, 6, 2), BRICK_NONE)
  t.eqI32("an explosion chains to the next explosive", brickAt(keg, 3, 3), BRICK_NONE)
  t.eqI32("the chain reaches the far explosive's neighbour", brickAt(keg, 2, 2), BRICK_NONE)
  t.eqI32("the chain stops where the explosives end", brickAt(keg, 1, 3), BRICK_NORMAL)
  t.eqI32("the chain stops two rows up", brickAt(keg, 4, 1), BRICK_NORMAL)
  t.eqI32("twelve bricks break in one hit", keg.bricksLeft, before - 12)
  t.eqI32("each break in a chain grows the combo", keg.combo, 12)
  t.ok("an explosion shakes the screen", keg.shake > 0.0)
  t.ok("an explosion throws sparks", liveParticles(keg) > 0)

  const combo = playing(1, input)
  combo.combo = 2
  fly(combo, colCentre(5), 70.0, 0.0, -1.0)
  idleFor(combo, input, 12)
  t.eqI32("the third break in a combo scores triple", combo.score, 30)
  const capped = playing(1, input)
  capped.combo = 50
  fly(capped, colCentre(5), 70.0, 0.0, -1.0)
  idleFor(capped, input, 12)
  t.eqI32("the combo multiplier stops at 8", capped.score, 10 * MAX_COMBO)

  const two = playing(2, input)
  t.eqI32("level 2 row 5 col 0 takes two hits", hitsAt(two, 0, 5), 2)
  fly(two, colCentre(0), 120.0, 0.0, -1.0)
  idleFor(two, input, 60)
  t.eqI32("one hit dents a two", hitsAt(two, 0, 5), 1)
  t.eqI32("a dent scores nothing", two.score, 0)

  const mystery = playing(1, input)
  mystery.kinds[3 * LEVEL_COLS + 5] = BRICK_MYSTERY
  fly(mystery, colCentre(5), 70.0, 0.0, -1.0)
  idleFor(mystery, input, 12)
  t.eqI32("a mystery brick scores 15", mystery.score, 15)
  t.eqI32("a mystery brick always drops a capsule", liveCapsules(mystery), 1)

  const steel = playing(3, input)
  fly(steel, colCentre(0), 120.0, 0.0, -1.0)
  idleFor(steel, input, 40)
  t.eqI32("steel never breaks", brickAt(steel, 0, 5), BRICK_STEEL)
  t.ok("steel turns the ball", steel.balls[0].dy > 0.0)
}

const testPowers = (t: Suite): void => {
  const input = newInput()

  const wide = playing(1, input)
  applyPower(wide, CAPSULE_WIDE)
  t.eqI32("wide lasts 15 s", wide.wideSteps, WIDE_STEPS)
  idleFor(wide, input, 120)
  nearF(t, "wide grows the paddle half again", paddleWidth(wide), 72.0, 1.0e-3)
  wide.wideSteps = 2
  idleFor(wide, input, 120)
  t.eqI32("a power runs out", wide.wideSteps, 0)
  nearF(t, "the paddle shrinks back when wide runs out", paddleWidth(wide), 48.0, 1.0e-3)

  const multi = playing(1, input)
  applyPower(multi, CAPSULE_MULTI)
  t.eqI32("multi makes three balls", liveBalls(multi), 3)
  t.ok("multi launches a waiting ball", multi.launched && !multi.balls[0].stuck)
  t.ok("multi splits the balls apart", multi.balls[1].dx > 0.0 && multi.balls[2].dx < 0.0)
  for (let i: i32 = 0; i < 4; i++) {
    applyPower(multi, CAPSULE_MULTI)
  }
  t.eqI32("multi stops at the pool's eight balls", liveBalls(multi), 8)

  const slow = playing(1, input)
  applyPower(slow, CAPSULE_SLOW)
  t.eqI32("slow lasts 10 s", slow.slowSteps, SLOW_STEPS)
  idleFor(slow, input, 400)
  nearF(t, "slow eases the ball to 0.6 of its speed", ballSpeed(slow), 54.0, 1.0e-3)
  const slow6 = playing(6, input)
  applyPower(slow6, CAPSULE_SLOW)
  idleFor(slow6, input, 400)
  nearF(t, "slow eases level 6's ball only to 0.85", ballSpeed(slow6), slow6.speed * 0.85, 1.0e-3)

  const sticky = playing(1, input)
  applyPower(sticky, CAPSULE_CATCH)
  t.eqI32("catch lasts 15 s", sticky.catchSteps, CATCH_STEPS)
  const off: f64 = 10.0
  fly(sticky, sticky.paddleX + off, PADDLE_Y - 10.0, 0.0, 1.0)
  idleFor(sticky, input, 20)
  t.ok("catch holds the ball on the paddle", sticky.balls[0].stuck)
  nearF(t, "a caught ball keeps where it landed", sticky.balls[0].stickOffset, off, 1.0e-9)
  tap(sticky, input, KEY_SPACE, 0)
  const half: f64 = paddleWidth(sticky) / 2.0 + BALL_R
  nearF(t, "a caught ball leaves at its landing angle", sticky.balls[0].dx, Math.sin((off / half) * MAX_BOUNCE), 1.0e-9)

  // A fireball goes up column 5 through all four rows of level 1 and on to the ceiling.
  const fire = playing(1, input)
  applyPower(fire, CAPSULE_FIRE)
  t.eqI32("fire lasts 8 s", fire.fireSteps, FIRE_STEPS)
  fly(fire, colCentre(5), 70.0, 0.0, -1.0)
  idleFor(fire, input, 64)
  let column: boolean = true
  for (let row: i32 = 0; row < 4; row++) {
    column = column && brickAt(fire, 5, row) === BRICK_NONE
  }
  t.ok("a fireball breaks every brick in its path", column)
  t.ok("a fireball carries on through", fire.balls[0].dy < 0.0)
  t.ok("a fireball reaches past the wall", fire.balls[0].y < BRICK_TOP)
  const fireSteel = playing(3, input)
  applyPower(fireSteel, CAPSULE_FIRE)
  fly(fireSteel, colCentre(0), 120.0, 0.0, -1.0)
  idleFor(fireSteel, input, 80)
  t.eqI32("a fireball leaves steel standing", brickAt(fireSteel, 0, 5), BRICK_STEEL)
  t.ok("a fireball passes through steel", fireSteel.balls[0].dy < 0.0 && fireSteel.balls[0].y < brickY(fireSteel, 5))

  const life = playing(1, input)
  applyPower(life, CAPSULE_LIFE)
  t.eqI32("a life capsule adds a life", life.lives, 4)
  for (let i: i32 = 0; i < 10; i++) {
    applyPower(life, CAPSULE_LIFE)
  }
  t.eqI32("lives stop at 9", life.lives, MAX_LIVES)

  const caught = playing(1, input)
  spawnCapsule(caught, caught.paddleX, PADDLE_Y - 20.0, CAPSULE_LIFE)
  idleFor(caught, input, 60)
  t.eqI32("a caught capsule takes effect", caught.lives, 4)
  t.eqI32("a caught capsule scores 50", caught.score, 50)
  t.eqI32("a caught capsule is gone", liveCapsules(caught), 0)
  const missed = playing(1, input)
  spawnCapsule(missed, 20.0, PADDLE_Y - 20.0, CAPSULE_LIFE)
  idleFor(missed, input, 120)
  t.eqI32("a missed capsule does nothing", missed.lives, 3)
  t.eqI32("a missed capsule falls away", liveCapsules(missed), 0)
  for (let i: i32 = 0; i < 12; i++) {
    spawnCapsule(missed, 20.0, 40.0, CAPSULE_WIDE)
  }
  t.eqI32("capsules stop at the pool's eight", liveCapsules(missed), 8)
}

// ---- Lives, the clear and the last screens ----------------------------------------

const testLives = (t: Suite): void => {
  const input = newInput()
  const game = playing(1, input)
  game.combo = 4
  applyPower(game, CAPSULE_WIDE)
  fly(game, 20.0, 150.0, 0.0, 1.0)
  idleFor(game, input, 60)
  t.eqI32("a lost ball costs a life", game.lives, 2)
  t.ok("a lost life serves a new ball on the paddle", game.balls[0].live && game.balls[0].stuck)
  t.eqI32("a lost life ends the combo", game.combo, 0)
  t.eqI32("a lost life ends the powers", game.wideSteps, 0)
  t.eqI32("a lost life keeps playing", game.phase, PHASE_PLAY)

  applyPower(game, CAPSULE_MULTI)
  game.balls[1].live = false
  game.balls[2].x = 20.0
  game.balls[2].y = 150.0
  game.balls[2].dx = 0.0
  game.balls[2].dy = 1.0
  idleFor(game, input, 60)
  t.eqI32("one ball left in play keeps the life", game.lives, 2)

  game.lives = 1
  for (const b of game.balls) {
    b.live = false
  }
  fly(game, 20.0, 150.0, 0.0, 1.0)
  let steps: i32 = 0
  while (game.phase === PHASE_PLAY && steps < 100) {
    idle(game, input)
    steps++
  }
  t.eqI32("the last life lost is game over", game.phase, PHASE_OVER)
  t.eqI32("game over leaves no lives", game.lives, 0)
  idleFor(game, input, DISMISS_STEPS - 2)
  t.eqI32("confirm before the dismiss delay is ignored", tap(game, input, KEY_ENTER, 0), GAME_PLAYING)
  t.eqI32("confirm after the delay answers game over", tap(game, input, KEY_ENTER, 0), GAME_OVER)
  t.eqI32("the answer sticks", idle(game, input), GAME_OVER)
  const ticks: i32 = game.ticks
  tap(game, input, KEY_SPACE, 0)
  t.eqI32("a finished game no longer steps", game.ticks, ticks)
}

const testClear = (t: Suite): void => {
  const input = newInput()
  t.eqI32("the time bonus: (60 + 20L - s) x 10L", timeBonusFor(1, 30), 500)
  t.eqI32("a slow clear earns no time bonus", timeBonusFor(6, 1000), 0)
  t.eqI32("level 6's fastest time bonus", timeBonusFor(6, 0), 10800)
  t.eqI32("the lives bonus: lives x 250L", livesBonusFor(3, 2), 1500)

  const game = playing(1, input)
  game.score = 1000
  game.playSteps = 30 * 120
  emptyWall(game)
  idle(game, input)
  t.eqI32("the last brick clears the level", game.phase, PHASE_CLEAR)
  t.eqI32("the clear scores the time bonus", game.timeBonus, 500)
  t.eqI32("the clear scores the lives bonus", game.livesBonus, 750)
  t.eqI32("the clear takes the balls off", liveBalls(game), 0)
  idleFor(game, input, TALLY_STEPS / 2)
  t.eqI32("the tally counts up", tallied(game), 625)
  t.eqI32("the score counts up with it", game.score, 1625)
  idleFor(game, input, TALLY_STEPS / 2)
  t.eqI32("the tally lands on the total", game.score, 2250)
  idleFor(game, input, CLEAR_HOLD_STEPS - 1)
  t.eqI32("the clear holds after the tally", game.phase, PHASE_CLEAR)
  idle(game, input)
  t.eqI32("the clear moves on to the next level", game.level, 2)
  t.eqI32("the next level opens on its intro", game.phase, PHASE_INTRO)
  t.eqI32("the score carries over", game.score, 2250)
  t.eqI32("the lives carry over", game.lives, 3)
  eqF(t, "the next level serves faster", ballSpeed(game), 112.5)

  const skip = playing(1, input)
  emptyWall(skip)
  idle(skip, input)
  idleFor(skip, input, 10)
  tap(skip, input, KEY_SPACE, 0)
  t.eqI32("confirm skips the tally", skip.level, 2)
  t.eqI32("a skipped tally still pays in full", skip.score, timeBonusFor(1, 0) + livesBonusFor(1, 3))

  const last = playing(1, input)
  loadLevel(last, 6)
  tap(last, input, KEY_CHAR, 122)
  emptyWall(last)
  idle(last, input)
  tap(last, input, KEY_SPACE, 0)
  t.eqI32("clearing level 6 wins", last.phase, PHASE_WON)
  idle(last, input)
  t.ok("the win sets off fireworks", liveParticles(last) > 0)
  idleFor(last, input, DISMISS_STEPS - 3)
  t.eqI32("confirm before the win's delay is ignored", tap(last, input, KEY_SPACE, 0), GAME_PLAYING)
  t.eqI32("confirm after the delay answers won", tap(last, input, KEY_SPACE, 0), GAME_WON)
  t.eqI32("the win sticks", tap(last, input, KEY_ESCAPE, 0), GAME_WON)
}

const testWall = (t: Suite): void => {
  const input = newInput()
  const game = playing(6, input)
  const bottom: f64 = wallBottom(game)
  eqF(t, "level 6's wall ends below its sixth row", bottom, BRICK_TOP + 6.0 * BRICK_H)
  idleFor(game, input, 13 * 120)
  eqF(t, "the wall waits for the serve", game.wallOffset, NOW)
  game.launched = true
  idleFor(game, input, 12 * 120 - 1)
  eqF(t, "the wall holds for 12 s", game.wallTarget, NOW)
  idle(game, input)
  eqF(t, "the wall advances a row after 12 s", game.wallTarget, BRICK_H)
  idleFor(game, input, 200)
  nearF(t, "the wall eases down a row", game.wallOffset, BRICK_H, 1.0e-3)
  nearF(t, "the wall's bottom comes with it", wallBottom(game), bottom + BRICK_H, 1.0e-3)
  nearF(t, "the bricks come with it", brickY(game, 0), BRICK_TOP + BRICK_H, 1.0e-3)
  game.wallTarget = 200.0
  let steps: i32 = 0
  while (game.phase === PHASE_PLAY && steps < 1000) {
    idle(game, input)
    steps++
  }
  t.eqI32("the wall reaching the paddle is game over", game.phase, PHASE_OVER)
  t.eqI32("the wall takes every life", game.lives, 0)

  const still = playing(5, input)
  still.launched = true
  idleFor(still, input, 13 * 120)
  eqF(t, "no other level's wall moves", still.wallOffset, NOW)
}

const testPause = (t: Suite): void => {
  const input = newInput()
  const game = playing(1, input)
  fly(game, 100.0, 100.0, 0.6, -0.8)
  tap(game, input, KEY_CHAR, 112)
  t.eqI32("p pauses", game.phase, PHASE_PAUSE)
  const x: f64 = game.balls[0].x
  const ticks: i32 = game.ticks
  idleFor(game, input, 100)
  eqF(t, "a paused ball stays put", game.balls[0].x, x)
  t.eqI32("a pause stops the clock", game.ticks, ticks)
  t.eqI32("a pause answers playing", tap(game, input, KEY_CHAR, 120), GAME_PLAYING)
  t.eqI32("another key leaves the pause on", game.phase, PHASE_PAUSE)
  tap(game, input, KEY_CHAR, 112)
  t.eqI32("p again resumes", game.phase, PHASE_PLAY)
  tap(game, input, KEY_ESCAPE, 0)
  t.eqI32("escape pauses", game.phase, PHASE_PAUSE)
  tap(game, input, KEY_SPACE, 0)
  t.eqI32("space resumes", game.phase, PHASE_PLAY)
  tap(game, input, KEY_CHAR, 81)
  t.eqI32("Q pauses too", game.phase, PHASE_PAUSE)
  t.eqI32("q from the pause quits", tap(game, input, KEY_CHAR, 113), GAME_QUIT)
  t.eqI32("quit sticks", tap(game, input, KEY_CHAR, 112), GAME_QUIT)
  const esc = playing(1, input)
  tap(esc, input, KEY_ESCAPE, 0)
  t.eqI32("escape from the pause quits", tap(esc, input, KEY_ESCAPE, 0), GAME_QUIT)

  // Paused the step after a break, with sparks, shake and a floating score in
  // flight: every draw shows the same still frame, whatever its alpha.
  const still = playing(1, input)
  fly(still, colCentre(5), 70.0, 0.0, -1.0)
  let steps: i32 = 0
  while (still.bricksLeft === 48 && steps < 40) {
    idle(still, input)
    steps++
  }
  t.ok("the brick breaks before the pause", still.bricksLeft < 48 && liveParticles(still) > 0)
  tap(still, input, KEY_CHAR, 112)
  idle(still, input)
  const a = new Framebuffer(320, 180)
  const z = new Framebuffer(320, 180)
  drawBreakGame(still, a, NOW)
  drawBreakGame(still, z, 1.0)
  t.eqI32("a pause draws the same frame at any alpha", differing(a, z), 0)
  idleFor(still, input, 5)
  drawBreakGame(still, z, 0.5)
  t.eqI32("a pause draws the same frame step after step", differing(a, z), 0)

  const upper = playing(1, input)
  const start: f64 = upper.paddleX
  input.keys.apply([keyEvent(KEY_CHAR, 68, ACTION_PRESS)], NOW)
  idleFor(upper, input, 5)
  input.keys.apply([keyEvent(KEY_CHAR, 68, ACTION_RELEASE)], NOW)
  t.ok("a held D moves the paddle right", upper.paddleX > start)
}

// ---- Drawing --------------------------------------------------------------------------

const differing = (a: Framebuffer, b: Framebuffer): i32 => {
  let n: i32 = 0
  for (let i: i32 = 0; i < toI32(a.pixels.length) && i < toI32(b.pixels.length); i++) {
    if (a.pixels[i] !== b.pixels[i]) {
      n++
    }
  }
  return n
}

const lit = (fb: Framebuffer): i32 => {
  let n: i32 = 0
  for (const p of fb.pixels) {
    if (p !== 0) {
      n++
    }
  }
  return n
}

const testDraw = (t: Suite): void => {
  const input = newInput()
  const game = playing(1, input)
  fly(game, 100.0, 120.0, 0.6, -0.8)
  idle(game, input)
  const b = game.balls[0]
  eqF(t, "alpha 0 draws the ball where it was", drawnBallX(game, 0, 0.0), b.prevX)
  eqF(t, "alpha 1 draws the ball where it is", drawnBallY(game, 0, 1.0), b.y)
  nearF(t, "alpha 0.5 draws the ball midway across", drawnBallX(game, 0, 0.5), (b.prevX + b.x) / 2.0, 1.0e-9)
  nearF(t, "alpha 0.5 draws the ball midway down", drawnBallY(game, 0, 0.5), (b.prevY + b.y) / 2.0, 1.0e-9)
  eqF(t, "a ball out of range draws at 0", drawnBallX(game, 99, 0.5), NOW)

  const fb = new Framebuffer(320, 180)
  drawBreakGame(game, fb, 0.5)
  t.ok("a frame lights the screen", lit(fb) > 320 * 180 / 2)
  t.ok("the paddle is drawn", fb.get(toI32(game.paddleX), toI32(PADDLE_Y) + 2) !== fb.get(toI32(game.paddleX), 140))
  t.ok("a brick is drawn", fb.get(toI32(colCentre(3)), toI32(brickY(game, 1)) + 4) !== fb.get(toI32(colCentre(3)), 100))
  const early = new Framebuffer(320, 180)
  drawBreakGame(game, early, NOW)
  t.ok("alpha moves what is drawn", differing(fb, early) > 0)

  const low = new Framebuffer(320, 180)
  game.effects = 0
  drawBreakGame(game, low, 0.5)
  game.effects = 1
  t.ok("low effects drop the glow", differing(fb, low) > 0)
  const gx: i32 = toI32(drawnBallX(game, 0, 0.5)) + 5
  const gy: i32 = toI32(drawnBallY(game, 0, 0.5))
  // With no trail behind the ball, only the glow can light beside it.
  game.balls[0].trail.clear()
  const glowing = new Framebuffer(320, 180)
  drawBreakGame(game, glowing, 0.5)
  const bare = new Framebuffer(320, 180)
  game.balls[0].live = false
  drawBreakGame(game, bare, 0.5)
  game.balls[0].live = true
  t.ok("high effects light the ball's surroundings", glowing.get(gx, gy) !== bare.get(gx, gy))
  t.eqI32("low effects leave the ball's surroundings bare", low.get(gx, gy), bare.get(gx, gy))
  t.ok("low effects still draw the ball", low.get(toI32(drawnBallX(game, 0, 0.5)), toI32(drawnBallY(game, 0, 0.5))) !== low.get(30, 120))

  // Every scene draws at every size without panicking, down to no pixels at all.
  const sizes: i32[] = [0, 0, 1, 1, 7, 3, 80, 45, 200, 50, 321, 181]
  const scenes = newBreakGame(1, toI64(3))
  let drew: i32 = 0
  for (let scene: i32 = 0; scene < 6; scene++) {
    if (scene === 1) {
      tap(scenes, input, KEY_CHAR, 122)
      tap(scenes, input, KEY_SPACE, 0)
      applyPower(scenes, CAPSULE_MULTI)
      applyPower(scenes, CAPSULE_FIRE)
      spawnCapsule(scenes, 100.0, 100.0, CAPSULE_SLOW)
      idleFor(scenes, input, 30)
    } else if (scene === 2) {
      tap(scenes, input, KEY_CHAR, 112)
    } else if (scene === 3) {
      tap(scenes, input, KEY_CHAR, 112)
      emptyWall(scenes)
      idleFor(scenes, input, 60)
    } else if (scene === 4) {
      loadLevel(scenes, 6)
      tap(scenes, input, KEY_CHAR, 122)
      emptyWall(scenes)
      idle(scenes, input)
      tap(scenes, input, KEY_SPACE, 0)
      idleFor(scenes, input, 40)
    } else if (scene === 5) {
      scenes.phase = PHASE_OVER
      scenes.phaseTime = 0
      idleFor(scenes, input, 10)
    }
    for (let i: i32 = 0; i + 1 < sizes.length; i += 2) {
      const small = new Framebuffer(sizes[i], sizes[i + 1])
      drawBreakGame(scenes, small, 0.5)
      scenes.effects = 0
      drawBreakGame(scenes, small, 2.0)
      scenes.effects = 1
      drew++
    }
  }
  t.eqI32("every scene draws at every size", drew, 36)
  t.ok("the HUD's text has width", breakTextWidth("SCORE", 1) > 0)
  t.eqI32("no text is no width", breakTextWidth("", 1), 0)
}

/**
 * The runs of rows in `fb` holding a pixel of one of `colours` (text is never
 * blended, so its pixels are exactly its colour): answers the number of runs
 * times 100 plus the tallest, so lines that overlap show as one tall run.
 */
const textRows = (fb: Framebuffer, colours: i32[]): i32 => {
  let runs: i32 = 0
  let run: i32 = 0
  let tallest: i32 = 0
  for (let y: i32 = 0; y < fb.height; y++) {
    let hit: boolean = false
    for (let x: i32 = 0; x < fb.width && !hit; x++) {
      hit = colours.indexOf(fb.get(x, y)) >= 0
    }
    if (hit) {
      run++
      if (run === 1) {
        runs++
      }
      tallest = Math.max(tallest, run)
    } else {
      run = 0
    }
  }
  return runs * 100 + tallest
}

/** At 80 x 45 a glyph's 7 pixels outgrow the layout: every screen's lines stand apart. */
const testCompact = (t: Suite): void => {
  const input = newInput()
  const white: i32 = gfxRgb(240, 242, 255)
  const gold: i32 = gfxRgb(255, 214, 90)
  const red: i32 = gfxRgb(255, 90, 90)
  const soft: i32 = dim(white, 0.8)
  const fb = new Framebuffer(80, 45)

  const intro = newBreakGame(1, toI64(7))
  idleFor(intro, input, INTRO_STEPS - 2)
  drawBreakGame(intro, fb, 0.5)
  t.eqI32("the compact intro is two lines apart", textRows(fb, [white, gold]), 200 + GLYPH_H)

  const paused = playing(1, input)
  tap(paused, input, KEY_CHAR, 112)
  drawBreakGame(paused, fb, 0.5)
  t.eqI32("the compact pause is three lines apart", textRows(fb, [white, soft]), 300 + GLYPH_H)

  const clear = playing(1, input)
  emptyWall(clear)
  idleFor(clear, input, 60)
  t.eqI32("the tally is up", clear.phase, PHASE_CLEAR)
  drawBreakGame(clear, fb, 0.5)
  t.eqI32("the compact tally is two lines apart", textRows(fb, [gold]), 200 + GLYPH_H)

  const over = playing(1, input)
  over.phase = PHASE_OVER
  over.phaseTime = 0
  idleFor(over, input, DISMISS_STEPS + 2)
  while (over.ticks % 70 >= 48) {
    idle(over, input)
  }
  drawBreakGame(over, fb, 0.5)
  t.eqI32("the compact last screen is three lines apart", textRows(fb, [red, white, soft]), 300 + GLYPH_H)
}

// ---- Soak -------------------------------------------------------------------------

/**
 * A player who always gets there: the paddle under the lowest falling ball,
 * meeting it a little off centre, by an amount that drifts every few seconds
 * as a person's aim does. One fixed offset can lock the ball into a loop.
 */
const autopilot = (game: BreakGame): void => {
  let best: f64 = -1.0
  let x: f64 = game.paddleX
  for (const b of game.balls) {
    if (b.live && !b.stuck && b.dy > 0.0 && b.y > best) {
      best = b.y
      x = b.x
    }
  }
  const half: f64 = paddleWidth(game) / 2.0
  const aim: f64 = toF64(((game.ticks / 500) % 9) - 4) * half * 0.2
  game.paddleX = Math.min(Math.max(x + aim, FIELD_LEFT + half), FIELD_RIGHT - half)
}

const testSoak = (t: Suite): void => {
  const input = newInput()
  const game = newBreakGame(1, toI64(7))
  let steps: i32 = 0
  let pools: boolean = true
  let clearedOne: i32 = -1
  while (game.phase !== PHASE_WON && game.phase !== PHASE_OVER && steps < 120 * 3600) {
    autopilot(game)
    if (game.phase === PHASE_INTRO || (game.phase === PHASE_PLAY && game.balls[0].stuck)) {
      tap(game, input, KEY_SPACE, 0)
    } else {
      idle(game, input)
    }
    steps++
    if (game.level === 2 && clearedOne < 0) {
      clearedOne = steps
    }
    pools =
      pools &&
      game.balls.length === 8 &&
      game.capsules.length === 8 &&
      game.floaters.length === 16 &&
      game.particles.capacity() === 600
  }
  t.ok("a perfect player clears level 1", clearedOne > 0)
  t.eqI32("a perfect player wins", game.phase, PHASE_WON)
  t.ok("the pools never grow", pools)
}

const testSounds = (t: Suite): void => {
  const input = newInput()
  const serve = playing(1, input)
  t.eqI32("a waiting ball asks for no sound", toI32(serve.sounds.length), 0)
  tap(serve, input, KEY_SPACE, 0)
  t.ok("a serve asks for the launch", asked(serve, SOUND_LAUNCH))
  t.eqI32("and nothing else", toI32(serve.sounds.length), 1)
  idle(serve, input)
  t.eqI32("the next step starts with none", toI32(serve.sounds.length), 0)

  const brick = playing(1, input)
  fly(brick, colCentre(5), 70.0, 0.0, -1.0)
  t.ok("a first break asks for the lowest pitch", heard(brick, input, SOUND_BREAK, 12))
  const pitched = playing(1, input)
  pitched.combo = 9
  fly(pitched, colCentre(5), 70.0, 0.0, -1.0)
  t.ok("a long combo's break stops at the top pitch", heard(pitched, input, SOUND_BREAK + 5, 12))
  const paddle = playing(1, input)
  fly(paddle, paddle.paddleX, 150.0, 0.0, 1.0)
  t.ok("the paddle asks for its knock", heard(paddle, input, SOUND_PADDLE, 60))

  // Twelve breaks in one step: each sound asked for once, and six at most.
  const keg = playing(1, input)
  for (let col: i32 = 3; col <= 6; col++) {
    keg.kinds[3 * LEVEL_COLS + col] = BRICK_EXPLOSIVE
  }
  fly(keg, colCentre(6), 70.0, 0.0, -1.0)
  let exploded: boolean = false
  let most: i32 = 0
  let twice: boolean = false
  for (let i: i32 = 0; i < 12; i++) {
    idle(keg, input)
    exploded = exploded || asked(keg, SOUND_EXPLODE)
    most = Math.max(most, toI32(keg.sounds.length))
    twice = twice || repeated(keg)
  }
  t.ok("an explosive brick asks for the bang", exploded)
  t.eqI32("a busy step asks for six sounds at most", most, 6)
  t.ok("a step asks for each sound once", !twice)

  const two = playing(2, input)
  fly(two, colCentre(0), 120.0, 0.0, -1.0)
  t.ok("a dent asks for the crack", heard(two, input, SOUND_CRACK, 60))
  const steel = playing(3, input)
  fly(steel, colCentre(0), 120.0, 0.0, -1.0)
  t.ok("steel rings", heard(steel, input, SOUND_STEEL, 40))
  const rail = playing(1, input)
  fly(rail, 12.0, 100.0, -0.8, -0.6)
  t.ok("a rail asks for the wall sound", heard(rail, input, SOUND_WALL, 8))

  const caught = playing(1, input)
  spawnCapsule(caught, caught.paddleX, PADDLE_Y - 20.0, CAPSULE_LIFE)
  t.ok("a caught capsule asks for its chime", heard(caught, input, SOUND_CAPSULE, 120))

  const lost = playing(1, input)
  fly(lost, 20.0, 150.0, 0.0, 1.0)
  t.ok("a lost ball asks for the loss", heard(lost, input, SOUND_LOSE, 60))
  lost.lives = 1
  fly(lost, 20.0, 150.0, 0.0, 1.0)
  t.ok("the last life asks for game over instead", heard(lost, input, SOUND_OVER, 60))
  t.ok("and not the loss", !asked(lost, SOUND_LOSE))

  const clear = playing(1, input)
  emptyWall(clear)
  idle(clear, input)
  t.ok("a clear asks for its fanfare", asked(clear, SOUND_CLEAR))

  const wall = playing(6, input)
  wall.launched = true
  t.ok("the wall coming down a row asks for the rumble", heard(wall, input, SOUND_ADVANCE, 12 * 120 + 1))
}

export const main = (): i32 => {
  const t = new Suite("break-game")
  testLevels(t)
  testIntro(t)
  testPhysics(t)
  testPaddle(t)
  testBricks(t)
  testPowers(t)
  testLives(t)
  testClear(t)
  testWall(t)
  testPause(t)
  testSounds(t)
  testDraw(t)
  testCompact(t)
  testSoak(t)
  return t.done()
}
