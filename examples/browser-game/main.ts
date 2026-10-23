// Breakout, written in Nish and played in a browser. The page (index.html)
// owns everything a browser owns: the animation loop, the keyboard and pointer,
// and the canvas. This module owns everything else: the game state, the rules,
// and every pixel of the frame, which it paints into a buffer the page puts on
// the canvas with putImageData.
//
// A freestanding wasm module has no globals that outlive a call, so the whole
// game lives in a Float64Array the page allocates once (stateLength() slots)
// and hands to every call; the generated loader copies it in and back.
//
// Build and play (from the repository root):
//   nish examples/browser-game/main.ts --target wasm32-unknown-unknown \
//     -o build/browser-game/game.ll --emit-dts build/browser-game/game.d.ts
//   scripts/build.sh build/browser-game/game.ll runtime/runtime-wasm.c \
//     -o build/browser-game/game.wasm --profile wasm
//   cp examples/browser-game/index.html build/browser-game/
//   python3 -m http.server -d build/browser-game 8000   # open localhost:8000
// Or without a browser: node examples/browser-game/headless.mjs build/browser-game

const SCREEN_W: i32 = 320
const SCREEN_H: i32 = 240
const HUD_H: i32 = 24

// Input bits the page sends to step().
const INPUT_LEFT: i32 = 1
const INPUT_RIGHT: i32 = 2
const INPUT_ACTION: i32 = 4

// Modes.
const MODE_SERVE: i32 = 0
const MODE_PLAY: i32 = 1
const MODE_CLEARED: i32 = 2
const MODE_OVER: i32 = 3

// Slots of the state array. Bricks follow the scalars, one slot each, 1 while
// standing and 0 once broken.
const S_PADDLE_X: i32 = 0
const S_BALL_X: i32 = 1
const S_BALL_Y: i32 = 2
const S_BALL_VX: i32 = 3
const S_BALL_VY: i32 = 4
const S_SCORE: i32 = 5
const S_LIVES: i32 = 6
const S_MODE: i32 = 7
const S_MODE_TIME: i32 = 8
const S_LEVEL: i32 = 9
const S_LAST_INPUT: i32 = 10
const S_BRICK0: i32 = 11

const COLS: i32 = 10
const ROWS: i32 = 6
const BRICK_COUNT: i32 = 60
const BRICK_LEFT: i32 = 10
const BRICK_TOP: i32 = 36
const CELL_W: i32 = 30
const CELL_H: i32 = 12
const BRICK_W: i32 = 28
const BRICK_H: i32 = 10

const PADDLE_Y: f64 = 220
const PADDLE_W: f64 = 44
const PADDLE_H: f64 = 6
const PADDLE_SPEED: f64 = 260
const BALL_R: f64 = 3
const START_SPEED: f64 = 170
const SPEED_CAP: f64 = 340
const START_LIVES: f64 = 3
const SUBSTEP: f64 = 0.004
const BRICK_SPEEDUP: f64 = 4

class Game {
  paddleX: f64
  ballX: f64
  ballY: f64
  ballVX: f64
  ballVY: f64
  score: f64
  lives: f64
  mode: i32
  modeTime: f64
  level: i32
  lastInput: i32
  bricks: Float64Array

  constructor() {
    this.paddleX = toF64(SCREEN_W) / 2
    this.ballX = 0
    this.ballY = 0
    this.ballVX = 0
    this.ballVY = 0
    this.score = 0
    this.lives = START_LIVES
    this.mode = MODE_SERVE
    this.modeTime = 0
    this.level = 1
    this.lastInput = 0
    this.bricks = new Float64Array(BRICK_COUNT)
  }

  // Pressed this frame, not held over from the last one.
  pressed(input: i32, bit: i32): boolean {
    return (input & bit) !== 0 && (this.lastInput & bit) === 0
  }

  setMode(next: i32): void {
    this.mode = next
    this.modeTime = 0
  }

  fillBricks(): void {
    for (let i: i32 = 0; i < toI32(this.bricks.length); i++) {
      this.bricks[i] = 1
    }
  }

  bricksLeft(): i32 {
    let n: i32 = 0
    for (let i: i32 = 0; i < toI32(this.bricks.length); i++) {
      if (this.bricks[i] > 0) {
        n++
      }
    }
    return n
  }

  launchSpeed(): f64 {
    return START_SPEED + 20 * toF64(this.level - 1)
  }

  // The ball leaves the paddle at `along` (-1 at the left end, 1 at the right)
  // times 80% of its speed sideways; the rest goes up, so the speed is kept
  // without a sine or cosine.
  aim(speed: f64, along: f64): void {
    const a: f64 = Math.max(Math.min(along, 1), -1)
    this.ballVX = speed * a * 0.8
    this.ballVY = -Math.sqrt(speed * speed - this.ballVX * this.ballVX)
  }

  speed(): f64 {
    return Math.sqrt(this.ballVX * this.ballVX + this.ballVY * this.ballVY)
  }

  speedUp(by: f64): void {
    const s: f64 = this.speed()
    if (s <= 0) {
      return
    }
    const k: f64 = Math.min(s + by, SPEED_CAP) / s
    this.ballVX = this.ballVX * k
    this.ballVY = this.ballVY * k
  }

  step(dt: f64, input: i32, pointerX: f64): void {
    const t: f64 = Math.max(Math.min(dt, 0.05), 0)
    this.modeTime = this.modeTime + t
    const action: boolean = this.pressed(input, INPUT_ACTION)

    if (this.mode === MODE_CLEARED || this.mode === MODE_OVER) {
      if (action && this.modeTime > 0.4) {
        if (this.mode === MODE_OVER) {
          this.score = 0
          this.lives = START_LIVES
          this.level = 1
        } else {
          this.level = this.level + 1
        }
        this.fillBricks()
        this.setMode(MODE_SERVE)
      }
      this.lastInput = input
      return
    }

    const n: i32 = toI32(Math.ceil(t / SUBSTEP))
    const h: f64 = n > 0 ? t / toF64(n) : 0
    for (let i: i32 = 0; i < n; i++) {
      this.movePaddle(h, input, pointerX)
      if (this.mode === MODE_SERVE) {
        this.ballX = this.paddleX
        this.ballY = PADDLE_Y - BALL_R - 1
      } else if (this.mode === MODE_PLAY) {
        this.moveBall(h)
      }
    }

    if (this.mode === MODE_SERVE && action) {
      // Serve toward the side the paddle is not on, so the first shot crosses.
      const side: f64 = this.paddleX < toF64(SCREEN_W) / 2 ? 0.35 : -0.35
      this.aim(this.launchSpeed(), side)
      this.setMode(MODE_PLAY)
    }
    this.lastInput = input
  }

  movePaddle(h: f64, input: i32, pointerX: f64): void {
    if (pointerX >= 0) {
      const gap: f64 = pointerX - this.paddleX
      const reach: f64 = PADDLE_SPEED * 3 * h
      this.paddleX = this.paddleX + Math.max(-reach, Math.min(reach, gap))
    } else {
      if ((input & INPUT_LEFT) !== 0) {
        this.paddleX = this.paddleX - PADDLE_SPEED * h
      }
      if ((input & INPUT_RIGHT) !== 0) {
        this.paddleX = this.paddleX + PADDLE_SPEED * h
      }
    }
    const half: f64 = PADDLE_W / 2
    this.paddleX = Math.max(half, Math.min(toF64(SCREEN_W) - half, this.paddleX))
  }

  moveBall(h: f64): void {
    this.ballX = this.ballX + this.ballVX * h
    this.ballY = this.ballY + this.ballVY * h

    const right: f64 = toF64(SCREEN_W) - BALL_R
    const top: f64 = toF64(HUD_H) + BALL_R
    if (this.ballX < BALL_R) {
      this.ballX = BALL_R
      this.ballVX = Math.abs(this.ballVX)
    } else if (this.ballX > right) {
      this.ballX = right
      this.ballVX = -Math.abs(this.ballVX)
    }
    if (this.ballY < top) {
      this.ballY = top
      this.ballVY = Math.abs(this.ballVY)
    }

    if (this.ballY > toF64(SCREEN_H) + BALL_R) {
      this.lives = this.lives - 1
      this.setMode(this.lives > 0 ? MODE_SERVE : MODE_OVER)
      return
    }

    const half: f64 = PADDLE_W / 2 + BALL_R
    if (
      this.ballVY > 0 &&
      this.ballY + BALL_R >= PADDLE_Y &&
      this.ballY - BALL_R <= PADDLE_Y + PADDLE_H &&
      Math.abs(this.ballX - this.paddleX) <= half
    ) {
      this.ballY = PADDLE_Y - BALL_R
      this.aim(this.speed(), (this.ballX - this.paddleX) / half)
      return
    }

    this.hitBrick()
  }

  // Breaks at most one brick per substep: the first standing brick the ball
  // overlaps, bouncing off the side it went in least deep.
  hitBrick(): void {
    const c0: i32 = Math.max(toI32(Math.floor((this.ballX - BALL_R - toF64(BRICK_LEFT)) / toF64(CELL_W))), 0)
    const c1: i32 = Math.min(
      COLS - 1,
      toI32(Math.floor((this.ballX + BALL_R - toF64(BRICK_LEFT)) / toF64(CELL_W)))
    )
    const r0: i32 = Math.max(toI32(Math.floor((this.ballY - BALL_R - toF64(BRICK_TOP)) / toF64(CELL_H))), 0)
    const r1: i32 = Math.min(
      ROWS - 1,
      toI32(Math.floor((this.ballY + BALL_R - toF64(BRICK_TOP)) / toF64(CELL_H)))
    )
    for (let r: i32 = r0; r <= r1; r++) {
      for (let c: i32 = c0; c <= c1; c++) {
        const k: i32 = r * COLS + c
        if (!(k >= 0 && k < toI32(this.bricks.length))) {
          continue
        }
        if (this.bricks[k] <= 0) {
          continue
        }
        const bx: f64 = toF64(BRICK_LEFT + c * CELL_W + 1)
        const by: f64 = toF64(BRICK_TOP + r * CELL_H + 1)
        const bw: f64 = toF64(BRICK_W)
        const bh: f64 = toF64(BRICK_H)
        const inX: f64 = Math.min(this.ballX + BALL_R - bx, bx + bw - (this.ballX - BALL_R))
        const inY: f64 = Math.min(this.ballY + BALL_R - by, by + bh - (this.ballY - BALL_R))
        if (inX <= 0 || inY <= 0) {
          continue
        }
        this.bricks[k] = 0
        if (inX < inY) {
          this.ballVX = this.ballX < bx + bw / 2 ? -Math.abs(this.ballVX) : Math.abs(this.ballVX)
        } else {
          this.ballVY = this.ballY < by + bh / 2 ? -Math.abs(this.ballVY) : Math.abs(this.ballVY)
        }
        this.score = this.score + toF64(ROWS - r) * 10
        this.speedUp(BRICK_SPEEDUP)
        if (this.bricksLeft() === 0) {
          this.score = this.score + 100 * toF64(this.level)
          this.setMode(MODE_CLEARED)
        }
        return
      }
    }
  }
}

const slot = (state: Float64Array, i: i32): f64 => {
  if (i >= 0 && i < toI32(state.length)) {
    return state[i]
  }
  return 0
}

const setSlot = (state: Float64Array, i: i32, v: f64): void => {
  if (i >= 0 && i < toI32(state.length)) {
    state[i] = v
  }
}

const load = (state: Float64Array): Game => {
  const g: Game = new Game()
  g.paddleX = slot(state, S_PADDLE_X)
  g.ballX = slot(state, S_BALL_X)
  g.ballY = slot(state, S_BALL_Y)
  g.ballVX = slot(state, S_BALL_VX)
  g.ballVY = slot(state, S_BALL_VY)
  g.score = slot(state, S_SCORE)
  g.lives = slot(state, S_LIVES)
  g.mode = toI32(slot(state, S_MODE))
  g.modeTime = slot(state, S_MODE_TIME)
  g.level = toI32(slot(state, S_LEVEL))
  g.lastInput = toI32(slot(state, S_LAST_INPUT))
  for (let i: i32 = 0; i < toI32(g.bricks.length); i++) {
    g.bricks[i] = slot(state, S_BRICK0 + i)
  }
  return g
}

const store = (g: Game, state: Float64Array): void => {
  setSlot(state, S_PADDLE_X, g.paddleX)
  setSlot(state, S_BALL_X, g.ballX)
  setSlot(state, S_BALL_Y, g.ballY)
  setSlot(state, S_BALL_VX, g.ballVX)
  setSlot(state, S_BALL_VY, g.ballVY)
  setSlot(state, S_SCORE, g.score)
  setSlot(state, S_LIVES, g.lives)
  setSlot(state, S_MODE, toF64(g.mode))
  setSlot(state, S_MODE_TIME, g.modeTime)
  setSlot(state, S_LEVEL, toF64(g.level))
  setSlot(state, S_LAST_INPUT, toF64(g.lastInput))
  for (let i: i32 = 0; i < toI32(g.bricks.length); i++) {
    setSlot(state, S_BRICK0 + i, g.bricks[i])
  }
}

// ---- Exports the page calls ----------------------------------------------

export const stateLength = (): i32 => S_BRICK0 + BRICK_COUNT

export const screenWidth = (): i32 => SCREEN_W

export const screenHeight = (): i32 => SCREEN_H

export const newGame = (state: Float64Array): void => {
  const g: Game = new Game()
  g.fillBricks()
  g.ballX = g.paddleX
  g.ballY = PADDLE_Y - BALL_R - 1
  store(g, state)
}

// Advances the game by `dt` seconds. `input` is a mask of INPUT_* bits;
// `pointerX` is the pointer's x in screen pixels, or negative for none.
export const step = (state: Float64Array, dt: f64, input: i32, pointerX: f64): void => {
  const g: Game = load(state)
  g.step(dt, input, pointerX)
  store(g, state)
}

export const mode = (state: Float64Array): i32 => toI32(slot(state, S_MODE))

export const score = (state: Float64Array): i32 => toI32(slot(state, S_SCORE))

export const lives = (state: Float64Array): i32 => toI32(slot(state, S_LIVES))

export const level = (state: Float64Array): i32 => toI32(slot(state, S_LEVEL))

export const bricksLeft = (state: Float64Array): i32 => load(state).bricksLeft()

// ---- Rendering --------------------------------------------------------------
// Pixels are canvas RGBA bytes read as little-endian i32s: 0xAABBGGRR.

const rgb = (r: i32, g: i32, b: i32): i32 => {
  const v: u32 = (toU32(255) << 24) | (toU32(b & 255) << 16) | (toU32(g & 255) << 8) | toU32(r & 255)
  return toI32(v)
}

const fillRect = (px: Int32Array, x: i32, y: i32, w: i32, h: i32, color: i32): void => {
  const x0: i32 = Math.max(x, 0)
  const y0: i32 = Math.max(y, 0)
  const x1: i32 = Math.min(SCREEN_W, x + w)
  const y1: i32 = Math.min(SCREEN_H, y + h)
  for (let yy: i32 = y0; yy < y1; yy++) {
    const row: i32 = yy * SCREEN_W
    for (let xx: i32 = x0; xx < x1; xx++) {
      const i: i32 = row + xx
      if (i >= 0 && i < toI32(px.length)) {
        px[i] = color
      }
    }
  }
}

// One glyph per digit, 3 wide and 5 tall, read row by row from the top bit.
const GLYPH_TOP_BIT: i32 = 14

const glyph = (d: i32): i32 => {
  switch (d) {
    case 0:
      return 31599
    case 1:
      return 11415
    case 2:
      return 29671
    case 3:
      return 29647
    case 4:
      return 23497
    case 5:
      return 31183
    case 6:
      return 31215
    case 7:
      return 29257
    case 8:
      return 31727
    default:
      return 31695
  }
}

const drawDigit = (px: Int32Array, d: i32, x: i32, y: i32, scale: i32, color: i32): void => {
  const bits: i32 = glyph(d)
  for (let row: i32 = 0; row < 5; row++) {
    for (let col: i32 = 0; col < 3; col++) {
      const bit: i32 = GLYPH_TOP_BIT - (row * 3 + col)
      if (((bits >> bit) & 1) !== 0) {
        fillRect(px, x + col * scale, y + row * scale, scale, scale, color)
      }
    }
  }
}

// Draws `n` (non-negative) right-aligned so its last digit ends at `right`.
const drawNumber = (px: Int32Array, n: i32, right: i32, y: i32, scale: i32, color: i32): void => {
  let v: i32 = Math.max(n, 0)
  let x: i32 = right - 3 * scale
  while (true) {
    drawDigit(px, v % 10, x, y, scale, color)
    v = v / 10
    x = x - 4 * scale
    if (v === 0) {
      break
    }
  }
}

const drawBall = (px: Int32Array, cx: i32, cy: i32, r: i32, color: i32): void => {
  for (let dy: i32 = -r; dy <= r; dy++) {
    for (let dx: i32 = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy <= r * r + 1) {
        fillRect(px, cx + dx, cy + dy, 1, 1, color)
      }
    }
  }
}

const brickColor = (row: i32): i32 => {
  switch (row) {
    case 0:
      return rgb(239, 71, 111)
    case 1:
      return rgb(247, 140, 64)
    case 2:
      return rgb(255, 209, 102)
    case 3:
      return rgb(6, 214, 160)
    case 4:
      return rgb(17, 138, 178)
    default:
      return rgb(131, 96, 195)
  }
}

// Mixes a packed color toward white (t > 0) or black (t < 0) by |t|/8.
const shade = (color: i32, t: i32): i32 => {
  const r: i32 = color & 255
  const g: i32 = (color >> 8) & 255
  const b: i32 = (color >> 16) & 255
  if (t > 0) {
    return rgb(r + ((255 - r) * t) / 8, g + ((255 - g) * t) / 8, b + ((255 - b) * t) / 8)
  }
  return rgb((r * (8 + t)) / 8, (g * (8 + t)) / 8, (b * (8 + t)) / 8)
}

// Paints the frame into `pixels`, SCREEN_W * SCREEN_H of them.
export const render = (state: Float64Array, pixels: Int32Array): void => {
  const g: Game = load(state)

  for (let y: i32 = 0; y < SCREEN_H; y++) {
    fillRect(pixels, 0, y, SCREEN_W, 1, rgb((20 * y) / SCREEN_H + 14, 16, (28 * y) / SCREEN_H + 36))
  }
  fillRect(pixels, 0, 0, SCREEN_W, HUD_H, rgb(10, 10, 24))
  fillRect(pixels, 0, HUD_H - 1, SCREEN_W, 1, rgb(60, 60, 110))

  drawNumber(pixels, toI32(g.score), 70, 7, 2, rgb(240, 240, 255))
  drawNumber(pixels, g.level, SCREEN_W / 2 + 3, 7, 2, rgb(255, 209, 102))
  const livesLeft: i32 = toI32(g.lives)
  for (let i: i32 = 0; i < livesLeft; i++) {
    drawBall(pixels, SCREEN_W - 10 - i * 12, 12, 3, rgb(255, 255, 255))
  }

  for (let k: i32 = 0; k < toI32(g.bricks.length); k++) {
    if (g.bricks[k] <= 0) {
      continue
    }
    const r: i32 = k / COLS
    const c: i32 = k % COLS
    const x: i32 = BRICK_LEFT + c * CELL_W + 1
    const y: i32 = BRICK_TOP + r * CELL_H + 1
    const color: i32 = brickColor(r)
    fillRect(pixels, x, y, BRICK_W, BRICK_H, color)
    fillRect(pixels, x, y, BRICK_W, 1, shade(color, 4))
    fillRect(pixels, x, y + BRICK_H - 1, BRICK_W, 1, shade(color, -3))
  }

  const pw: i32 = toI32(PADDLE_W)
  const px: i32 = toI32(Math.round(g.paddleX)) - pw / 2
  const py: i32 = toI32(PADDLE_Y)
  fillRect(pixels, px, py, pw, toI32(PADDLE_H), rgb(200, 210, 255))
  fillRect(pixels, px, py, pw, 1, rgb(255, 255, 255))
  fillRect(pixels, px, py + toI32(PADDLE_H) - 1, pw, 1, rgb(120, 130, 200))

  if (g.mode !== MODE_OVER) {
    drawBall(
      pixels,
      toI32(Math.round(g.ballX)),
      toI32(Math.round(g.ballY)),
      toI32(BALL_R),
      rgb(255, 255, 255)
    )
  }
}
