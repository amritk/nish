// The break director with no terminal: scripted keys step the intro, the menu
// and a level, and each checkpoint prints a hash of the framebuffer. Nothing
// here reads a clock, a file or a terminal: the suite builds it with
// `--deterministic` (the `args` file), which refuses all three at compile
// time, and the same program compiles with `--target wasm32-unknown-unknown`.
import { Suite } from "../../../std/testing"
import { ACTION_PRESS, ACTION_RELEASE, EVENT_KEY, KEY_ENTER, KEY_LEFT, KEY_SPACE, KeyState, TermEvent } from "nish/term"
import { StepInput } from "../../../std/input"
import { Framebuffer } from "nish/term-pixels"
import { TermStats } from "nish/term-rate"
import { BreakSettings } from "../../../src/break-menu"
import {
  BreakDirector,
  SCENE_GAME,
  SCENE_INTRO,
  SCENE_MENU,
  drawBreakDirector,
  sizeBreakFramebuffer,
  stepBreakDirector
} from "../../../src/break-director"

/** The clock every key event is applied at: held keys never time out. */
const NOW: f64 = 0.0
const WHOLE: f64 = 1.0

const keyEvent = (key: i32, code: i32, action: i32): TermEvent => {
  const e = new TermEvent(EVENT_KEY)
  e.key = key
  e.code = code
  e.action = action
  return e
}

/** One step with `events`, applied to the held keys as a host would. */
const step = (d: BreakDirector, input: StepInput, events: TermEvent[]): boolean => {
  input.events = input.keys.apply(events, NOW)
  return stepBreakDirector(d, input)
}

/** `n` steps with no input; false if any asked to stop. */
const idle = (d: BreakDirector, input: StepInput, n: i32): boolean => {
  let going = true
  for (let i: i32 = 0; i < n; i++) {
    going = step(d, input, []) && going
  }
  return going
}

/** One FNV-1a round: `x` mixed into `h`, which wraps as a `u32` does. */
const mix = (h: u32, x: i32): u32 => (h ^ toU32(x)) * 16777619

/** FNV-1a over the framebuffer's size and pixels. */
const hashPixels = (fb: Framebuffer): u32 => {
  let h: u32 = 2166136261
  h = mix(h, fb.width)
  h = mix(h, fb.height)
  for (const p of fb.pixels) {
    h = mix(h, p)
  }
  return h
}

/** Size, draw and hash the director's frame, and print it under `name`. */
const frame = (d: BreakDirector, fb: Framebuffer, stats: TermStats, name: string): u32 => {
  sizeBreakFramebuffer(d, fb, 640, 360)
  drawBreakDirector(d, fb, WHOLE, stats)
  const h: u32 = hashPixels(fb)
  console.log(`${name}: scene ${d.scene}, ${fb.width}x${fb.height}, hash ${h}`)
  return h
}

export const main = (): number => {
  const t = new Suite("break_core")
  const settings = new BreakSettings()
  // 270 lines, the smallest resolution choice.
  settings.resolution = 1
  const d = new BreakDirector(7, settings, "nish: a compiler\n\nusage: nish <file>\n")
  const input = new StepInput(new KeyState())
  input.keys.releasesAreSynthetic = false
  const fb = new Framebuffer(1, 1)
  const stats = new TermStats()

  t.eqI32("starts in the intro", d.scene, SCENE_INTRO)
  t.ok("the intro steps", idle(d, input, 40))
  const intro: u32 = frame(d, fb, stats, "intro")
  t.ok("a frame is 16:9 at the chosen lines", fb.width === 480 && fb.height === 270)

  t.ok("a key skips the intro", step(d, input, [keyEvent(KEY_SPACE, 0, ACTION_PRESS)]))
  step(d, input, [keyEvent(KEY_SPACE, 0, ACTION_RELEASE)])
  t.eqI32("to the menu", d.scene, SCENE_MENU)
  t.ok("the menu steps", idle(d, input, 30))
  const menu: u32 = frame(d, fb, stats, "menu")
  t.ok("the menu draws other pixels than the intro", menu !== intro)

  step(d, input, [keyEvent(KEY_ENTER, 0, ACTION_PRESS)])
  step(d, input, [keyEvent(KEY_ENTER, 0, ACTION_RELEASE)])
  // The menu plays its outro before the level starts.
  let outro: i32 = 0
  while (d.scene === SCENE_MENU && outro < 600) {
    step(d, input, [])
    outro++
  }
  console.log(`outro: ${outro} steps`)
  t.eqI32("Enter on the menu starts a level", d.scene, SCENE_GAME)
  t.ok("the game steps", idle(d, input, 60))
  const level: u32 = frame(d, fb, stats, "level")

  step(d, input, [keyEvent(KEY_LEFT, 0, ACTION_PRESS)])
  idle(d, input, 20)
  step(d, input, [keyEvent(KEY_LEFT, 0, ACTION_RELEASE)])
  const moved: u32 = frame(d, fb, stats, "paddle left")
  t.ok("holding left changes the frame", moved !== level)
  t.eqI32("still playing", d.scene, SCENE_GAME)

  return t.done()
}
