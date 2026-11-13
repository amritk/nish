// A small browser game over nish/host/game: keep the ball in play with the
// paddle. The page that runs it is index.html, one startGame call from
// nish/page/game; build.mjs writes both into a directory any static server
// can serve. Copy the directory to start a game of your own.
import { GAME_FRAME, gameHeight, gamePlaySound, gameReadInput, gameSetSize, gameWidth, gameWriteSamples } from "nish/host/game"
import { StepInput } from "nish/input"
import { RASTER_SOLID, rasterDisc, rasterGradient, rasterRect, rasterText, rasterTextWidth } from "nish/raster"
import { SYNTH_NOISE, SYNTH_SQUARE, SYNTH_TRIANGLE, synthSilence, synthTone } from "nish/synth"
import { ACTION_MOVE, ACTION_PRESS, EVENT_KEY, EVENT_MOUSE, KEY_ENTER, KEY_LEFT, KEY_RIGHT, KEY_SPACE, KeyState, TermEvent } from "nish/term"

const WIDTH: i32 = 320
const HEIGHT: i32 = 180
const PADDLE_W: f64 = 48.0
const PADDLE_Y: f64 = 164.0
const BALL_R: f64 = 4.0
const STEP_S: f64 = 1.0 / 60.0

/** The sounds, by the id the page fetches them with: a paddle hit, a wall, a miss. */
const SOUND_HIT: i32 = 0
const SOUND_WALL: i32 = 1
const SOUND_MISS: i32 = 2
const RATE: i32 = 22050

// The state lives in module storage: the ball's x, y, dx, dy, the paddle's x,
// and where the ball and paddle were a step ago, for drawing between steps.
const BALL = new Float64Array(8)
const X: i32 = 0
const Y: i32 = 1
const DX: i32 = 2
const DY: i32 = 3
const PADDLE: i32 = 4
const LAST_X: i32 = 5
const LAST_Y: i32 = 6
const LAST_PADDLE: i32 = 7
// The score, the best score, whether the ball waits to be served, and the seed.
const SCORE = new Int32Array(4)
// Whether left and right are held. A module constant cannot hold a KeyState,
// so each step rebuilds one from these and stores what it ends with.
const HELD = new Int32Array(2)

/** This step's input: the held keys restored, then the page's events read. */
const readInput = (nowMs: f64): StepInput => {
  const keys = new KeyState()
  keys.releasesAreSynthetic = false
  const held: TermEvent[] = []
  for (let i: i32 = 0; i < 2; i++) {
    if (HELD[i] === 1) {
      const e = new TermEvent(EVENT_KEY)
      e.key = i === 0 ? KEY_LEFT : KEY_RIGHT
      e.action = ACTION_PRESS
      held.push(e)
    }
  }
  keys.apply(held, nowMs)
  const input = new StepInput(keys)
  gameReadInput(input, nowMs)
  HELD[0] = input.isDown(KEY_LEFT, 0) ? 1 : 0
  HELD[1] = input.isDown(KEY_RIGHT, 0) ? 1 : 0
  return input
}

/** Put the ball on the paddle, waiting for a serve. */
const park = (): void => {
  BALL[X] = BALL[PADDLE]
  BALL[Y] = PADDLE_Y - BALL_R - 1.0
  BALL[DX] = 0.0
  BALL[DY] = 0.0
  SCORE[2] = 1
}

/** Start a game; the seed picks which way each serve leans. */
export const init = (seed: i32): void => {
  gameSetSize(WIDTH, HEIGHT)
  SCORE[0] = 0
  SCORE[3] = seed === 0 ? 1 : seed
  BALL[PADDLE] = toF64(WIDTH) / 2.0
  park()
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
  const input = readInput(nowMs)
  BALL[LAST_X] = BALL[X]
  BALL[LAST_Y] = BALL[Y]
  BALL[LAST_PADDLE] = BALL[PADDLE]
  let serve = false
  for (const e of input.events) {
    if (e.type === EVENT_MOUSE && (e.action === ACTION_MOVE || e.action === ACTION_PRESS)) {
      BALL[PADDLE] = toF64(e.px)
    }
    if (e.type === EVENT_KEY && e.action === ACTION_PRESS && (e.key === KEY_SPACE || e.key === KEY_ENTER)) {
      serve = true
    }
  }
  if (input.isDown(KEY_LEFT, 0)) {
    BALL[PADDLE] = BALL[PADDLE] - 240.0 * STEP_S
  }
  if (input.isDown(KEY_RIGHT, 0)) {
    BALL[PADDLE] = BALL[PADDLE] + 240.0 * STEP_S
  }
  BALL[PADDLE] = Math.min(Math.max(BALL[PADDLE], PADDLE_W / 2.0), toF64(WIDTH) - PADDLE_W / 2.0)
  if (SCORE[2] === 1) {
    BALL[X] = BALL[PADDLE]
    if (serve) {
      SCORE[2] = 0
      let r: i32 = SCORE[3] ^ (SCORE[3] << 13)
      r = r ^ (r >> 17)
      SCORE[3] = r ^ (r << 5)
      BALL[DX] = (SCORE[3] & 256) !== 0 ? 90.0 : -90.0
      BALL[DY] = -150.0
    }
    return
  }
  BALL[X] = BALL[X] + BALL[DX] * STEP_S
  BALL[Y] = BALL[Y] + BALL[DY] * STEP_S
  if (BALL[X] < BALL_R || BALL[X] > toF64(WIDTH) - BALL_R) {
    BALL[DX] = -BALL[DX]
    BALL[X] = Math.min(Math.max(BALL[X], BALL_R), toF64(WIDTH) - BALL_R)
    gamePlaySound(SOUND_WALL)
  }
  if (BALL[Y] < BALL_R) {
    BALL[DY] = -BALL[DY]
    BALL[Y] = BALL_R
    gamePlaySound(SOUND_WALL)
  }
  const off: f64 = BALL[X] - BALL[PADDLE]
  if (BALL[DY] > 0.0 && BALL[Y] + BALL_R >= PADDLE_Y && BALL[Y] < PADDLE_Y + 4.0 && Math.abs(off) <= PADDLE_W / 2.0 + BALL_R) {
    BALL[DY] = -BALL[DY] * 1.04
    BALL[DX] = BALL[DX] + off * 4.0
    SCORE[0] = SCORE[0] + 1
    SCORE[1] = Math.max(SCORE[1], SCORE[0])
    gamePlaySound(SOUND_HIT)
  }
  if (BALL[Y] > toF64(HEIGHT) + BALL_R) {
    SCORE[0] = 0
    gamePlaySound(SOUND_MISS)
    park()
  }
}

/** Draw the frame `alpha` of the way from the last step to this one. */
export const draw = (alpha: f64, frameMs: f64): void => {
  const w: i32 = gameWidth()
  const h: i32 = gameHeight()
  rasterGradient(GAME_FRAME, w, h, 0x101830, 0x302040)
  const paddle: f64 = BALL[LAST_PADDLE] + (BALL[PADDLE] - BALL[LAST_PADDLE]) * alpha
  const left: i32 = toI32(paddle - PADDLE_W / 2.0)
  rasterRect(GAME_FRAME, w, h, left, toI32(PADDLE_Y), left + toI32(PADDLE_W), toI32(PADDLE_Y) + 4, 0xf0f0f0, RASTER_SOLID)
  const x: f64 = BALL[LAST_X] + (BALL[X] - BALL[LAST_X]) * alpha
  const y: f64 = BALL[LAST_Y] + (BALL[Y] - BALL[LAST_Y]) * alpha
  rasterDisc(GAME_FRAME, w, h, x, y, BALL_R, 0xffd040, 1.0)
  const score = `${SCORE[0]}  best ${SCORE[1]}`
  rasterText(GAME_FRAME, w, h, w - rasterTextWidth(score, 1) - 6, 6, 1, score, 0xa0a0c0)
  if (SCORE[2] === 1) {
    const hint = "space or tap to serve"
    rasterText(GAME_FRAME, w, h, (w - rasterTextWidth(hint, 1)) / 2, 90, 1, hint, 0xf0f0f0)
  }
}
