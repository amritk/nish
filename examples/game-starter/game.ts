// A small browser game over nish/host/game: keep the ball in play with the
// paddle. The page that runs it is index.html, one startGame call from
// nish/page/game; build.mjs writes both into a directory any static server
// can serve. Copy the directory to start a game of your own.
import {
  GAME_FRAME,
  gameHeight,
  gamePlaySound,
  gameReadInput,
  gameSetSize,
  gameWidth,
  gameWriteSamples,
} from "nish/host/game"
import { StepInput } from "nish/input"
import {
  RASTER_SOLID,
  rasterDisc,
  rasterGradient,
  rasterRect,
  rasterText,
  rasterTextWidth,
} from "nish/raster"
import { SYNTH_NOISE, SYNTH_SQUARE, SYNTH_TRIANGLE, synthSilence, synthTone } from "nish/synth"
import {
  ACTION_MOVE,
  ACTION_PRESS,
  EVENT_KEY,
  EVENT_MOUSE,
  KEY_ENTER,
  KEY_LEFT,
  KEY_RIGHT,
  KEY_SPACE,
  KeyState,
  TermEvent,
} from "nish/term"

const WIDTH: i32 = 320
const HEIGHT: i32 = 180
const PADDLE_W: f64 = 48.0
const PADDLE_Y: f64 = 164.0
const BALL_R: f64 = 4.0
const STEP_S: f64 = 1.0 / 60.0
/** The ball's top speed on each axis, in px/s: each hit speeds it up to here. */
const MAX_DY: f64 = 300.0

/** The sounds, by the id the page fetches them with: a paddle hit, a wall, a miss. */
const SOUND_HIT: i32 = 0
const SOUND_WALL: i32 = 1
const SOUND_MISS: i32 = 2
const RATE: i32 = 22050

// The state lives in module storage: BALL holds the ball's x, y, dx, dy
// (slots 0 to 3), the paddle's x (4), and where the ball and paddle were a step
// ago (5 to 7: x, y, paddle), for drawing between steps.
const BALL = new Float64Array(8)
// The score, the best score, whether the ball waits to be served, and the seed.
const SCORE = new Int32Array(4)
// Whether left and right are held. A module constant cannot hold a KeyState,
// so each step rebuilds one from these and stores what it ends with.
const HELD = new Int32Array(2)

// Each exported function lends the storage to a helper below, which indexes
// it as `ball`, `score` and `held`: the checker proves a literal index in
// range under a test of a parameter's length, so every helper opens with one.
// The storage is always 8, 4 and 2 long, so those tests never return early.

/** This step's input: the held keys restored, then the page's events read. */
const readInput = (held: Int32Array, nowMs: f64): StepInput => {
  const keys = new KeyState()
  keys.releasesAreSynthetic = false
  const pressed: TermEvent[] = []
  for (let i: i32 = 0; i < toI32(held.length); i++) {
    if (held[i] === 1) {
      const e = new TermEvent(EVENT_KEY)
      e.key = i === 0 ? KEY_LEFT : KEY_RIGHT
      e.action = ACTION_PRESS
      pressed.push(e)
    }
  }
  keys.apply(pressed, nowMs)
  const input = new StepInput(keys)
  gameReadInput(input, nowMs)
  if (held.length >= 2) {
    held[0] = input.isDown(KEY_LEFT, 0) ? 1 : 0
    held[1] = input.isDown(KEY_RIGHT, 0) ? 1 : 0
  }
  return input
}

/** Put the ball on the paddle, waiting for a serve; it jumps there, with no trail drawn. */
const park = (ball: Float64Array, score: Int32Array): void => {
  if (ball.length < 8 || score.length < 4) {
    return
  }
  ball[0] = ball[4]
  ball[1] = PADDLE_Y - BALL_R - 1.0
  ball[5] = ball[0]
  ball[6] = ball[1]
  ball[2] = 0.0
  ball[3] = 0.0
  score[2] = 1
}

/** A new game in `ball` and `score`, served the way `seed` leans. */
const start = (ball: Float64Array, score: Int32Array, seed: i32): void => {
  if (ball.length < 8 || score.length < 4) {
    return
  }
  score[0] = 0
  score[3] = seed === 0 ? 1 : seed
  ball[4] = toF64(WIDTH) / 2.0
  park(ball, score)
}

/** Start a game; the seed picks which way each serve leans. */
export const init = (seed: i32): void => {
  gameSetSize(WIDTH, HEIGHT)
  start(BALL, SCORE, seed)
}

/** One sound's samples, handed to the page through gameWriteSamples; 0 past the last id. */
export const sound = (id: i32): i32 => {
  const out = synthSilence(0.25, RATE)
  if (id === SOUND_HIT) {
    synthTone(out, RATE, 0.0, 0.08, 660.0, 880.0, SYNTH_SQUARE, 0.25, 30.0)
  } else if (id === SOUND_WALL) {
    synthTone(out, RATE, 0.0, 0.05, 440.0, 440.0, SYNTH_TRIANGLE, 0.3, 40.0)
  } else if (id === SOUND_MISS) {
    synthTone(out, RATE, 0.0, 0.25, 300.0, 80.0, SYNTH_NOISE, 0.3, 8.0)
  } else {
    return 0
  }
  return gameWriteSamples(out, RATE)
}

/** Advance one fixed step of 1/60 s; `nowMs` is the page's step clock. */
export const step = (nowMs: f64): void => {
  advance(BALL, SCORE, readInput(HELD, nowMs))
}

/** One step of `ball` and `score` under `input`. */
const advance = (ball: Float64Array, score: Int32Array, input: StepInput): void => {
  if (ball.length < 8 || score.length < 4) {
    return
  }
  ball[5] = ball[0]
  ball[6] = ball[1]
  ball[7] = ball[4]
  let serve = false
  for (const e of input.events) {
    if (e.type === EVENT_MOUSE && (e.action === ACTION_MOVE || e.action === ACTION_PRESS)) {
      ball[4] = toF64(e.px)
    }
    // Space, Enter (a tap on a touch screen) or a click serves.
    const key = e.type === EVENT_KEY && (e.key === KEY_SPACE || e.key === KEY_ENTER)
    if (e.action === ACTION_PRESS && (key || e.type === EVENT_MOUSE)) {
      serve = true
    }
  }
  if (input.isDown(KEY_LEFT, 0)) {
    ball[4] = ball[4] - 240.0 * STEP_S
  }
  if (input.isDown(KEY_RIGHT, 0)) {
    ball[4] = ball[4] + 240.0 * STEP_S
  }
  ball[4] = Math.min(Math.max(ball[4], PADDLE_W / 2.0), toF64(WIDTH) - PADDLE_W / 2.0)
  if (score[2] === 1) {
    ball[0] = ball[4]
    if (serve) {
      score[2] = 0
      let r: i32 = score[3] ^ (score[3] << 13)
      r = r ^ (r >> 17)
      score[3] = r ^ (r << 5)
      ball[2] = (score[3] & 256) !== 0 ? 90.0 : -90.0
      ball[3] = -150.0
    }
    return
  }
  ball[0] = ball[0] + ball[2] * STEP_S
  ball[1] = ball[1] + ball[3] * STEP_S
  if (ball[0] < BALL_R || ball[0] > toF64(WIDTH) - BALL_R) {
    ball[2] = -ball[2]
    ball[0] = Math.min(Math.max(ball[0], BALL_R), toF64(WIDTH) - BALL_R)
    gamePlaySound(SOUND_WALL)
  }
  if (ball[1] < BALL_R) {
    ball[3] = -ball[3]
    ball[1] = BALL_R
    gamePlaySound(SOUND_WALL)
  }
  // A hit is the ball's bottom crossing the paddle's top this step, however fast it falls.
  const off: f64 = ball[0] - ball[4]
  const crossed = ball[6] + BALL_R <= PADDLE_Y && ball[1] + BALL_R >= PADDLE_Y
  if (ball[3] > 0.0 && crossed && Math.abs(off) <= PADDLE_W / 2.0 + BALL_R) {
    ball[1] = PADDLE_Y - BALL_R
    ball[3] = -Math.min(ball[3] * 1.04, MAX_DY)
    ball[2] = Math.min(Math.max(ball[2] + off * 4.0, -MAX_DY), MAX_DY)
    // The score stays far below 2^31, which would take a hit every frame for
    // over a year; the guard says so where the prover reads it, and holds
    // the score there rather than wrapping it negative.
    const hits: i32 = score[0]
    if (hits < 2147483647) {
      score[0] = hits + 1
    }
    score[1] = Math.max(score[1], score[0])
    gamePlaySound(SOUND_HIT)
  }
  if (ball[1] > toF64(HEIGHT) + BALL_R) {
    score[0] = 0
    gamePlaySound(SOUND_MISS)
    park(ball, score)
  }
}

/** Draw the frame `alpha` of the way from the last step to this one. */
export const draw = (alpha: f64, frameMs: f64): void => {
  paint(BALL, SCORE, alpha)
}

// Screen sums are taken in `f64` and truncated back with `toI32`, which
// saturates where an `i32` sum would overflow; on screen every operand is a
// small exact integer, so each result is the one the `i32` sum gives.

/** Draw `ball` and `score` `alpha` of the way from the last step to this one. */
const paint = (ball: Float64Array, score: Int32Array, alpha: f64): void => {
  if (ball.length < 8 || score.length < 4) {
    return
  }
  const w: i32 = gameWidth()
  const h: i32 = gameHeight()
  rasterGradient(GAME_FRAME, w, h, 0x101830, 0x302040)
  const paddle: f64 = ball[7] + (ball[4] - ball[7]) * alpha
  const left: i32 = toI32(paddle - PADDLE_W / 2.0)
  rasterRect(
    GAME_FRAME,
    w,
    h,
    left,
    toI32(PADDLE_Y),
    toI32(toF64(left) + PADDLE_W),
    toI32(PADDLE_Y + 4.0),
    0xf0f0f0,
    RASTER_SOLID
  )
  const x: f64 = ball[5] + (ball[0] - ball[5]) * alpha
  const y: f64 = ball[6] + (ball[1] - ball[6]) * alpha
  rasterDisc(GAME_FRAME, w, h, x, y, BALL_R, 0xffd040, 1.0)
  const text = `${score[0]}  best ${score[1]}`
  const right: i32 = toI32(toF64(w) - toF64(rasterTextWidth(text, 1)) - 6.0)
  rasterText(GAME_FRAME, w, h, right, 6, 1, text, 0xa0a0c0)
  if (score[2] === 1) {
    const hint = "space, click or tap to serve"
    const centre: i32 = toI32((toF64(w) - toF64(rasterTextWidth(hint, 1))) / 2.0)
    rasterText(GAME_FRAME, w, h, centre, 90, 1, hint, 0xf0f0f0)
  }
}
