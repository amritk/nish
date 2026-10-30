// The title card of the brick breaker (`src/break-menu.ts`), driven a step at a
// time with scripted input: the title's navigation and level choice, How to
// play, every Settings row both ways and the one MENU_APPLY that leaving
// answers, the outro's length, its skip and the wipe that closes it, the
// attract wall knocking out and growing back, the ball drawn between steps,
// and a pinned frame of every screen. The negatives are levels out of range,
// choices out of range, a repeat that must not skip the outro, and
// framebuffers too small to draw in, which must draw nothing and never panic.
import { Suite } from "../../../std/testing"
import {
  ACTION_PRESS,
  ACTION_RELEASE,
  ACTION_REPEAT,
  EVENT_KEY,
  KEY_CHAR,
  KEY_DOWN,
  KEY_ENTER,
  KEY_ESCAPE,
  KEY_LEFT,
  KEY_RIGHT,
  KEY_SPACE,
  KEY_UP,
  KeyState,
  TermEvent,
} from "nish/term"
import { TermInput } from "nish/term-io"
import { Framebuffer } from "nish/term-pixels"
import {
  BreakMenu,
  BreakSettings,
  FPS_CHOICE_COUNT,
  MENU_APPLY,
  MENU_QUIT,
  MENU_STAY,
  OUTRO_STEPS,
  RESOLUTION_CHOICE_COUNT,
  SCREEN_HOWTO,
  SCREEN_OUTRO,
  SCREEN_SETTINGS,
  SCREEN_TITLE,
  cycleSetting,
  drawBreakMenu,
  fpsChoice,
  newBreakMenu,
  newBreakMenuWith,
  resolutionChoice,
  rowHint,
  rowValue,
  stepBreakMenu,
} from "../../../src/break-menu"
import { View, pixelX, pixelY, textWidth, viewFor } from "../../../src/break-gfx"

/** The arrow and letter codes the menu reads. */
const CH_J: i32 = 106
const CH_K: i32 = 107
const CH_W: i32 = 119
const CH_S_UPPER: i32 = 83
const CH_D: i32 = 100
const CH_H: i32 = 104
const CH_Q: i32 = 113
const CH_Q_UPPER: i32 = 81
const CH_X: i32 = 120

/** The colour the outro's wipe covers the world in. */
const WIPE: i32 = 0x05040c

/** The attract ball's colour, which nothing else on the title draws. */
const BALL: i32 = 0xfff4d8

/** An input with no events: a step where the player does nothing. */
const quiet = (): TermInput => new TermInput(new KeyState())

/** An input holding one key event of `key` (`code` for `KEY_CHAR`) with `action`. */
const keyInput = (key: i32, code: i32, action: i32): TermInput => {
  const input = quiet()
  const e = new TermEvent(EVENT_KEY)
  e.key = key
  e.code = code
  e.action = action
  input.events.push(e)
  return input
}

/** One step with `key` pressed. */
const press = (menu: BreakMenu, key: i32): i32 => stepBreakMenu(menu, keyInput(key, 0, ACTION_PRESS))

/** One step with the letter `code` pressed. */
const pressChar = (menu: BreakMenu, code: i32): i32 => stepBreakMenu(menu, keyInput(KEY_CHAR, code, ACTION_PRESS))

/** `n` steps of no input; answers the last step's answer. */
const idle = (menu: BreakMenu, n: i32): i32 => {
  const none = quiet()
  let answer: i32 = MENU_STAY
  for (let i: i32 = 0; i < n; i++) {
    answer = stepBreakMenu(menu, none)
  }
  return answer
}

/** A menu at `level` from a fixed seed, its logo landed and its items faded in. */
const settled = (level: i32): BreakMenu => {
  const menu = newBreakMenu(level, toI64(20251030))
  idle(menu, 160)
  return menu
}

/** Every pixel of `fb` folded through an xorshift, which cannot overflow: a pin of a whole frame. */
const hashOf = (fb: Framebuffer): i32 => {
  let h: i32 = -2128831035
  for (const p of fb.pixels) {
    h = h ^ p
    h = h ^ (h << 13)
    h = h ^ (h >>> 17)
    h = h ^ (h << 5)
  }
  return h
}

/** How many pixels of `fb` are exactly `colour`. */
const countOf = (fb: Framebuffer, colour: i32): i32 => {
  let n: i32 = 0
  for (const p of fb.pixels) {
    if (p === colour) {
      n++
    }
  }
  return n
}

/** The mean pixel column (`axis` 0) or row (1) of the pixels of `fb` that are exactly `colour`, or -1 with none. */
const centroid = (fb: Framebuffer, colour: i32, axis: i32): f64 => {
  let sum: f64 = 0.0
  let n: i32 = 0
  for (let y: i32 = 0; y < fb.height; y++) {
    for (let x: i32 = 0; x < fb.width; x++) {
      if (fb.get(x, y) === colour) {
        sum = sum + toF64(axis === 0 ? x : y)
        n++
      }
    }
  }
  return n === 0 ? -1.0 : sum / toF64(n)
}

/** `t.nearF64`, as a function so its literal arguments are typed `f64` by the parameters. */
const nearF = (t: Suite, name: string, actual: f64, expected: f64, tolerance: f64): boolean =>
  t.nearF64(name, actual, expected, tolerance)

const testInterface = (t: Suite): void => {
  t.eqI32("MENU_STAY", MENU_STAY, 0)
  t.eqI32("MENU_QUIT", MENU_QUIT, -1)
  t.eqI32("MENU_APPLY", MENU_APPLY, -2)
  t.eqI32("five frame rates", FPS_CHOICE_COUNT, 5)
  t.eqI32("five resolutions", RESOLUTION_CHOICE_COUNT, 5)
  t.eqI32("the first frame rate is adaptive", fpsChoice(0), 0)
  t.eqI32("then 30", fpsChoice(1), 30)
  t.eqI32("then 60", fpsChoice(2), 60)
  t.eqI32("then 120", fpsChoice(3), 120)
  t.eqI32("then 240", fpsChoice(4), 240)
  t.eqI32("the resolutions start at 270", resolutionChoice(0), 270)
  t.eqI32("then 360", resolutionChoice(1), 360)
  t.eqI32("then 540", resolutionChoice(2), 540)
  t.eqI32("then 720", resolutionChoice(3), 720)
  t.eqI32("and end at 1080", resolutionChoice(4), 1080)
  t.eqI32("a frame rate index below range reads the first", fpsChoice(-3), 0)
  t.eqI32("a frame rate index above range reads the last", fpsChoice(9), 240)
  t.eqI32("a resolution index below range reads the first", resolutionChoice(-1), 270)
  t.eqI32("a resolution index above range reads the last", resolutionChoice(5), 1080)

  const s = new BreakSettings()
  t.eqI32("default fps is adaptive", s.fps, 0)
  t.eqI32("default resolution is 540", resolutionChoice(s.resolution), 540)
  t.eqI32("default graphics is automatic", s.graphics, -1)
  t.eqBool("default smoothing is on", s.smoothing, true)
  t.eqI32("default effects are high", s.effects, 1)
  t.eqBool("default stats are off", s.stats, false)

  const m = newBreakMenu(3, toI64(1))
  t.eqI32("a new menu is on the title", m.screen, SCREEN_TITLE)
  t.eqI32("a new menu selects Play", m.selected, 0)
  t.eqI32("a new menu keeps its level", m.level, 3)
  t.eqI32("a new menu has the default settings", m.settings.resolution * 10 + m.settings.effects, 21)
  t.eqI32("level 0 is clamped to 1", newBreakMenu(0, toI64(1)).level, 1)
  t.eqI32("level 7 is clamped to 6", newBreakMenu(7, toI64(1)).level, 6)

  // The director hands one menu's settings to the next, and both edit the same object.
  const kept = new BreakSettings()
  kept.fps = 3
  kept.stats = true
  const again = newBreakMenuWith(2, toI64(5), kept)
  t.ok("newBreakMenuWith edits the settings it is given", again.settings === kept)
  t.eqI32("newBreakMenuWith keeps the frame rate", again.settings.fps, 3)
  t.eqI32("newBreakMenuWith keeps the level", again.level, 2)

  // A seed decides the attract scene; a 64-bit seed's high half counts too.
  const a = newBreakMenu(1, toI64(42))
  const b = newBreakMenu(1, toI64(42))
  const c = newBreakMenu(1, toI64(42) + (toI64(1) << toI64(40)))
  idle(a, 300)
  idle(b, 300)
  idle(c, 300)
  t.ok("one seed plays the same attract scene", a.ballX === b.ballX && a.ballY === b.ballY)
  t.ok("a seed's high half changes the scene", a.ballX !== c.ballX || a.ballY !== c.ballY)
}

const testTitle = (t: Suite): void => {
  const m = settled(1)
  press(m, KEY_DOWN)
  t.eqI32("down selects Start level", m.selected, 1)
  pressChar(m, CH_J)
  t.eqI32("j moves down", m.selected, 2)
  pressChar(m, CH_S_UPPER)
  t.eqI32("S moves down", m.selected, 3)
  press(m, KEY_DOWN)
  press(m, KEY_DOWN)
  t.eqI32("down from Quit wraps to Play", m.selected, 0)
  press(m, KEY_UP)
  t.eqI32("up from Play wraps to Quit", m.selected, 4)
  pressChar(m, CH_K)
  pressChar(m, CH_W)
  t.eqI32("k and w move up", m.selected, 2)
  stepBreakMenu(m, keyInput(KEY_UP, 0, ACTION_REPEAT))
  t.eqI32("a held key repeats", m.selected, 1)
  stepBreakMenu(m, keyInput(KEY_UP, 0, ACTION_RELEASE))
  t.eqI32("a release does nothing", m.selected, 1)
  pressChar(m, CH_X)
  t.eqI32("an unbound letter does nothing", m.selected * 10 + m.screen, 10)

  // Start level cycles 1 to 6 and wraps both ways.
  press(m, KEY_RIGHT)
  t.eqI32("right raises the level", m.level, 2)
  pressChar(m, CH_D)
  pressChar(m, CH_D)
  pressChar(m, CH_D)
  pressChar(m, CH_D)
  t.eqI32("d raises it to 6", m.level, 6)
  press(m, KEY_RIGHT)
  t.eqI32("right from 6 wraps to 1", m.level, 1)
  press(m, KEY_LEFT)
  t.eqI32("left from 1 wraps to 6", m.level, 6)
  pressChar(m, CH_H)
  t.eqI32("h lowers it", m.level, 5)
  press(m, KEY_UP)
  press(m, KEY_RIGHT)
  t.eqI32("left and right move nothing off Start level", m.level * 10 + m.selected, 50)

  // The highlight slides to the selected item over a few steps, then rests on it.
  press(m, KEY_DOWN)
  t.ok("the highlight moves the step after", m.highlightY > m.prevHighlightY)
  t.ok("the highlight is still on its way", m.highlightY < 95.0)
  idle(m, 120)
  nearF(t, "the highlight settles on Start level", m.highlightY, 95.0, 0.0)
  t.ok("a settled highlight stands still", m.highlightY === m.prevHighlightY)

  t.eqI32("Esc quits", press(settled(1), KEY_ESCAPE), MENU_QUIT)
  t.eqI32("q quits", pressChar(settled(1), CH_Q), MENU_QUIT)
  t.eqI32("Q quits", pressChar(settled(1), CH_Q_UPPER), MENU_QUIT)
  const quit = settled(1)
  press(quit, KEY_UP)
  t.eqI32("picking Quit quits", press(quit, KEY_ENTER), MENU_QUIT)
  t.eqI32("a quiet step stays", idle(settled(1), 1), MENU_STAY)
}

const testHowTo = (t: Suite): void => {
  const m = settled(1)
  press(m, KEY_DOWN)
  press(m, KEY_DOWN)
  t.eqI32("How to play opens on enter", press(m, KEY_ENTER), MENU_STAY)
  t.eqI32("it is the how-to-play screen", m.screen, SCREEN_HOWTO)
  press(m, KEY_DOWN)
  t.eqI32("arrows do nothing under it", m.selected * 10 + m.screen, 20 + SCREEN_HOWTO)
  t.eqI32("Esc closes it rather than quits", press(m, KEY_ESCAPE), MENU_STAY)
  t.eqI32("back on the title", m.screen, SCREEN_TITLE)
  press(m, KEY_SPACE)
  t.eqI32("space opens it too", m.screen, SCREEN_HOWTO)
  press(m, KEY_ENTER)
  t.eqI32("enter closes it", m.screen, SCREEN_TITLE)
  press(m, KEY_SPACE)
  t.eqI32("q quits from it", pressChar(m, CH_Q), MENU_QUIT)
}

/** One step whose events are `first` then `second`, both pressed. */
const burst = (menu: BreakMenu, first: i32, second: i32): i32 => {
  const input = keyInput(first, 0, ACTION_PRESS)
  const e = new TermEvent(EVENT_KEY)
  e.key = second
  e.action = ACTION_PRESS
  input.events.push(e)
  return stepBreakMenu(menu, input)
}

/** A held key repeats only the moves; a burst changes at most one screen. */
const testHeld = (t: Suite): void => {
  const m = settled(1)
  press(m, KEY_DOWN)
  press(m, KEY_DOWN)
  press(m, KEY_ENTER)
  t.eqI32("Esc held after How to play closes does not quit", press(m, KEY_ESCAPE), MENU_STAY)
  t.eqI32("the repeat is ignored", stepBreakMenu(m, keyInput(KEY_ESCAPE, 0, ACTION_REPEAT)), MENU_STAY)
  t.eqI32("still on the title", m.screen, SCREEN_TITLE)
  stepBreakMenu(m, keyInput(KEY_ENTER, 0, ACTION_REPEAT))
  t.eqI32("a held Enter does not reopen it", m.screen, SCREEN_TITLE)
  t.eqI32("Enter then Esc in one step opens How to play", burst(m, KEY_ENTER, KEY_ESCAPE), MENU_STAY)
  t.eqI32("and the Esc aimed at the title is dropped", m.screen, SCREEN_HOWTO)
  press(m, KEY_ESCAPE)
  burst(m, KEY_DOWN, KEY_DOWN)
  t.eqI32("two moves in one step both land", m.selected, 4)

  const s = settled(1)
  press(s, KEY_UP)
  press(s, KEY_UP)
  press(s, KEY_ENTER)
  const held = keyInput(KEY_ENTER, 0, ACTION_REPEAT)
  for (let i: i32 = 0; i < 3; i++) {
    stepBreakMenu(s, held)
  }
  t.eqI32("a held Enter opens Settings without cycling the frame rate", s.settings.fps, 0)
  stepBreakMenu(s, keyInput(KEY_RIGHT, 0, ACTION_REPEAT))
  t.eqI32("a held arrow still cycles it", s.settings.fps, 1)
}

/** A settled menu with Settings open. */
const inSettings = (): BreakMenu => {
  const m = settled(1)
  press(m, KEY_UP)
  press(m, KEY_UP)
  press(m, KEY_ENTER)
  return m
}

const testSettings = (t: Suite): void => {
  const m = inSettings()
  t.eqI32("Settings opens on its first row", m.screen * 10 + m.row, SCREEN_SETTINGS * 10)
  nearF(t, "the highlight snaps to the first row", m.highlightY, 86.0, 0.0)
  press(m, KEY_UP)
  t.eqI32("up from the first row wraps to back", m.row, 6)
  press(m, KEY_DOWN)
  t.eqI32("down from back wraps to the first", m.row, 0)

  // Frame rate: right walks the choices and wraps; left walks back.
  press(m, KEY_RIGHT)
  t.eqStr("right: 30 fps", rowValue(m.settings, 0), "30")
  press(m, KEY_RIGHT)
  press(m, KEY_RIGHT)
  press(m, KEY_RIGHT)
  t.eqStr("then 240", rowValue(m.settings, 0), "240")
  press(m, KEY_RIGHT)
  t.eqStr("wrapping to auto", rowValue(m.settings, 0), "auto")
  press(m, KEY_LEFT)
  t.eqStr("left from auto wraps to 240", rowValue(m.settings, 0), "240")
  t.eqStr("a fixed rate's hint", rowHint(m.settings, 0), "fixed rates turn the adaptive controller off")
  press(m, KEY_ENTER)
  t.eqI32("enter on a value cycles it forward", m.settings.fps, 0)
  t.eqStr("the adaptive hint", rowHint(m.settings, 0), "adaptive: up to 120, less when it must")

  press(m, KEY_DOWN)
  press(m, KEY_LEFT)
  t.eqStr("resolution left: 360p", rowValue(m.settings, 1), "360p")
  press(m, KEY_LEFT)
  press(m, KEY_LEFT)
  t.eqStr("resolution wraps to 1080p", rowValue(m.settings, 1), "1080p")
  press(m, KEY_RIGHT)
  press(m, KEY_RIGHT)
  t.eqStr("resolution wraps up to 360p", rowValue(m.settings, 1), "360p")
  press(m, KEY_RIGHT)
  press(m, KEY_RIGHT)
  t.eqStr("resolution 720p", rowValue(m.settings, 1), "720p")
  press(m, KEY_LEFT)
  t.eqStr("resolution back to 540p", rowValue(m.settings, 1), "540p")
  t.eqStr("resolution's hint", rowHint(m.settings, 1), "the largest frame; a slow terminal gets less")

  // Graphics runs auto, kitty, sixel, half-block, ascii, the best first.
  press(m, KEY_DOWN)
  t.eqStr("graphics starts automatic", rowValue(m.settings, 2), "auto")
  t.eqStr("the automatic hint", rowHint(m.settings, 2), "the best the terminal answers for")
  press(m, KEY_RIGHT)
  t.eqStr("then kitty", rowValue(m.settings, 2), "kitty")
  t.eqI32("kitty is GRAPHICS_KITTY", m.settings.graphics, 3)
  t.eqStr("a forced backend's hint", rowHint(m.settings, 2), "forced, if the terminal can show it")
  press(m, KEY_RIGHT)
  t.eqStr("then sixel", rowValue(m.settings, 2), "sixel")
  press(m, KEY_RIGHT)
  t.eqStr("then half-block", rowValue(m.settings, 2), "half-block")
  press(m, KEY_RIGHT)
  t.eqStr("then ascii", rowValue(m.settings, 2), "ascii")
  t.eqI32("ascii is GRAPHICS_ASCII", m.settings.graphics, 0)
  press(m, KEY_RIGHT)
  t.eqI32("and round to automatic", m.settings.graphics, -1)
  press(m, KEY_LEFT)
  t.eqStr("left from automatic wraps to ascii", rowValue(m.settings, 2), "ascii")
  press(m, KEY_RIGHT)

  press(m, KEY_DOWN)
  t.eqStr("smoothing starts on", rowValue(m.settings, 3), "on")
  t.eqStr("smoothing's hint", rowHint(m.settings, 3), "frames blend between steps")
  press(m, KEY_LEFT)
  t.eqStr("smoothing off", rowValue(m.settings, 3), "off")
  t.eqStr("no smoothing's hint", rowHint(m.settings, 3), "every frame shows a whole step")
  press(m, KEY_RIGHT)
  t.eqBool("smoothing on again", m.settings.smoothing, true)

  press(m, KEY_DOWN)
  t.eqStr("effects start high", rowValue(m.settings, 4), "high")
  t.eqStr("high effects' hint", rowHint(m.settings, 4), "glow, trails and every spark")
  press(m, KEY_RIGHT)
  t.eqStr("effects low", rowValue(m.settings, 4), "low")
  t.eqStr("low effects' hint", rowHint(m.settings, 4), "no glow, no trails, fewer sparks")
  press(m, KEY_LEFT)
  t.eqI32("effects high again", m.settings.effects, 1)

  press(m, KEY_DOWN)
  t.eqStr("stats start off", rowValue(m.settings, 5), "off")
  press(m, KEY_ENTER)
  t.eqStr("stats on", rowValue(m.settings, 5), "on")
  t.eqStr("stats' hint", rowHint(m.settings, 5), "frame rate and backend in a corner")
  press(m, KEY_LEFT)

  press(m, KEY_DOWN)
  t.eqStr("back has no value", rowValue(m.settings, 6), "")
  t.eqStr("back's hint", rowHint(m.settings, 6), "frame rate and graphics reopen the terminal")
  press(m, KEY_LEFT)
  t.ok("left and right on back change nothing", m.settings.fps === 0 && m.settings.graphics === -1)

  // Every hint fits the panel at the smallest text scale.
  let widest: i32 = 0
  for (let r: i32 = 0; r < 7; r++) {
    widest = Math.max(widest, textWidth(rowHint(m.settings, r), 1))
  }
  t.ok("every hint fits inside the panel", widest <= 280)

  // Nothing that reopens the terminal changed, so leaving stays.
  t.eqI32("leaving with only resolution and toggles touched stays", press(m, KEY_ENTER), MENU_STAY)
  t.eqI32("picking back returns to the title", m.screen, SCREEN_TITLE)

  // A frame rate changed answers MENU_APPLY once, as Settings closes.
  const f = inSettings()
  press(f, KEY_RIGHT)
  t.eqI32("a change alone does not apply", idle(f, 1), MENU_STAY)
  t.eqI32("Esc out of a changed frame rate applies", press(f, KEY_ESCAPE), MENU_APPLY)
  t.eqI32("Esc leaves Settings for the title", f.screen, SCREEN_TITLE)
  t.eqI32("the next step does not apply again", idle(f, 1), MENU_STAY)
  press(f, KEY_ENTER)
  t.eqI32("reopened, it is Settings", f.screen, SCREEN_SETTINGS)
  t.eqI32("leaving unchanged after an apply stays", press(f, KEY_ESCAPE), MENU_STAY)

  const g = inSettings()
  press(g, KEY_DOWN)
  press(g, KEY_DOWN)
  press(g, KEY_LEFT)
  press(g, KEY_UP)
  press(g, KEY_UP)
  press(g, KEY_UP)
  t.eqI32("a graphics change applies on back", press(g, KEY_ENTER), MENU_APPLY)

  const h = inSettings()
  press(h, KEY_RIGHT)
  press(h, KEY_LEFT)
  t.eqI32("a change undone does not apply", press(h, KEY_ESCAPE), MENU_STAY)
  t.eqI32("q quits from Settings", pressChar(inSettings(), CH_Q), MENU_QUIT)

  // A setting out of range still cycles to a choice.
  const odd = new BreakSettings()
  odd.fps = 9
  odd.resolution = -4
  odd.graphics = 7
  cycleSetting(odd, 0, 1)
  cycleSetting(odd, 1, -1)
  cycleSetting(odd, 2, 1)
  t.eqI32("an fps past the end cycles from the last", odd.fps, 0)
  t.eqI32("a resolution below range cycles from the first", odd.resolution, 4)
  t.eqI32("an unknown backend cycles from automatic", odd.graphics, 3)
  cycleSetting(odd, 9, 1)
  t.eqI32("a row past the last changes nothing", odd.fps * 100 + odd.resolution * 10 + odd.graphics, 43)
}

const testOutro = (t: Suite): void => {
  const m = settled(4)
  t.eqI32("Play starts the outro", press(m, KEY_ENTER), MENU_STAY)
  t.eqI32("the outro is on", m.screen, SCREEN_OUTRO)
  let steps: i32 = 0
  let answer: i32 = MENU_STAY
  while (answer === MENU_STAY && steps < 1000) {
    answer = idle(m, 1)
    steps++
  }
  t.eqI32("the outro lasts OUTRO_STEPS after the pick", steps, OUTRO_STEPS)
  t.eqI32("it is a second", OUTRO_STEPS, 120)
  t.eqI32("it answers the level", answer, 4)

  // The frame drawn after the last step but one, at alpha 1, is the wipe alone.
  const w = settled(2)
  press(w, KEY_ENTER)
  idle(w, OUTRO_STEPS - 1)
  const fb = new Framebuffer(320, 180)
  drawBreakMenu(w, fb, 1.0)
  t.eqI32("the outro's last frame is wiped clean", countOf(fb, WIPE), 320 * 180)
  t.eqI32("and the next step answers", idle(w, 1), 2)

  // Halfway, the logo bricks are falling and the wipe has started.
  const mid = settled(1)
  const before: f64 = mid.ys[0]
  press(mid, KEY_ENTER)
  idle(mid, 90)
  t.ok("the first brick has fallen", mid.ys[0] > before + 20.0)
  // The outro's first step is 1: a brick released on step 0 would fall without its kick.
  let earliest: i32 = 1000
  for (const r of mid.releases) {
    earliest = Math.min(earliest, r)
  }
  t.ok("every logo brick is released on an outro step", earliest >= 1)
  drawBreakMenu(mid, fb, 0.0)
  const wiped: i32 = countOf(fb, WIPE)
  t.ok("the wipe covers part of the world", wiped > 0 && wiped < 320 * 180)

  // Start level plays the level chosen.
  const s = settled(1)
  press(s, KEY_DOWN)
  press(s, KEY_LEFT)
  press(s, KEY_ENTER)
  t.eqI32("Start level starts the outro", s.screen, SCREEN_OUTRO)
  t.eqI32("a key held over does not skip it", stepBreakMenu(s, keyInput(KEY_ENTER, 0, ACTION_REPEAT)), MENU_STAY)
  t.eqI32("a fresh press skips to the level", press(s, KEY_SPACE), 6)
}

const testWall = (t: Suite): void => {
  const m = newBreakMenu(1, toI64(9))
  let knocked: i32 = -1
  let grew: boolean = false
  for (let i: i32 = 0; i < 4000 && !grew; i++) {
    idle(m, 1)
    if (knocked < 0) {
      for (let k: i32 = 0; k < 96; k++) {
        if (m.wallAway[k] > 0 && knocked < 0) {
          knocked = k
        }
      }
    } else if (m.wallAway[knocked] === 0 && m.wallAge[knocked] >= 24) {
      grew = true
    }
  }
  t.ok("the attract ball knocks a brick out", knocked >= 0)
  t.ok("the brick grows back", grew)
  t.ok("the ball stays in the world", m.ballX >= 0.0 && m.ballX <= 320.0 && m.ballY >= 0.0 && m.ballY <= 180.0)
}

const testDraw = (t: Suite): void => {
  // The ball is drawn between its last two positions, by alpha.
  const m = settled(1)
  m.settings.effects = 0
  m.trail.clear()
  const fb = new Framebuffer(1920, 1080)
  const view = new View()
  viewFor(view, fb, 0.0, 0.0)
  drawBreakMenu(m, fb, 0.5)
  const midX: f64 = pixelX(view, (m.prevBallX + m.ballX) / 2.0)
  const midY: f64 = pixelY(view, (m.prevBallY + m.ballY) / 2.0)
  nearF(t, "alpha 0.5 draws the ball halfway across the step", centroid(fb, BALL, 0), midX, 1.0)
  nearF(t, "and halfway down it", centroid(fb, BALL, 1), midY, 1.0)
  drawBreakMenu(m, fb, 0.0)
  const x0: f64 = centroid(fb, BALL, 0)
  drawBreakMenu(m, fb, 1.0)
  const x1: f64 = centroid(fb, BALL, 0)
  nearF(t, "alpha 0 and 1 draw a step apart", Math.abs(x1 - x0), Math.abs(pixelX(view, m.ballX) - pixelX(view, m.prevBallX)), 1.0)

  // Frames too small to draw in draw nothing and never panic.
  const empty = new Framebuffer(0, 0)
  drawBreakMenu(m, empty, 0.5)
  t.eqI32("0x0 draws nothing", empty.pixels.length, 0)
  const dot = new Framebuffer(1, 1)
  drawBreakMenu(m, dot, 0.5)
  t.ok("1x1 draws without panic", dot.width === 1)

  // A pinned frame of every screen, at a size with brick lettering and at one without.
  const big = new Framebuffer(640, 360)
  const small = new Framebuffer(160, 90)
  const title = settled(1)
  drawBreakMenu(title, big, 0.25)
  t.eqI32("the title at 640x360", hashOf(big), 592711343)
  drawBreakMenu(title, small, 0.25)
  t.eqI32("the title at 160x90, compact", hashOf(small), -1621917949)
  const howTo = settled(1)
  press(howTo, KEY_UP)
  press(howTo, KEY_UP)
  press(howTo, KEY_UP)
  press(howTo, KEY_ENTER)
  drawBreakMenu(howTo, big, 0.5)
  t.eqI32("how to play at 640x360", hashOf(big), 143556489)
  drawBreakMenu(howTo, small, 0.5)
  t.eqI32("how to play at 160x90", hashOf(small), 1904136362)
  const settings = inSettings()
  press(settings, KEY_DOWN)
  drawBreakMenu(settings, big, 0.5)
  t.eqI32("Settings at 640x360", hashOf(big), -1599294725)
  drawBreakMenu(settings, small, 0.5)
  t.eqI32("Settings at 160x90, compact", hashOf(small), 1350802634)
  const outro = settled(1)
  press(outro, KEY_ENTER)
  idle(outro, 40)
  drawBreakMenu(outro, big, 0.5)
  t.eqI32("the outro at 640x360", hashOf(big), -658084989)
  const intro = newBreakMenu(1, toI64(3))
  idle(intro, 20)
  drawBreakMenu(intro, big, 0.5)
  t.eqI32("the logo dropping in at 640x360", hashOf(big), 1842479832)
  // At 80x45 a logo cell is under two pixels tall, so the title is drawn as text.
  const tiny = new Framebuffer(80, 45)
  drawBreakMenu(title, tiny, 0.25)
  t.eqI32("the title at 80x45, as text", hashOf(tiny), -880170419)
}

export const main = (): number => {
  const t = new Suite("break-menu")
  testInterface(t)
  testTitle(t)
  testHowTo(t)
  testHeld(t)
  testSettings(t)
  testOutro(t)
  testWall(t)
  testDraw(t)
  return t.done()
}
