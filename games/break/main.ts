// The terminal side of the brick breaker: raw keys in, half-block frames out.
// The rules are in `game.ts`; this file reads the keys, runs the fixed-step
// clock and draws, with nothing but `nish/term` and `nish:term` underneath.
//
// Ctrl-C is the one key a terminal in raw mode does not send as a byte: it
// stays SIGINT, and the runtime puts back the terminal's line mode when one
// ends the program, but not the screen this program switched to. So the
// signal is read here instead, from `signalFd`, beside the keys, and quitting
// on it is the same as quitting on `q`: the screen and the cursor come back.

import { isTerminal, readStdin, setRawMode, terminalSize, waitStdin } from "nish:term"
import { pollAdd, pollCreate, pollWait } from "nish:net"
import { monotonicNanos } from "nish:process"
import { write, writeError } from "nish:io"
import {
  ATTR_BOLD,
  COLOR_DEFAULT,
  Canvas,
  FixedStep,
  KEY_CHAR,
  KEY_CONTROL,
  KEY_CTRL_C,
  KEY_ENTER,
  KEY_ESCAPE,
  KEY_LEFT,
  KEY_RIGHT,
  KEY_SPACE,
  KeyDecoder,
  KeyEvent,
  Screen,
  enterAltScreen,
  hideCursor,
  leaveAltScreen,
  resetStyle,
  rgb,
  showCursor,
} from "nish/term"
import {
  BRICK_COLUMNS,
  BRICK_ROWS,
  Game,
  LOST,
  PAUSED,
  READY,
  STEPS_PER_SECOND,
  WON,
  rowColour,
} from "./game"

/** The smallest terminal the wall fits in. */
const MIN_COLUMNS: i32 = 40
const MIN_ROWS: i32 = 14

/** The widest the field grows, in pixels, so a wide window does not make a long, slow game. */
const MAX_FIELD: i32 = 100

/** The longest a frame waits for a key, in milliseconds: about 60 frames a second. */
const FRAME_MS: i32 = 16

/** The poll tokens of the two descriptors the loop waits on. */
const STDIN_TOKEN: i32 = 0
const SIGNAL_TOKEN: i32 = 1

const BACKGROUND: i32 = 0x12121c
const WALL: i32 = 0x3a3a4e
const PADDLE: i32 = 0xe4e4f0
const BALL: i32 = 0xffffff
const TEXT: i32 = 0xc6c6d6
const ACCENT: i32 = 0xff87d7

/** Milliseconds on the monotonic clock. */
const nowMs = (): f64 => toF64(monotonicNanos()) / 1000000.0

/** Whether the terminal can show 24-bit colour, by the convention most of them follow. */
const trueColour = (): boolean => {
  const value = getenv("COLORTERM")
  return value !== null && (value === "truecolor" || value === "24bit")
}

/** Where the field sits on the screen: its left pixel and its width. */
class Layout {
  left: i32
  width: i32
  height: i32

  constructor(columns: i32, rows: i32) {
    this.width = Math.min(columns - 2, MAX_FIELD)
    this.left = ((columns - this.width) / 2) | 0
    this.height = rows * 2 - 2
  }
}

/** Draw `s` centred on cell row `row`, over the pixels behind it. */
const centred = (canvas: Canvas, row: i32, s: string, fg: i32): void => {
  canvas.text(((canvas.width - toI32(s.length)) / 2) | 0, row, s, fg)
}

/** One frame of the field onto `canvas`: walls, bricks, paddle and ball. */
const draw = (canvas: Canvas, layout: Layout, game: Game): void => {
  canvas.clear(BACKGROUND)
  const top: i32 = 2
  // The walls either side of the field and the ceiling above it.
  canvas.fillRect(layout.left - 1, top - 1, 1, layout.height + 1, WALL)
  canvas.fillRect(layout.left + layout.width, top - 1, 1, layout.height + 1, WALL)
  canvas.fillRect(layout.left - 1, top - 1, layout.width + 2, 1, WALL)

  const brickWidth: i32 = game.brickWidth()
  for (let row: i32 = 0; row < BRICK_ROWS; row++) {
    for (let col: i32 = 0; col < BRICK_COLUMNS; col++) {
      if (game.standingAt(col, row)) {
        canvas.fillRect(layout.left + game.brickX(col), top + game.brickY(row), brickWidth, 2, rowColour(row))
      }
    }
  }
  const paddleX: i32 = toI32(Math.round(game.paddleX))
  canvas.fillRect(layout.left + paddleX, top + game.paddleRow(), game.paddleWidth, 1, PADDLE)
  if (game.state !== LOST) {
    const ballX: i32 = toI32(Math.floor(game.ballX))
    const ballY: i32 = toI32(Math.floor(game.ballY))
    canvas.setPixel(layout.left + ballX, top + ballY, BALL)
  }
}

/**
 * The words over the field. Drawing text is a store this program's arena
 * check cannot follow, so the strings are made only when the score or the
 * state changes, never once a frame, and a long game does not grow.
 */
class Label {
  score: string
  message: string
  shownScore: i32
  shownState: i32

  constructor() {
    this.score = "score 0"
    this.message = ""
    this.shownScore = 0
    this.shownState = -1
  }

  /** Bring the strings up to `game`'s score and state. */
  update(game: Game): void {
    if (game.score !== this.shownScore) {
      this.shownScore = game.score
      this.score = `score ${game.score}`
      this.shownState = -1
    }
    if (game.state !== this.shownState) {
      this.shownState = game.state
      if (game.state === READY) {
        this.message = "press space"
      } else if (game.state === PAUSED) {
        this.message = "paused"
      } else if (game.state === WON) {
        this.message = `every brick, ${game.score} points. space to go again`
      } else if (game.state === LOST) {
        this.message = `out of balls at ${game.score}. space to go again`
      } else {
        this.message = ""
      }
    }
  }
}

/** The balls left, one heart each: literals, so a frame makes no string. */
const hearts = (lives: i32): string => {
  if (lives >= 3) {
    return "♥ ♥ ♥"
  } else if (lives === 2) {
    return "♥ ♥"
  } else if (lives === 1) {
    return "♥"
  }
  return ""
}

/** The score, the balls left, the keys and what the state asks for, over the field. */
const label = (canvas: Canvas, layout: Layout, game: Game, words: Label): void => {
  words.update(game)
  const after: i32 = canvas.text(layout.left, 0, words.score, TEXT)
  canvas.text(after + 3, 0, hearts(game.lives), ACCENT)
  const keys = "← → move · space launch · p pause · q quit"
  canvas.text(layout.left + layout.width - toI32(keys.length), 0, keys, WALL + 0x303030)

  // The ready prompt blinks; the others stay.
  const blinkOff: boolean = game.state === READY && game.ticks % 120 >= 80
  if (words.message.length > 0 && !blinkOff) {
    const middle: i32 = ((canvas.height / 2) * 2 / 3) | 0
    centred(canvas, middle, words.message, game.state === WON ? ACCENT : TEXT)
  }
}

/** Whether `key` asks to leave: `q`, Esc, Ctrl-C or Ctrl-D. */
const quits = (key: KeyEvent): boolean =>
  (key.kind === KEY_CHAR && (key.code === 113 || key.code === 81)) ||
  key.kind === KEY_ESCAPE ||
  key.kind === KEY_CTRL_C ||
  (key.kind === KEY_CONTROL && key.code === 4)

/** Hand one key to the game; answer whether it asked to leave. */
const press = (game: Game, key: KeyEvent): boolean => {
  if (quits(key)) {
    return true
  }
  const c: i32 = key.kind === KEY_CHAR ? key.code : -1
  if (key.kind === KEY_LEFT || c === 97 || c === 104) {
    game.nudge(-1)
  } else if (key.kind === KEY_RIGHT || c === 100 || c === 108) {
    game.nudge(1)
  } else if (key.kind === KEY_SPACE || key.kind === KEY_ENTER) {
    game.launch()
  } else if (c === 112) {
    game.pause()
  }
  return false
}

export const main = (): i32 => {
  if (!isTerminal(0) || !isTerminal(1)) {
    writeError("this one needs a real terminal: run it with nothing piped in or out\n")
    return 1
  }
  const size = terminalSize()
  if (size[0] < MIN_COLUMNS || size[1] < MIN_ROWS) {
    writeError(`the wall needs a terminal of ${MIN_COLUMNS} × ${MIN_ROWS} at least; this one is ${size[0]} × ${size[1]}\n`)
    return 1
  }

  setRawMode(true)
  // After raw mode, whose own SIGINT handler only puts the line mode back:
  // this one takes the signal over, so the loop hears it as a key.
  const signals: i32 = signalFd()
  const loop: i32 = pollCreate()
  if (loop >= 0) {
    pollAdd(loop, 0, 1, STDIN_TOKEN)
    if (signals >= 0) {
      pollAdd(loop, signals, 1, SIGNAL_TOKEN)
    }
  }
  write(`${enterAltScreen()}${hideCursor()}`)

  let columns: i32 = size[0]
  let rows: i32 = size[1]
  const screen = new Screen(columns, rows, !trueColour())
  screen.sync = true
  let canvas = new Canvas(screen)
  let layout = new Layout(columns, rows)
  const game = new Game(layout.width, layout.height)
  const clock = new FixedStep(STEPS_PER_SECOND, 8)
  const keys = new KeyDecoder(30.0)
  const bytes = new Array<u8>(64)
  const ready = new Array<i32>(8)
  const words = new Label()
  let running = true

  while (running) {
    let input = false
    if (loop >= 0) {
      const n: i32 = pollWait(loop, ready, FRAME_MS)
      if (n < 0) {
        // A stop and `fg` end the wait early, and the shell drew on the screen meanwhile.
        screen.invalidate()
      }
      for (let i: i32 = 0; i < n && 2 * i < ready.length; i++) {
        if (ready[2 * i] === SIGNAL_TOKEN) {
          running = false
        } else {
          input = true
        }
      }
    } else {
      input = waitStdin(FRAME_MS)
    }
    const now: f64 = nowMs()
    if (input) {
      const count: i32 = readStdin(bytes, 0, bytes.length)
      if (count === 0 || (count < 0 && count !== -11)) {
        running = false
      }
      if (count > 0) {
        const events = keys.feed(bytes, count, now)
        for (let i: i32 = 0; i < events.length; i++) {
          if (press(game, events[i])) {
            running = false
          }
        }
      }
    }
    if (keys.waiting()) {
      const late = keys.poll(now)
      for (let i: i32 = 0; i < late.length; i++) {
        if (press(game, late[i])) {
          running = false
        }
      }
    }

    // Each frame's size, strings and output are freed with the frame, so a
    // long game holds no more memory than its first frame did.
    let width: i32 = columns
    let height: i32 = rows
    {
      using a = arena()
      const current = terminalSize()
      width = current[0]
      height = current[1]
    }
    if (width >= MIN_COLUMNS && height >= MIN_ROWS && (width !== columns || height !== rows)) {
      columns = width
      rows = height
      screen.resize(columns, rows)
      canvas = new Canvas(screen)
      layout = new Layout(columns, rows)
      game.resize(layout.width, layout.height)
    }

    const steps: i32 = clock.advance(now)
    for (let i: i32 = 0; i < steps; i++) {
      game.step()
    }
    draw(canvas, layout, game)
    label(canvas, layout, game, words)
    {
      using a = arena()
      write(screen.flush())
    }
  }

  write(`${resetStyle()}${showCursor()}${leaveAltScreen()}`)
  setRawMode(false)
  if (game.state === WON) {
    console.log(`every brick, ${game.score} points.`)
  } else if (game.score > 0) {
    console.log(`${game.score} points.`)
  }
  return 0
}
