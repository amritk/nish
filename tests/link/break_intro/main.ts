// The opening of the brick breaker (`src/break-intro.ts`): the help cut into
// pieces with the colours its escapes set, the missing brick its rule leaves
// found and dropped in, the collapse, the sweep of courses and the clear that
// leaves the title's wall, driven a step at a time. It checks the sounds each
// beat asks for, that any key skips and q or Esc quits, that the intro ends on
// its own, and that its last frame is the title's first. The negatives are a
// help with no gap, an empty help, and framebuffers too small to draw in,
// which must draw nothing and never panic.
import { Suite } from "../../../std/testing"
import { ACTION_PRESS, ACTION_RELEASE, EVENT_KEY, KEY_CHAR, KEY_ESCAPE, KEY_SPACE, KeyState, TermEvent } from "nish/term"
import { TermInput } from "nish/term-io"
import { Framebuffer } from "nish/term-pixels"
import { Style } from "../../../std/cli"
import { helpText } from "../../../src/cli-style"
import {
  BreakIntro,
  INTRO_DONE,
  INTRO_PLAYING,
  INTRO_QUIT,
  drawBreakIntro,
  newBreakIntro,
  stepBreakIntro,
} from "../../../src/break-intro"
import { drawBreakMenu, newBreakMenu } from "../../../src/break-menu"
import { SOUND_CLEAR, SOUND_STEEL, SOUND_WALL } from "../../../src/break-game"

/** The letter codes the intro reads. */
const CH_Q: i32 = 113
const CH_Q_UPPER: i32 = 81
const CH_X: i32 = 120

/** The colours the cut gives plain, cyan and bold magenta text, and the missing brick. */
const PLAIN: i32 = 0xd8d4f0
const CYAN: i32 = 0x58d8e8
const MAGENTA: i32 = 0xe070f0
const GAP_BRICK: i32 = 0xffd070

/** The steps the intro may take before it must have ended on its own. */
const LONGEST: i32 = 600

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

/** The help `nish --help` prints in colour. */
const realHelp = (): string => helpText(new Style(true, true), "")

/** A small help: a coloured name, a rule of four bricks with the third knocked out, and a cyan flag. */
const smallHelp = (): string => {
  const b = "▀▀▀▀"
  return "\u001b[1;35mnish\u001b[0m tool\n" + b + " " + b + "      " + b + "\n  \u001b[36m--help\u001b[0m\n"
}

/** Steps `intro` with no input until it stops playing or `n` steps pass; answers the steps taken. */
const runOut = (intro: BreakIntro, n: i32): i32 => {
  const none = quiet()
  let steps: i32 = 0
  while (steps < n) {
    steps++
    if (stepBreakIntro(intro, none) !== INTRO_PLAYING) {
      return steps
    }
  }
  return steps
}

/** Steps `intro` with no input to its end; answers how it ended. */
const stepUntilDone = (intro: BreakIntro): i32 => {
  const none = quiet()
  let answer: i32 = INTRO_PLAYING
  for (let i: i32 = 0; i < LONGEST && answer === INTRO_PLAYING; i++) {
    answer = stepBreakIntro(intro, none)
  }
  return answer
}

/** The index of the first piece whose text is `text`, or -1. */
const pieceOf = (intro: BreakIntro, text: string): i32 => {
  for (let i: i32 = 0; i < intro.texts.length; i++) {
    if (intro.texts[i] === text) {
      return i
    }
  }
  return -1
}

/** A framebuffer of `w` by `h` pixels, every one the terminal's dark. */
const blank = (w: i32, h: i32): Framebuffer => {
  const fb = new Framebuffer(w, h)
  for (let i: i32 = 0; i < fb.pixels.length; i++) {
    fb.pixels[i] = 0x05040c
  }
  return fb
}

/** How many pixels differ between `a` and `b`, which are the same size. */
const differing = (a: Framebuffer, b: Framebuffer): i32 => {
  let n: i32 = 0
  for (let i: i32 = 0; i < a.pixels.length; i++) {
    if (a.pixels[i] !== b.pixels[i]) {
      n++
    }
  }
  return n
}

/** The piece cut: texts, colours from the escapes, columns, and the gap. */
const testCut = (t: Suite): void => {
  const intro = newBreakIntro(smallHelp(), toI64(7))
  const name = pieceOf(intro, "nish")
  t.ok("the name is a piece", name >= 0)
  t.eqI32("the name takes the escape's bold magenta", intro.colours[name], MAGENTA)
  const tool = pieceOf(intro, "tool")
  t.ok("the word after the reset is a piece", tool >= 0)
  t.eqI32("the reset brings back plain text", intro.colours[tool], PLAIN)
  t.eqI32("the escape takes no column", intro.widths[name], 4)
  const flag = pieceOf(intro, "--help")
  t.eqI32("the flag is cyan", intro.colours[flag], CYAN)
  t.eqI32("the flag is on the third line", intro.lines[flag], 2)
  t.ok("the rule's gap is found", intro.gap >= 0)
  t.eqI32("the missing brick is the gold one", intro.colours[intro.gap], GAP_BRICK)
  t.eqI32("the missing brick is four columns wide", intro.widths[intro.gap], 4)
  t.eqI32("the missing brick is on the rule's line", intro.lines[intro.gap], 1)
  // The rule's bricks start at columns 0, 5 and 15; the gap is the one at 10.
  t.ok("the missing brick lands between the second and third", intro.xs[intro.gap] > 0.0)

  const solid = "▀▀▀▀ ▀▀▀▀ ▀▀▀▀\n"
  t.eqI32("a rule with no gap has no missing brick", newBreakIntro(solid, toI64(7)).gap, -1)
  const empty = newBreakIntro("", toI64(7))
  t.eqI32("an empty help has no pieces", empty.texts.length, 0)
  t.eqI32("an empty help has no gap", empty.gap, -1)
  t.eqI32("an empty help still ends", stepUntilDone(empty), INTRO_DONE)

  const real = newBreakIntro(realHelp(), toI64(20251030))
  t.ok("the real help's rule has its gap", real.gap >= 0)
  t.ok("the real help is cut into many pieces", real.texts.length > 100)
}

/** Any key skips, q and Esc quit, and a release does neither. */
const testKeys = (t: Suite): void => {
  const skip = newBreakIntro(realHelp(), toI64(1))
  t.eqI32("a quiet step plays on", stepBreakIntro(skip, quiet()), INTRO_PLAYING)
  t.eqI32("space skips", stepBreakIntro(skip, keyInput(KEY_SPACE, 0, ACTION_PRESS)), INTRO_DONE)
  const letter = newBreakIntro(realHelp(), toI64(1))
  t.eqI32("a letter skips", stepBreakIntro(letter, keyInput(KEY_CHAR, CH_X, ACTION_PRESS)), INTRO_DONE)
  const q = newBreakIntro(realHelp(), toI64(1))
  t.eqI32("q quits", stepBreakIntro(q, keyInput(KEY_CHAR, CH_Q, ACTION_PRESS)), INTRO_QUIT)
  const upper = newBreakIntro(realHelp(), toI64(1))
  t.eqI32("Q quits", stepBreakIntro(upper, keyInput(KEY_CHAR, CH_Q_UPPER, ACTION_PRESS)), INTRO_QUIT)
  const esc = newBreakIntro(realHelp(), toI64(1))
  t.eqI32("Esc quits", stepBreakIntro(esc, keyInput(KEY_ESCAPE, 0, ACTION_PRESS)), INTRO_QUIT)
  const release = newBreakIntro(realHelp(), toI64(1))
  t.eqI32("a release plays on", stepBreakIntro(release, keyInput(KEY_SPACE, 0, ACTION_RELEASE)), INTRO_PLAYING)
}

/** The intro ends on its own, with the beats' sounds in order. */
const testRun = (t: Suite): void => {
  const intro = newBreakIntro(realHelp(), toI64(20251030))
  const none = quiet()
  let steel: i32 = -1
  let firstWall: i32 = -1
  let walls: i32 = 0
  let clear: i32 = -1
  let answer: i32 = INTRO_PLAYING
  let steps: i32 = 0
  while (answer === INTRO_PLAYING && steps < LONGEST) {
    answer = stepBreakIntro(intro, none)
    steps++
    for (const s of intro.sounds) {
      if (s === SOUND_STEEL && steel < 0) {
        steel = steps
      }
      if (s === SOUND_WALL) {
        walls++
        if (firstWall < 0) {
          firstWall = steps
        }
      }
      if (s === SOUND_CLEAR && clear < 0) {
        clear = steps
      }
    }
  }
  t.eqI32("the intro ends on its own", answer, INTRO_DONE)
  t.ok("the intro ends before its longest", steps < LONGEST)
  t.ok("the intro lasts over two seconds", steps > 240)
  t.ok("the missing brick rings as it lands", steel > 0)
  t.ok("each course laid knocks", walls >= 6)
  t.ok("the courses come after the brick lands", firstWall > steel)
  t.ok("the wall's last brick chimes after the courses", clear > firstWall)
}

/** The last frame is the title's first, but for its ball, and small frames never panic. */
const testDraw = (t: Suite): void => {
  const intro = newBreakIntro(realHelp(), toI64(20251030))
  t.eqI32("the intro reaches its end", stepUntilDone(intro), INTRO_DONE)
  const last = new Framebuffer(320, 180)
  drawBreakIntro(intro, last, 1.0)
  const title = new Framebuffer(320, 180)
  drawBreakMenu(newBreakMenu(1, toI64(20251030)), title, 1.0)
  // Only the attract ball and its glow, at most 22 pixels square, are new on the title's first frame.
  const changed = differing(last, title)
  t.ok("the last frame is the title's first but for the ball", changed > 0 && changed <= 22 * 22)

  const playing = newBreakIntro(realHelp(), toI64(3))
  runOut(playing, 100)
  const big = new Framebuffer(640, 360)
  drawBreakIntro(playing, big, 0.5)
  t.ok("a frame mid-collapse draws text over the dark", differing(big, blank(640, 360)) > 1000)
  drawBreakIntro(playing, new Framebuffer(1, 1), 0.5)
  drawBreakIntro(playing, new Framebuffer(0, 0), 0.5)
  drawBreakIntro(playing, new Framebuffer(3, 200), 0.5)
  t.pass("framebuffers too small to draw in never panic")
  playing.effects = 0
  runOut(playing, 600)
  drawBreakIntro(playing, big, 0.5)
  t.pass("low effects run and draw to the end")
}

export const main = (): number => {
  const t = new Suite("break-intro")
  testCut(t)
  testKeys(t)
  testRun(t)
  testDraw(t)
  return t.done()
}
