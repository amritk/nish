// The break director as a browser host would run it: built for wasm32 with
// `--deterministic` (the `args` file), so no terminal, file or clock import
// can reach it, and constructed with no terminal, so the menu has no frame
// rate or graphics rows and F4 and F6 step nothing. Scripted keys play the
// intro, the menu and a level, and each checkpoint prints a hash of the
// framebuffer. The suite links the wasm32 IR natively to run it.
import { Suite } from "../../../std/testing"
import {
  ACTION_PRESS,
  ACTION_RELEASE,
  EVENT_KEY,
  KEY_ENTER,
  KEY_F4,
  KEY_RIGHT,
  KEY_SPACE,
  KeyState,
  TermEvent,
} from "nish/term"
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

const HELP: string = "nish: a compiler\n"

const keyEvent = (key: i32, action: i32): TermEvent => {
  const e = new TermEvent(EVENT_KEY)
  e.key = key
  e.action = action
  return e
}

/** One step with `events`, applied to the held keys as a host would. */
const step = (d: BreakDirector, input: StepInput, events: TermEvent[]): boolean => {
  input.events = input.keys.apply(events, toF64(0))
  return stepBreakDirector(d, input)
}

/** A step pressing `key` and one releasing it; answers the press's step. */
const tap = (d: BreakDirector, input: StepInput, key: i32): boolean => {
  const going = step(d, input, [keyEvent(key, ACTION_PRESS)])
  step(d, input, [keyEvent(key, ACTION_RELEASE)])
  return going
}

/** `n` steps with no input; false if any asked to stop. */
const idle = (d: BreakDirector, input: StepInput, n: i32): boolean => {
  let going = true
  for (let i: i32 = 0; i < n; i++) {
    going = step(d, input, []) && going
  }
  return going
}

/** FNV-1a over the framebuffer's size and pixels. */
const hashPixels = (fb: Framebuffer): u32 => {
  let h: u32 = 2166136261
  h = (h ^ toU32(fb.width)) * 16777619
  h = (h ^ toU32(fb.height)) * 16777619
  for (const p of fb.pixels) {
    h = (h ^ toU32(p)) * 16777619
  }
  return h
}

/** Size, draw and hash the director's frame, and print it under `name`. */
const frame = (d: BreakDirector, fb: Framebuffer, stats: TermStats, name: string): u32 => {
  sizeBreakFramebuffer(d, fb, 640, 360)
  drawBreakDirector(d, fb, toF64(1), stats)
  const h: u32 = hashPixels(fb)
  console.log(`${name}: scene ${d.scene}, ${fb.width}x${fb.height}, hash ${h}`)
  return h
}

export const main = (): number => {
  const t = new Suite("break_core_wasm")
  const settings = new BreakSettings()
  settings.resolution = 1
  const d = new BreakDirector(11, settings, HELP, false)
  const input = new StepInput(new KeyState())
  input.keys.releasesAreSynthetic = false
  const fb = new Framebuffer(1, 1)
  const stats = new TermStats()

  t.eqI32("starts in the intro", d.scene, SCENE_INTRO)
  t.ok("the intro steps", idle(d, input, 40))
  const intro: u32 = frame(d, fb, stats, "intro")
  t.ok("F4 keeps the step going", tap(d, input, KEY_F4))
  t.eqBool("and asks for no reopening", d.reopen, false)
  t.eqStr("and says nothing", d.toast, "")

  tap(d, input, KEY_SPACE)
  t.eqI32("a key skips to the menu", d.scene, SCENE_MENU)
  t.eqBool("the menu knows there is no terminal", d.menu.terminal, false)
  idle(d, input, 30)
  t.ok("the menu draws other pixels than the intro", frame(d, fb, stats, "menu") !== intro)

  tap(d, input, KEY_ENTER)
  let outro: i32 = 0
  while (d.scene === SCENE_MENU && outro < 600) {
    step(d, input, [])
    outro++
  }
  t.eqI32("Enter on the menu starts a level", d.scene, SCENE_GAME)
  t.ok("the game steps", idle(d, input, 60))
  const level: u32 = frame(d, fb, stats, "level")
  step(d, input, [keyEvent(KEY_RIGHT, ACTION_PRESS)])
  idle(d, input, 20)
  step(d, input, [keyEvent(KEY_RIGHT, ACTION_RELEASE)])
  t.ok("holding right changes the frame", frame(d, fb, stats, "paddle right") !== level)
  return t.done()
}
