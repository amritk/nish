// The brick breaker itself, with no input or output: a field of pixels, a
// paddle, a ball and a wall of bricks, moved one fixed step at a time. The
// terminal loop in `main.ts` turns keys into calls here and draws what this
// holds, so the rules can be run and checked without a terminal.
//
// Positions are in canvas pixels, two to a terminal cell, one above the other:
// `nish/term`'s `Canvas`. Row 0 of the field is the first pixel row under the
// score line. Speeds are in pixels a second, and every step is 1/120 s.

/** The game waits for a launch: the ball sits on the paddle. */
export const READY: i32 = 0

/** The ball is moving. */
export const PLAYING: i32 = 1

/** Paused by the player; a launch or a pause key goes on. */
export const PAUSED: i32 = 2

/** Every brick is gone. */
export const WON: i32 = 3

/** The last ball fell. */
export const LOST: i32 = 4

/** Steps a second: the rate `main.ts` runs its `FixedStep` at. */
export const STEPS_PER_SECOND: i32 = 120

/** Bricks across the wall. */
export const BRICK_COLUMNS: i32 = 10

/** Rows of bricks. */
export const BRICK_ROWS: i32 = 6

/** The rows a brick takes, in pixels, and the gap under it. */
const BRICK_HEIGHT: i32 = 2
const BRICK_GAP: i32 = 1

/** The empty pixel rows above the wall, so the first bounce has room. */
const WALL_TOP: i32 = 4

/** Balls at the start. */
const LIVES: i32 = 3

/** The ball's speed at the start and its ceiling, in pixels a second. */
const BALL_SPEED: f64 = 42.0
const BALL_SPEED_MAX: f64 = 110.0

/** What each brick adds to the speed: a little, so a long rally gets quicker. */
const BALL_SPEED_STEP: f64 = 0.9

/** How fast the paddle follows where the player sent it, in pixels a second. */
const PADDLE_SPEED: f64 = 160.0

/** The length of one step, in seconds. */
const STEP_SECONDS: f64 = 1.0 / 120.0

/** The colour of brick row `row`, top to bottom, as `0xRRGGBB`. */
export const rowColour = (row: i32): i32 => {
  const colours: i32[] = [0xff5f87, 0xff8f40, 0xffd75f, 0x87e36f, 0x5fd7ff, 0xaf87ff]
  return colours[row % colours.length]
}

export class Game {
  /** Each brick, row by row: 1 while it stands, 0 once it is broken. */
  bricks: i32[]
  /** The paddle's left edge, in pixels, and where the keys sent it. */
  paddleX: f64
  paddleTarget: f64
  /** The ball's centre and velocity. */
  ballX: f64
  ballY: f64
  vx: f64
  vy: f64
  /** The ball's speed, which `vx` and `vy` keep as they turn. */
  speed: f64
  /** The field's size in pixels. */
  width: i32
  height: i32
  /** One of `READY`, `PLAYING`, `PAUSED`, `WON` and `LOST`. */
  state: i32
  /** The state a pause left, so the pause key can give it back. */
  resumeTo: i32
  /** Points: more for a higher row. */
  score: i32
  /** Balls left, the one in play included. */
  lives: i32
  /** Bricks still standing. */
  standing: i32
  /** The paddle's width, in pixels. */
  paddleWidth: i32
  /** Steps taken, for anything that blinks. */
  ticks: i32

  /** A new game on a field of `width × height` pixels. */
  constructor(width: i32, height: i32) {
    this.width = width
    this.height = height
    this.state = READY
    this.resumeTo = READY
    this.score = 0
    this.lives = LIVES
    this.bricks = new Array<i32>(BRICK_COLUMNS * BRICK_ROWS)
    this.bricks.fill(1)
    this.standing = BRICK_COLUMNS * BRICK_ROWS
    this.paddleWidth = 0
    this.paddleX = 0.0
    this.paddleTarget = 0.0
    this.ballX = 0.0
    this.ballY = 0.0
    this.vx = 0.0
    this.vy = 0.0
    this.speed = BALL_SPEED
    this.ticks = 0
    this.resize(width, height)
    this.paddleX = toF64(width - this.paddleWidth) / 2.0
    this.paddleTarget = this.paddleX
    this.serve()
  }

  /**
   * Fit the game to a field of `width × height` pixels. The wall is laid out
   * from the width on every call, so a resized terminal keeps every brick;
   * the paddle and the ball are kept inside.
   */
  resize(width: i32, height: i32): void {
    this.width = width
    this.height = height
    this.paddleWidth = Math.max((width / 7) | 0, 6)
    this.paddleTarget = this.clampPaddle(this.paddleTarget)
    this.paddleX = this.clampPaddle(this.paddleX)
    this.ballX = Math.min(Math.max(this.ballX, 0.0), toF64(width - 1))
    this.ballY = Math.min(this.ballY, toF64(this.paddleRow() - 1))
    if (this.state === READY) {
      this.serve()
    }
  }

  /** The pixel row the paddle sits on. */
  paddleRow(): i32 {
    return this.height - 2
  }

  /** The brick columns' left edge and the width of one brick with its gap. */
  wallLeft(): i32 {
    return ((this.width - this.brickPitch() * BRICK_COLUMNS + BRICK_GAP) / 2) | 0
  }

  brickPitch(): i32 {
    return Math.max(((this.width - 2) / BRICK_COLUMNS) | 0, 3)
  }

  /** The left pixel of brick column `col` and the top pixel of brick row `row`. */
  brickX(col: i32): i32 {
    return this.wallLeft() + col * this.brickPitch()
  }

  brickY(row: i32): i32 {
    return WALL_TOP + row * (BRICK_HEIGHT + BRICK_GAP)
  }

  /** A brick's width, without its gap. */
  brickWidth(): i32 {
    return this.brickPitch() - BRICK_GAP
  }

  /** Whether brick `col`, `row` still stands. */
  standingAt(col: i32, row: i32): boolean {
    return this.bricks[row * BRICK_COLUMNS + col] === 1
  }

  /** `x` kept so the whole paddle stays on the field. */
  clampPaddle(x: f64): f64 {
    return Math.min(Math.max(x, 0.0), toF64(this.width - this.paddleWidth))
  }

  /** Put the ball back on the paddle, waiting for a launch. */
  serve(): void {
    this.ballX = this.paddleX + toF64(this.paddleWidth) / 2.0
    this.ballY = toF64(this.paddleRow() - 1)
    this.vx = 0.0
    this.vy = 0.0
  }

  /**
   * One press of left (`direction` -1) or right (1). A terminal sends no key
   * release, only a press and then its repeats, so a press moves where the
   * paddle is going rather than how fast: held down, the repeats keep it
   * going, and let go, it stops where it was sent.
   */
  nudge(direction: i32): void {
    if (this.state === PAUSED || this.state === WON || this.state === LOST) {
      return
    }
    const reach: f64 = toF64(Math.max((this.width / 18) | 0, 2))
    this.paddleTarget = this.clampPaddle(this.paddleTarget + toF64(direction) * reach)
  }

  /** The launch key: serve the ball, go on after a pause, or start again once the game is over. */
  launch(): void {
    if (this.state === READY) {
      // Off the paddle at a slant, toward the side of the field with more room.
      const side: f64 = this.ballX < toF64(this.width) / 2.0 ? 1.0 : -1.0
      this.aim(side * 0.45)
      this.state = PLAYING
    } else if (this.state === PAUSED) {
      this.state = this.resumeTo
    } else if (this.state === WON || this.state === LOST) {
      this.restart()
    }
  }

  /** The pause key: stop everything, or go on. */
  pause(): void {
    if (this.state === PAUSED) {
      this.state = this.resumeTo
    } else if (this.state === READY || this.state === PLAYING) {
      this.resumeTo = this.state
      this.state = PAUSED
    }
  }

  /** A fresh wall, score and set of balls on the same field. */
  restart(): void {
    this.bricks.fill(1)
    this.standing = BRICK_COLUMNS * BRICK_ROWS
    this.score = 0
    this.lives = LIVES
    this.speed = BALL_SPEED
    this.state = READY
    this.serve()
  }

  /**
   * Send the ball upward at `slant`, from -1 (all the way left) to 1, at the
   * current speed. It never goes flatter than about 15 degrees from the
   * horizontal, so a rally cannot stall into a ball crossing the field for ever.
   */
  aim(slant: f64): void {
    const s: f64 = Math.min(Math.max(slant, -0.85), 0.85)
    this.vx = this.speed * s
    this.vy = -this.speed * Math.sqrt(toF64(1) - s * s)
  }

  /** Run one fixed step. */
  step(): void {
    this.ticks = this.ticks + 1
    if (this.state === PAUSED || this.state === WON || this.state === LOST) {
      return
    }
    this.movePaddle()
    if (this.state === READY) {
      this.serve()
      return
    }
    // Half a pixel at most per sub-step, so the ball cannot pass through a
    // brick or the paddle in one move at the highest speed.
    const travel: f64 = this.speed * STEP_SECONDS
    const parts: i32 = toI32(Math.ceil(travel / 0.5))
    for (let i: i32 = 0; i < parts && this.state === PLAYING; i++) {
      this.moveBall(1.0 / toF64(parts))
    }
  }

  /** Move the paddle toward its target, and the ball with it while it waits. */
  movePaddle(): void {
    const most: f64 = PADDLE_SPEED * STEP_SECONDS
    const gap: f64 = this.paddleTarget - this.paddleX
    this.paddleX = this.paddleX + Math.min(Math.max(gap, -most), most)
  }

  /** Move the ball `fraction` of a step and settle every bounce on the way. */
  moveBall(fraction: f64): void {
    const oldX: f64 = this.ballX
    const oldY: f64 = this.ballY
    let x: f64 = oldX + this.vx * STEP_SECONDS * fraction
    let y: f64 = oldY + this.vy * STEP_SECONDS * fraction

    // The side walls and the ceiling.
    const right: f64 = toF64(this.width) - 0.5
    if (x < 0.0) {
      x = -x
      this.vx = Math.abs(this.vx)
    } else if (x > right) {
      x = right - (x - right)
      this.vx = -Math.abs(this.vx)
    }
    if (y < 0.0) {
      y = -y
      this.vy = Math.abs(this.vy)
    }

    // A brick: the side it was struck on decides which way the ball turns.
    // The ball crossed into a brick's rows, its columns or both since the last
    // move, and only the axis it crossed is turned.
    const hit: i32 = this.brickAt(x, y)
    if (hit >= 0) {
      this.bricks[hit] = 0
      this.standing = this.standing - 1
      const row: i32 = (hit / BRICK_COLUMNS) | 0
      this.score = this.score + (BRICK_ROWS - row) * 10
      const acrossX: boolean = this.brickAt(x, oldY) === hit
      const acrossY: boolean = this.brickAt(oldX, y) === hit
      if (acrossY || !acrossX) {
        this.vy = -this.vy
        y = oldY
      }
      if (acrossX && !acrossY) {
        this.vx = -this.vx
        x = oldX
      }
      this.speed = Math.min(this.speed + BALL_SPEED_STEP, BALL_SPEED_MAX)
      this.rescale()
      if (this.standing === 0) {
        this.state = WON
      }
    }

    // The paddle: where the ball lands on it sets the angle it leaves at, so
    // the player aims, which is the whole of the skill.
    const top: f64 = toF64(this.paddleRow())
    if (this.vy > 0.0 && oldY < top && y >= top) {
      const left: f64 = this.paddleX - 0.5
      const span: f64 = toF64(this.paddleWidth) + 1.0
      if (x >= left && x <= left + span) {
        const offset: f64 = (x - left) / span * 2.0 - 1.0
        this.aim(offset)
        y = top - (y - top) - 0.01
      }
    }

    // The floor: a ball lost.
    if (y >= toF64(this.height)) {
      this.lives = this.lives - 1
      if (this.lives === 0) {
        this.state = LOST
      } else {
        this.state = READY
        this.serve()
      }
      return
    }
    this.ballX = x
    this.ballY = y
  }

  /** Keep the ball's direction and give it the current speed. */
  rescale(): void {
    const now: f64 = Math.sqrt(this.vx * this.vx + this.vy * this.vy)
    if (now > 0.0) {
      this.vx = this.vx / now * this.speed
      this.vy = this.vy / now * this.speed
    }
  }

  /** The index of the standing brick under the pixel at `x`, `y`, or -1. */
  brickAt(x: f64, y: f64): i32 {
    const px: i32 = toI32(Math.floor(x))
    const py: i32 = toI32(Math.floor(y))
    const pitchY: i32 = BRICK_HEIGHT + BRICK_GAP
    const fromTop: i32 = py - WALL_TOP
    if (fromTop < 0 || fromTop % pitchY >= BRICK_HEIGHT) {
      return -1
    }
    const row: i32 = (fromTop / pitchY) | 0
    const fromLeft: i32 = px - this.wallLeft()
    const pitchX: i32 = this.brickPitch()
    if (row >= BRICK_ROWS || fromLeft < 0 || fromLeft % pitchX >= pitchX - BRICK_GAP) {
      return -1
    }
    const col: i32 = (fromLeft / pitchX) | 0
    if (col >= BRICK_COLUMNS) {
      return -1
    }
    const index: i32 = row * BRICK_COLUMNS + col
    return this.bricks[index] === 1 ? index : -1
  }
}
