// The terminal's host for `nish break`, the brick breaker hidden in the CLI.
// The game itself is `break-director.ts`, which hands the player between the
// intro, the title card and the game and is pure; this module gives it a
// terminal. It runs the director under `runTerminal` at 120 steps a second and
// draws each frame into a framebuffer sized to the backend in use, the
// terminal's cells and the resolution setting. A change the terminal must be
// opened again for (the frame rate) closes it and opens it with the new
// options; the scene goes on where it was, and the toast says what the
// terminal made of the change, or that an environment variable won. The
// graphics setting is kept but not yet applied: see `breakGraphicsToast`.
//
// The director's text is drawn into the framebuffer with the pixel font
// rather than as screen cells, because a kitty image is drawn above the cells
// and would hide them. A screen too small to play on gets a prompt in plain
// cells instead, and an empty framebuffer, which takes the image off.
//
// Sound is off unless Settings, F9 or NISH_BREAK_SOUND=1 turns it on; the
// scenes ask for their sounds each step and `break-sound.ts` plays them.
//
// The settings are kept between runs in `$XDG_CONFIG_HOME/nish/break`, or
// `$HOME/.config/nish/break` (`break-settings-file.ts`): read before the
// terminal opens, written when Settings is left, when F3 to F9 change one,
// and when a run that drew a frame ends. A pipe, refused, writes nothing. A
// SIGINT Ctrl-C ends the process before that last write, so the others keep
// every change. A file that is missing, unreadable or wrong in any line gives
// the defaults for what it does not say, and one that cannot be written is
// let go: neither stops the game. NISH_BREAK_SOUND=1 is an override, not a
// choice, so it is not saved.

import { COLOR_DEFAULT, KeyState, Screen } from "nish/term"
import { Frame, TermInput, TerminalOptions, runTerminal } from "nish/term-io"
import { Framebuffer, GRAPHICS_KITTY, GRAPHICS_SIXEL } from "nish/term-pixels"
import { RATE_FIRST } from "nish/term-rate"
import { StepInput } from "../std/input"
import {
  BreakDirector,
  adaptBreakResolution,
  breakGraphicsToast,
  breakTerminalOpened,
  drawBreakDirector,
  keptSettings,
  sayBreakSound,
  sizeBreakFramebuffer,
  stepBreakDirector,
  toastBreak,
} from "./break-director"
import { BreakSettings, fpsChoice } from "./break-menu"
import { breakSettingsPath, loadBreakSettings, saveBreakSettings } from "./break-settings-file"
import { BreakSound, closeSound, playSound, prepareSound, soundPlayer } from "./break-sound"
import { SOUND_HELLO } from "./break-voices"
import { helpText } from "./cli-style"
import { Style } from "../std/cli"

/** The least screen, in cells, the scenes are drawn on; a smaller one gets a prompt. */
const WALL_MIN_COLS: i32 = 40
const WALL_MIN_ROWS: i32 = 16

/** What the terminal's host keeps across steps, frames and reopenings of the terminal, beside the director. */
class WallRun {
  director: BreakDirector
  /** The input the director steps on: term-io's events and keys each step, pointed at, not copied. */
  step: StepInput
  /** Where the settings are kept between runs, "" for nowhere. */
  settingsPath: string
  /** The player and the files sounds are played from, found the first time sound is on. */
  sound: BreakSound
  /** Whether the first frame after a reopening still has to say what came of it. */
  reopened: boolean
  /** Whether a frame has been drawn, so an error after it is not the refusal of a pipe. */
  drawn: boolean

  constructor(seed: i64, settingsPath: string) {
    this.settingsPath = settingsPath
    // The help in its colours, as `--help` paints it on a terminal that has them, without an agent's section.
    this.director = new BreakDirector(
      seed,
      loadBreakSettings(settingsPath),
      helpText(new Style(true, true), ""),
      true
    )
    this.step = new StepInput(new KeyState())
    this.sound = new BreakSound()
    this.reopened = false
    this.drawn = false
  }
}

/** The environment variable `name`, or "" when it is unset. */
const wallGetenv = (name: string): string => {
  const v: string | null = getenv(name)
  return v === null ? "" : v
}

/**
 * Sound has just been turned on `turnedOn` times, and perhaps off after:
 * find a player and play the hello for each time on, then say how sound
 * ends up, or that there is no player. Answers the toast.
 */
const wallSoundToast = (run: WallRun, turnedOn: i32): string => {
  let found: boolean = true
  for (let i: i32 = 0; i < turnedOn && found; i++) {
    found = prepareSound(run.sound, monotonicNanos())
    if (found) {
      playSound(run.sound, SOUND_HELLO, monotonicNanos())
    }
  }
  if (!run.director.settings.sound) {
    return "sound off"
  }
  return found
    ? `sound on, through ${soundPlayer(run.sound)}`
    : "sound: no player found (afplay, pw-play, paplay, aplay or ffplay)"
}

/**
 * One step of the director on term-io's input, then what it asked for: the
 * settings kept, sound found and said, and the scene's sounds played. Answers
 * false to close the terminal, to quit or (with the director's `reopen`) to
 * open it again with new options.
 */
const wallUpdate = (run: WallRun, input: TermInput): boolean => {
  const d: BreakDirector = run.director
  run.step.events = input.events
  run.step.keys = input.keys
  const going: boolean = stepBreakDirector(d, run.step)
  if (d.soundChanged) {
    const said: string = wallSoundToast(run, d.soundTurnedOn)
    if (d.soundToastWanted) {
      sayBreakSound(d, said)
    }
  }
  if (d.saveWanted) {
    saveBreakSettings(run.settingsPath, d.kept)
  }
  if (d.settings.sound) {
    const now: i64 = monotonicNanos()
    for (const id of d.sounds) {
      playSound(run.sound, id, now)
    }
  }
  return going
}

/** The cell size in pixels a probed size stands for, `fallback` when the probe did not learn it. */
const wallCellPx = (px: i32, fallback: i32): i32 => (px > 0 && px <= 256 ? px : fallback)

/** What a reopening of the terminal came to, from what the probe made of the options and the environment. */
const wallReopenToast = (d: BreakDirector): string => {
  const s: BreakSettings = d.settings
  let said: string = ""
  if (s.graphics !== d.openGraphics) {
    said = breakGraphicsToast(s.graphics)
  }
  if (s.fps !== d.openFps) {
    const forced: string = wallGetenv("NISH_TERM_FPS")
    const fps: i32 = fpsChoice(s.fps)
    let rate: string = fps === 0 ? "fps: auto, from 120" : `${fps} fps fixed`
    if (forced !== "") {
      rate = `NISH_TERM_FPS=${forced} wins`
    }
    said = said === "" ? rate : `${said}; ${rate}`
  }
  return said
}

/** Centre `text` on row `y` of `screen` in plain cells. */
const wallCentre = (screen: Screen, y: i32, text: string): void => {
  screen.text(Math.max((screen.width - toI32(text.length)) / 2, 0), y, text, COLOR_DEFAULT, COLOR_DEFAULT, 0)
}

/** One frame: the director's in the framebuffer, or the prompt on a small screen. */
const wallRender = (run: WallRun, frame: Frame): void => {
  const d: BreakDirector = run.director
  const screen: Screen = frame.screen
  const fb: Framebuffer = frame.framebuffer
  screen.clear(COLOR_DEFAULT)
  run.drawn = true
  if (run.reopened) {
    run.reopened = false
    const said: string = wallReopenToast(d)
    if (said !== "") {
      toastBreak(d, said)
    }
    breakTerminalOpened(d)
  }
  d.small = screen.width < WALL_MIN_COLS || screen.height < WALL_MIN_ROWS
  if (d.small) {
    if (fb.width !== 0) {
      fb.resize(0, 0)
    }
    wallCentre(screen, screen.height / 2, "make me bigger")
    return
  }
  adaptBreakResolution(d, frame.stats.tier, frame.stats.rttMs, fb.height, monotonicNanos())
  // The room is the cells' pixels under kitty and sixel, and a cell's two half-blocks otherwise.
  const backend: i32 = frame.stats.backend
  const pixels: boolean = backend === GRAPHICS_KITTY || backend === GRAPHICS_SIXEL
  const cols: i32 = screen.width
  const rows: i32 = screen.height
  const roomW: i32 = pixels ? cols * wallCellPx(frame.caps.cellWidthPx, 8) : cols
  const roomH: i32 = pixels ? rows * wallCellPx(frame.caps.cellHeightPx, 16) : rows * 2
  sizeBreakFramebuffer(d, fb, roomW, roomH)
  drawBreakDirector(d, fb, frame.alpha, frame.stats)
}

/** The terminal options the settings ask for. */
const wallOptions = (s: BreakSettings): TerminalOptions => {
  const options: TerminalOptions = new TerminalOptions()
  options.stepsPerSecond = 120
  options.prefer = RATE_FIRST
  options.mouse = 0
  const fps: i32 = fpsChoice(s.fps)
  options.fixedFps = fps
  options.maxFps = fps > 120 ? fps : 120
  options.allow120 = true
  // A framebuffer from the start, so a kitty terminal's image is set up at open; the first frame sizes it.
  options.framebufferWidth = 320
  options.framebufferHeight = 180
  return options
}

/**
 * Play until the menu quits or Ctrl-C, opening the terminal again whenever a
 * setting needs it, and keep the settings once a frame was drawn, however it
 * ends; a run refused before that writes nothing. Answers the exit
 * code: 1, with a sentence on stderr, when the terminal cannot be opened (a
 * pipe, say) before anything was drawn.
 */
export const playBreak = (): i32 => {
  const path: string = breakSettingsPath(wallGetenv("XDG_CONFIG_HOME"), wallGetenv("HOME"))
  const run: WallRun = new WallRun(monotonicNanos(), path)
  const d: BreakDirector = run.director
  if (wallGetenv("NISH_BREAK_SOUND") === "1") {
    d.settings.sound = true
    toastBreak(d, wallSoundToast(run, 1))
  }
  d.reopen = true
  let code: i32 = 0
  while (d.reopen) {
    d.reopen = false
    const played: Result<i32, string> = runTerminal(wallOptions(d.settings), run, wallUpdate, wallRender)
    if (!played.isOk()) {
      if (!run.drawn) {
        console.error("the wall is only visible in a terminal.")
        code = 1
      }
      d.reopen = false
    } else {
      run.reopened = d.reopen
    }
  }
  if (run.drawn) {
    saveBreakSettings(run.settingsPath, keptSettings(d))
  }
  closeSound(run.sound)
  return code
}
