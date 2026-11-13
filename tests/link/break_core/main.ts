// The break director with no terminal: scripted keys step the intro, the menu
// and a level, and each checkpoint prints a hash of the framebuffer. Nothing
// here reads a clock, a file or a terminal: the suite builds it with
// `--deterministic` (the `args` file), which refuses all three at compile
// time. `break_core_wasm` is the wasm32 build of the director.
import { Suite } from "../../../std/testing"
import {
  ACTION_PRESS,
  ACTION_RELEASE,
  EVENT_KEY,
  KEY_CHAR,
  KEY_DOWN,
  KEY_ENTER,
  KEY_F3,
  KEY_F4,
  KEY_F5,
  KEY_F6,
  KEY_F7,
  KEY_F8,
  KEY_F9,
  KEY_LEFT,
  KEY_SPACE,
  KeyState,
  TermEvent,
} from "nish/term"
import { StepInput } from "../../../std/input"
import { Framebuffer, GRAPHICS_HALFBLOCK, GRAPHICS_KITTY } from "nish/term-pixels"
import { TermStats } from "nish/term-rate"
import { BreakSettings } from "../../../src/break-menu"
import {
  BreakDirector,
  SCENE_GAME,
  SCENE_INTRO,
  SCENE_MENU,
  adaptBreakResolution,
  drawBreakDirector,
  keptSettings,
  sayBreakSound,
  sizeBreakFramebuffer,
  stepBreakDirector
} from "../../../src/break-director"

/** The clock every key event is applied at: held keys never time out. */
const NOW: f64 = 0.0
const WHOLE: f64 = 1.0
const HELP: string = "nish: a compiler\n\nusage: nish <file>\n"
/** A second, in the nanoseconds `adaptBreakResolution` reads. */
const SECOND: i64 = 1000000000

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

/** `s` seconds, in nanoseconds. */
const at = (s: i64): i64 => SECOND * s

/** One step pressing `key` with nothing released after, so the step's requests can be read. */
const press = (d: BreakDirector, input: StepInput, key: i32): boolean => step(d, input, [keyEvent(key, 0, ACTION_PRESS)])

/** One step pressing `key`, and the next releasing it; answers the press's step. */
const tap = (d: BreakDirector, input: StepInput, key: i32): boolean => {
  const going = press(d, input, key)
  step(d, input, [keyEvent(key, 0, ACTION_RELEASE)])
  return going
}

/** One step pressing and releasing `key` `times` times. */
const presses = (d: BreakDirector, input: StepInput, key: i32, times: i32): boolean => {
  const events: TermEvent[] = []
  for (let i: i32 = 0; i < times; i++) {
    events.push(keyEvent(key, 0, ACTION_PRESS))
    events.push(keyEvent(key, 0, ACTION_RELEASE))
  }
  return step(d, input, events)
}

/** A fresh input with real releases, as the checks below step on. */
const freshInput = (): StepInput => {
  const input = new StepInput(new KeyState())
  input.keys.releasesAreSynthetic = false
  return input
}

/** F3 to F9 on a terminal's director, each stepping its setting, saying so and asking for the settings to be kept. */
const checkHotkeys = (t: Suite): void => {
  const d = new BreakDirector(7, new BreakSettings(), HELP, true)
  const input = freshInput()
  t.ok("F3 steps on", press(d, input, KEY_F3))
  t.eqBool("F3 turns the stats on", d.settings.stats, true)
  t.eqStr("F3 says so", d.toast, "stats on")
  t.eqI32("a hotkey's toast has stepped once", d.toastSteps, 239)
  t.eqBool("F3 asks for the settings kept", d.saveWanted, true)
  t.eqI32("the hotkey is taken out of the events", toI32(input.events.length), 0)
  step(d, input, [keyEvent(KEY_F3, 0, ACTION_RELEASE)])
  t.eqBool("the next step asks for nothing kept", d.saveWanted, false)
  t.eqI32("and the toast steps on", d.toastSteps, 238)

  const fps: i32 = d.settings.fps
  t.ok("F4 stops the step to reopen", !press(d, input, KEY_F4))
  t.eqBool("F4 asks for a reopening", d.reopen, true)
  t.ok("F4 steps the frame rate", d.settings.fps !== fps)
  t.eqBool("F4 asks for the settings kept", d.saveWanted, true)
  d.reopen = false
  step(d, input, [keyEvent(KEY_F4, 0, ACTION_RELEASE)])

  d.autoLines = 360
  tap(d, input, KEY_F5)
  t.eqI32("F5 steps the resolution", d.settings.resolution, 1)
  t.eqI32("F5 starts auto resolution from the top", d.autoLines, 1080)
  t.eqStr("F5 says the lines", d.toast, "resolution: 270 lines at most")

  tap(d, input, KEY_F6)
  t.eqI32("F6 steps the graphics to kitty", d.settings.graphics, 3)
  t.eqI32("F6 records the graphics announced", d.openGraphics, 3)
  t.eqStr("F6 says when it applies", d.toast, "graphics: kitty, from the next release")

  tap(d, input, KEY_F7)
  t.eqBool("F7 turns smoothing off", d.settings.smoothing, false)
  t.eqStr("F7 says so", d.toast, "smoothing off")

  const effects: i32 = d.settings.effects
  tap(d, input, KEY_F8)
  t.ok("F8 steps the effects", d.settings.effects !== effects)

  press(d, input, KEY_F9)
  t.eqBool("F9 turns sound on", d.settings.sound, true)
  t.eqBool("F9 says sound changed", d.soundChanged, true)
  t.eqI32("F9 turned sound on once", d.soundTurnedOn, 1)
  t.eqBool("F9's sound is the one kept", keptSettings(d).sound, true)
  t.eqBool("the sound toast is the host's to say", d.soundToastWanted, true)
  sayBreakSound(d, "sound on, through test")
  t.eqStr("the host's words replace the toast's", d.toast, "sound on, through test")
  t.eqI32("and leave how long it has", d.toastSteps, 239)
  step(d, input, [keyEvent(KEY_F9, 0, ACTION_RELEASE)])
  t.eqBool("the change is said once", d.soundChanged, false)

  presses(d, input, KEY_F9, 2)
  t.eqBool("F9 twice in a step: off then on", d.settings.sound, true)
  t.eqI32("turned on once in the step", d.soundTurnedOn, 1)
  presses(d, input, KEY_F9, 3)
  t.eqBool("F9 three times: off, on, off", d.settings.sound, false)
  t.eqI32("turned on once of three", d.soundTurnedOn, 1)
  presses(d, input, KEY_F9, 4)
  t.eqI32("four presses from off turn it on twice", d.soundTurnedOn, 2)

  step(d, input, [keyEvent(KEY_F9, 0, ACTION_PRESS), keyEvent(KEY_F9, 0, ACTION_RELEASE), keyEvent(KEY_F3, 0, ACTION_PRESS)])
  t.eqBool("a later toast in the step takes the sound toast's place", d.soundToastWanted, false)
  t.eqStr("and is the one shown", d.toast, "stats off")
  step(d, input, [keyEvent(KEY_F3, 0, ACTION_RELEASE)])
  t.eqI32("still in the intro", d.scene, SCENE_INTRO)
}

/** An override of the sound, as NISH_BREAK_SOUND makes, is never kept; the player's own choice is. */
const checkKept = (t: Suite): void => {
  const d = new BreakDirector(7, new BreakSettings(), HELP, true)
  const input = freshInput()
  d.settings.sound = true
  tap(d, input, KEY_F7)
  t.eqBool("an override plays", d.settings.sound, true)
  t.eqBool("but the sound kept is the loaded one", keptSettings(d).sound, false)
  t.eqBool("the rest is kept as it is", keptSettings(d).smoothing, false)
  press(d, input, KEY_F9)
  t.eqBool("F9 turns the override off", d.settings.sound, false)
  t.eqBool("which is kept", d.kept.sound, false)
  step(d, input, [keyEvent(KEY_F9, 0, ACTION_RELEASE)])
  tap(d, input, KEY_F9)
  t.eqBool("F9 on again is the player's choice, kept", keptSettings(d).sound, true)
}

/** Auto resolution steps down after 1.5 s under 60 fps on a fast link, then waits 2 s. */
const checkAdapt = (t: Suite): void => {
  const settings = new BreakSettings()
  settings.resolution = 0
  const d = new BreakDirector(7, settings, HELP, true)
  adaptBreakResolution(d, 30, 1.0, 1080, at(10))
  t.eqI32("a slow frame alone changes nothing", d.autoLines, 1080)
  adaptBreakResolution(d, 30, 1.0, 1080, at(11))
  t.eqI32("nor a second later", d.autoLines, 1080)
  adaptBreakResolution(d, 30, 1.0, 1080, at(12))
  t.eqI32("1.5 s slow steps down a choice", d.autoLines, 720)
  adaptBreakResolution(d, 30, 1.0, 720, at(13))
  adaptBreakResolution(d, 30, 1.0, 720, at(13) + at(1))
  t.eqI32("it waits 2 s before looking again", d.autoLines, 720)
  adaptBreakResolution(d, 60, 1.0, 720, at(15))
  adaptBreakResolution(d, 30, 1.0, 720, at(16))
  adaptBreakResolution(d, 30, 1.0, 720, at(17))
  t.eqI32("60 fps starts the wait again", d.autoLines, 720)
  adaptBreakResolution(d, 30, 1.0, 720, at(18))
  t.eqI32("then it steps on down", d.autoLines, 540)
  adaptBreakResolution(d, 30, 40.0, 540, at(30))
  adaptBreakResolution(d, 30, 40.0, 540, at(40))
  t.eqI32("a slow link is not the frames' fault", d.autoLines, 540)
  d.settings.resolution = 1
  adaptBreakResolution(d, 30, 1.0, 270, at(50))
  adaptBreakResolution(d, 30, 1.0, 270, at(60))
  t.eqI32("a chosen resolution is left alone", d.autoLines, 540)
}

/** A room too small holds the scene still, and q still quits. */
const checkSmall = (t: Suite): void => {
  const d = new BreakDirector(7, new BreakSettings(), HELP, true)
  const input = freshInput()
  d.small = true
  t.ok("a small room keeps going", tap(d, input, KEY_SPACE))
  t.eqI32("and holds the intro", d.scene, SCENE_INTRO)
  t.ok("q quits it", !step(d, input, [keyEvent(KEY_CHAR, 113, ACTION_PRESS)]))
  d.small = false
  t.ok("a room big enough again goes on", idle(d, input, 2))
}

/** A host with no terminal: F4 and F6 do nothing, and Settings leaves their rows out. */
const checkNoTerminal = (t: Suite): void => {
  const d = new BreakDirector(7, new BreakSettings(), HELP, false)
  const input = freshInput()
  const fps: i32 = d.settings.fps
  const graphics: i32 = d.settings.graphics
  t.ok("F4 keeps the step going", press(d, input, KEY_F4))
  t.eqBool("F4 asks for no reopening", d.reopen, false)
  t.eqBool("F4 asks for nothing kept", d.saveWanted, false)
  step(d, input, [keyEvent(KEY_F4, 0, ACTION_RELEASE)])
  t.ok("F6 keeps the step going", tap(d, input, KEY_F6))
  t.eqI32("the frame rate is as it was", d.settings.fps, fps)
  t.eqI32("the graphics are as they were", d.settings.graphics, graphics)
  t.eqStr("no toast", d.toast, "")

  tap(d, input, KEY_SPACE)
  t.eqI32("to the menu", d.scene, SCENE_MENU)
  t.eqBool("the menu knows there is no terminal", d.menu.terminal, false)
  for (let i: i32 = 0; i < 3; i++) {
    tap(d, input, KEY_DOWN)
  }
  tap(d, input, KEY_ENTER)
  const rows: string[] = [`${d.menu.row}`]
  for (let i: i32 = 0; i < 6; i++) {
    tap(d, input, KEY_DOWN)
    rows.push(`${d.menu.row}`)
  }
  t.eqStr("Settings goes round every row but the frame rate and graphics", rows.join(" "), "1 3 4 5 6 7 1")
  const resolution: i32 = d.settings.resolution
  tap(d, input, KEY_ENTER)
  t.ok("Enter on the first row shown cycles the resolution", d.settings.resolution !== resolution)
  t.eqI32("and leaves the frame rate", d.settings.fps, fps)

  d.settings.stats = true
  t.ok("the stats name no backend or frame rate with no terminal", statsHash(d, GRAPHICS_KITTY, 0) === statsHash(d, GRAPHICS_HALFBLOCK, 2))
  const shell = new BreakDirector(7, new BreakSettings(), HELP, true)
  shell.settings.stats = true
  t.ok("a terminal's stats name the backend", statsHash(shell, GRAPHICS_KITTY, 0) !== statsHash(shell, GRAPHICS_HALFBLOCK, 0))
}

/** The hash of `d`'s frame drawn on graphics `backend` with frame-rate setting `fps`. */
const statsHash = (d: BreakDirector, backend: i32, fps: i32): u32 => {
  const fb = new Framebuffer(1, 1)
  const stats = new TermStats()
  stats.backend = backend
  d.settings.fps = fps
  sizeBreakFramebuffer(d, fb, 640, 360)
  drawBreakDirector(d, fb, WHOLE, stats)
  return hashPixels(fb)
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
  const d = new BreakDirector(7, settings, HELP, true)
  const input = freshInput()
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

  checkHotkeys(t)
  checkKept(t)
  checkAdapt(t)
  checkSmall(t)
  checkNoTerminal(t)
  return t.done()
}
