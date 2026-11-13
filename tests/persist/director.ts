// WP55 root storage: the real break director kept across export calls. The
// page drives it as it drives any nish/host/game module: it pushes key
// records onto GAME_INPUT, calls `step` and `draw`, and reads GAME_FRAME.
import { GAME_FRAME, gameReadInput, gameSetSize } from "nish/host/game"
import { StepInput } from "nish/input"
import { KeyState } from "nish/term"
import { Framebuffer } from "nish/term-pixels"
import { TermStats } from "nish/term-rate"
import {
  BreakDirector,
  drawBreakDirector,
  sizeBreakFramebuffer,
  stepBreakDirector,
} from "../../src/break-director"
import { BreakSettings } from "../../src/break-menu"

const WIDTH: i32 = 320
const HEIGHT: i32 = 180

/** Everything a page session keeps: the director, its input and its frame. */
class Session {
  director: BreakDirector
  input: StepInput
  fb: Framebuffer
  stats: TermStats
  steps: i32 = 0
  running: boolean = true

  constructor(seed: i64) {
    this.director = new BreakDirector(seed, new BreakSettings(), "nish break: arrows move, space serves", false)
    this.input = new StepInput(new KeyState())
    this.fb = new Framebuffer(WIDTH, HEIGHT)
    this.stats = new TermStats()
  }
}

const session = new Array<Session | null>(1)

/** A new session from `seed`. */
export const init = (seed: i32): void => {
  gameSetSize(WIDTH, HEIGHT)
  session[0] = new Session(toI64(seed))
}

/**
 * One step of the director on the page's input.
 *
 * @returns 1 while the director runs, 0 once it asked to stop, -1 before `init`.
 */
export const step = (): i32 => {
  const s = session[0]
  if (s === null) {
    return -1
  }
  s.steps = s.steps + 1
  gameReadInput(s.input, toF64(s.steps) * 8.0)
  if (s.running && !stepBreakDirector(s.director, s.input)) {
    s.running = false
  }
  return s.running ? 1 : 0
}

/** One frame into GAME_FRAME; its checksum, so the page can see it change. */
export const draw = (): i32 => {
  const s = session[0]
  if (s === null) {
    return -1
  }
  sizeBreakFramebuffer(s.director, s.fb, WIDTH, HEIGHT)
  drawBreakDirector(s.director, s.fb, 1.0, s.stats)
  gameSetSize(s.fb.width, s.fb.height)
  let sum = 0
  const n = s.fb.width * s.fb.height
  for (let i = 0; i < n; i++) {
    const p = s.fb.pixels[i]
    GAME_FRAME[i] = p
    sum = (sum * 31 + p) | 0
  }
  return sum
}

/** Which scene the director is in: 0 menu, 1 game, 2 intro. */
export const scene = (): i32 => {
  const s = session[0]
  return s === null ? -1 : s.director.scene
}
