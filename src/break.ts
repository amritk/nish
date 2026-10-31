// The director of `nish break`, the brick breaker hidden in the CLI: it owns
// the terminal and hands it from the intro (`break-intro.ts`), where the help
// falls apart into the title, to the title card (`break-menu.ts`) and between
// it and the game (`break-game.ts`), all of which are pure and never touch it.
//
// It runs both under `runTerminal` at 120 steps a second and draws each into
// a framebuffer sized to the backend in use, the terminal's cells and the
// resolution setting. The function keys F3 to F9 change a setting from any
// scene and say so in a toast. A change the terminal must be opened again for
// (the frame rate) closes it and opens it with the new options; the scene
// goes on where it was, and the toast says what the terminal made of the
// change, or that an environment variable won. The graphics setting is kept
// but not yet applied: see `wallGraphicsToast`.
//
// Its text is drawn into the framebuffer with the pixel font rather than as
// screen cells, because a kitty image is drawn above the cells and would hide
// them. A screen too small to play on gets a prompt in plain cells instead,
// and an empty framebuffer, which takes the image off.
//
// Auto resolution starts at the most the screen holds, up to 1080 lines, and
// steps down a choice when the rate controller has held the frame rate under
// 60 for `WALL_SLOW_NS` on a link fast enough that the frames' size is the
// cause; it never steps back up within a run, so it cannot see-saw.
//
// Sound is off unless Settings, F9 or NISH_BREAK_SOUND=1 turns it on; the
// game asks for its sounds each step and `break-sound.ts` plays them.
//
// The settings are kept between runs in `$XDG_CONFIG_HOME/nish/break`, or
// `$HOME/.config/nish/break` (`breakSettingsPath`): read before the terminal
// opens, written when Settings is left and when the game ends. A file that is
// missing, unreadable or wrong in any line gives the defaults for what it
// does not say, and one that cannot be written is let go: neither stops the
// game. NISH_BREAK_SOUND=1 is an override, not a choice, so it is not saved.

import {
  ACTION_PRESS,
  COLOR_DEFAULT,
  EVENT_KEY,
  KEY_CHAR,
  KEY_ESCAPE,
  KEY_F3,
  KEY_F4,
  KEY_F5,
  KEY_F6,
  KEY_F7,
  KEY_F8,
  KEY_F9,
  Screen,
  TermEvent,
} from "nish/term"
import { Frame, TermInput, TerminalOptions, runTerminal } from "nish/term-io"
import {
  Framebuffer,
  GRAPHICS_ASCII,
  GRAPHICS_HALFBLOCK,
  GRAPHICS_KITTY,
  GRAPHICS_SIXEL,
} from "nish/term-pixels"
import { RATE_FIRST, TermStats } from "nish/term-rate"
import {
  View,
  WORLD_H,
  WORLD_W,
  blendRect,
  drawTextCentred,
  drawTextShadow,
  fontScaleFor,
  gfxRgb,
  viewFor,
} from "./break-gfx"
import { GAME_PLAYING, BreakGame, drawBreakGame, newBreakGame, stepBreakGame } from "./break-game"
import {
  BreakIntro,
  INTRO_DONE,
  INTRO_QUIT,
  drawBreakIntro,
  newBreakIntro,
  stepBreakIntro,
} from "./break-intro"
import { BreakSound, SOUND_HELLO, closeSound, playSound, prepareSound, soundPlayer } from "./break-sound"
import {
  BreakMenu,
  BreakSettings,
  MENU_APPLY,
  MENU_QUIT,
  MENU_STAY,
  SCREEN_SETTINGS,
  cycleSetting,
  drawBreakMenu,
  formatBreakSettings,
  fpsChoice,
  newBreakMenuWith,
  parseBreakSettings,
  resolutionChoice,
  stepBreakMenu,
} from "./break-menu"
import { CLI } from "./branding"
import { helpText } from "./cli-style"
import { dirname } from "./paths"
import { Style } from "../std/cli"

/** The least screen, in cells, the scenes are drawn on; a smaller one gets a prompt. */
const WALL_MIN_COLS: i32 = 40
const WALL_MIN_ROWS: i32 = 16

/** How long a toast stays up, in steps (two seconds). */
const WALL_TOAST_STEPS: i32 = 240

/** Settings' rows F3 and F9 step: stats and sound. */
const WALL_ROW_STATS: i32 = 5
const WALL_ROW_SOUND: i32 = 6

/** The height auto resolution starts from: the largest choice. */
const WALL_AUTO_LINES: i32 = 1080

/** How long the rate stays under 60 before auto resolution steps down (1.5 s), and how long it waits after a step (2 s). */
const WALL_SLOW_NS: i64 = 1500000000
const WALL_SETTLE_NS: i64 = 2000000000

/** A round trip under this many milliseconds leaves the frames' size, not the link, to blame for a low rate. */
const WALL_FAST_RTT_MS: f64 = 20.0

/** The scene the director is showing. */
const WALL_SCENE_MENU: i32 = 0
const WALL_SCENE_GAME: i32 = 1
const WALL_SCENE_INTRO: i32 = 2

/** Everything the director keeps across steps, frames and reopenings of the terminal. */
class WallRun {
  intro: BreakIntro
  menu: BreakMenu
  game: BreakGame
  /** The settings the menu edits; every menu after the first edits the same ones. */
  settings: BreakSettings
  /** Where the settings are kept between runs, "" for nowhere. */
  settingsPath: string
  /** The sound setting to keep: the one read, until the player changes sound, so NISH_BREAK_SOUND=1 is never saved. */
  keptSound: boolean
  seed: i64
  toast: string
  /** The view the director's own text is drawn through. */
  view: View
  /** The player and the files sounds are played from, found the first time sound is on. */
  sound: BreakSound
  /** When the rate fell under 60, 0 while it is not; and the earliest auto resolution may step again. */
  slowSince: i64
  settleUntil: i64
  scene: i32
  /** The level the game in play started at, which the menu after it offers again. */
  startLevel: i32
  /** Games started, which varies each game's seed. */
  games: i32
  /** The frame rate setting the terminal was last opened with, and the graphics setting last announced. */
  openFps: i32
  openGraphics: i32
  toastSteps: i32
  /** The most lines auto resolution allows now; it starts at `WALL_AUTO_LINES` and only falls. */
  autoLines: i32
  /** Whether `update` answered false to have the terminal opened again rather than to quit. */
  reopen: boolean
  /** Whether the first frame after a reopening still has to say what came of it. */
  reopened: boolean
  /** Whether a frame has been drawn, so an error after it is not the refusal of a pipe. */
  drawn: boolean
  /** Whether the screen is too small to play on, which holds the scene still. */
  small: boolean

  constructor(seed: i64, settingsPath: string) {
    this.settingsPath = settingsPath
    this.settings = loadBreakSettings(settingsPath)
    this.keptSound = this.settings.sound
    this.seed = seed
    // The help in its colours, as `--help` paints it on a terminal that has them, without an agent's section.
    this.intro = newBreakIntro(helpText(new Style(true, true), ""), seed)
    this.scene = WALL_SCENE_INTRO
    this.menu = newBreakMenuWith(1, seed, this.settings)
    this.game = newBreakGame(1, seed)
    this.startLevel = 1
    this.games = 0
    this.reopen = false
    this.reopened = false
    this.openFps = this.settings.fps
    this.openGraphics = this.settings.graphics
    this.drawn = false
    this.small = false
    this.toast = ""
    this.toastSteps = 0
    this.view = new View()
    this.sound = new BreakSound()
    this.autoLines = WALL_AUTO_LINES
    this.slowSince = toI64(0)
    this.settleUntil = toI64(0)
  }
}

/**
 * Where `nish break` keeps its settings: `${xdg}/nish/break` when `xdg` is
 * absolute, else `${home}/.config/nish/break` when `home` is, else "" for
 * nowhere — `runCacheRoot`'s rules, given the two variables' values.
 */
export const breakSettingsPath = (xdg: string, home: string): string => {
  if (xdg.startsWith("/")) {
    return `${xdg}/${CLI}/break`
  }
  return home.startsWith("/") ? `${home}/.config/${CLI}/break` : ""
}

/** The settings kept at `path`; the defaults when `path` is "" or cannot be read as a file. */
export const loadBreakSettings = (path: string): BreakSettings => {
  const text: string | null = path === "" ? null : readFileSyncOrNull(path)
  if (text === null) {
    return new BreakSettings()
  }
  return parseBreakSettings(text)
}

/**
 * Keep `s` at `path`, making its directory and that directory's parent when
 * they are missing. It is written beside `path` and renamed over it, so a
 * failed write leaves the old file. Answers whether it was kept; a failure
 * anywhere answers false and says nothing.
 */
export const saveBreakSettings = (path: string, s: BreakSettings): boolean => {
  if (path === "") {
    return false
  }
  const dir: string = dirname(path)
  if (!mkdirSync(dirname(dir)) || !mkdirSync(dir)) {
    return false
  }
  const temp: string = `${path}.tmp`
  if (writeFileSyncMode(temp, formatBreakSettings(s), 0o644) < 0 || renameSync(temp, path) < 0) {
    unlinkSync(temp)
    return false
  }
  return true
}

/** Keep the run's settings, with the sound the player chose rather than one an override set. */
const wallSaveSettings = (run: WallRun): void => {
  const sound: boolean = run.settings.sound
  run.settings.sound = run.keptSound
  saveBreakSettings(run.settingsPath, run.settings)
  run.settings.sound = sound
}

/** Show `text` as a toast from now on. */
const wallToast = (run: WallRun, text: string): void => {
  run.toast = text
  run.toastSteps = WALL_TOAST_STEPS
}

/** A `GRAPHICS_*` setting as it reads in a toast, -1 being the terminal's choice. */
const wallGraphicsLabel = (graphics: i32): string => {
  if (graphics === GRAPHICS_KITTY) {
    return "kitty"
  }
  if (graphics === GRAPHICS_SIXEL) {
    return "sixel"
  }
  if (graphics === GRAPHICS_HALFBLOCK) {
    return "half-block"
  }
  return graphics === GRAPHICS_ASCII ? "ascii" : "auto"
}

/**
 * What a change of the graphics setting says. The terminal takes a backend as
 * `TerminalOptions.graphics`, but the seed that builds `src/` is older than that
 * option and its `present` keeps the backend it opened with, so until the next
 * release the setting is kept and the terminal goes on with what it detected.
 */
const wallGraphicsToast = (graphics: i32): string =>
  graphics < 0 ? "graphics: auto" : `graphics: ${wallGraphicsLabel(graphics)}, from the next release`

/** The environment variable `name`, or "" when it is unset. */
const wallGetenv = (name: string): string => {
  const v: string | null = getenv(name)
  return v === null ? "" : v
}

/** Whether this step's events press q (either case) or Esc. */
const wallQuitPressed = (events: TermEvent[]): boolean => {
  for (const e of events) {
    if (e.type === EVENT_KEY && e.action === ACTION_PRESS) {
      if (e.key === KEY_ESCAPE || (e.key === KEY_CHAR && (e.code === 113 || e.code === 81))) {
        return true
      }
    }
  }
  return false
}

/** Whether `e` is a press of one of the director's keys, F3 to F9. */
const wallHotkey = (e: TermEvent): boolean => e.type === EVENT_KEY && e.key >= KEY_F3 && e.key <= KEY_F9

/** The settings row director key `key` steps: F4 to F8 are the first five in order, F3 stats, F9 sound. */
const wallKeyRow = (key: i32): i32 => {
  if (key === KEY_F3) {
    return WALL_ROW_STATS
  }
  return key === KEY_F9 ? WALL_ROW_SOUND : key - KEY_F4
}

/** Auto resolution from the top again, as when it is chosen afresh. */
const wallResetAuto = (run: WallRun): void => {
  run.autoLines = WALL_AUTO_LINES
  run.slowSince = toI64(0)
  run.settleUntil = toI64(0)
}

/** What the resolution setting says in a toast. */
const wallResolutionToast = (resolution: i32): string => {
  const lines: i32 = resolutionChoice(resolution)
  return lines === 0 ? "resolution: auto" : `resolution: ${lines} lines at most`
}

/**
 * Sound has just been turned on or off: on, find a player and play the
 * hello, or say there is none. Answers the toast.
 */
const wallSoundToast = (run: WallRun): string => {
  if (!run.settings.sound) {
    return "sound off"
  }
  if (!prepareSound(run.sound, monotonicNanos())) {
    return "sound: no player found (afplay, pw-play, paplay, aplay or ffplay)"
  }
  playSound(run.sound, SOUND_HELLO, monotonicNanos())
  return `sound on, through ${soundPlayer(run.sound)}`
}

/**
 * Apply the director's key `key`: step its setting as Settings does, say so,
 * and ask for a reopening where it needs one.
 */
const wallApplyKey = (run: WallRun, key: i32): void => {
  const s: BreakSettings = run.settings
  cycleSetting(s, wallKeyRow(key), 1)
  if (key === KEY_F3) {
    wallToast(run, s.stats ? "stats on" : "stats off")
  } else if (key === KEY_F4) {
    run.reopen = true
  } else if (key === KEY_F5) {
    wallResetAuto(run)
    wallToast(run, wallResolutionToast(s.resolution))
  } else if (key === KEY_F9) {
    run.keptSound = s.sound
    wallToast(run, wallSoundToast(run))
  } else if (key === KEY_F6) {
    run.openGraphics = s.graphics
    wallToast(run, wallGraphicsToast(s.graphics))
  } else if (key === KEY_F7) {
    wallToast(run, s.smoothing ? "smoothing on" : "smoothing off")
  } else if (key === KEY_F8) {
    wallToast(run, s.effects === 0 ? "effects low" : "effects high")
  }
}

/**
 * Take the director's keys out of `events` in place, applying each press, so
 * the scene sees only its own; a held key's repeats are taken and ignored.
 */
const wallTakeHotkeys = (run: WallRun, events: TermEvent[]): void => {
  let kept: i32 = 0
  for (let i: i32 = 0; i < events.length; i++) {
    const e: TermEvent = events[i]
    if (wallHotkey(e)) {
      if (e.action === ACTION_PRESS) {
        wallApplyKey(run, e.key)
      }
      continue
    }
    if (kept !== i && kept >= 0 && kept < events.length) {
      events[kept] = e
    }
    kept++
  }
  while (toI32(events.length) > kept) {
    events.pop()
  }
}

/** Play the sounds a scene asked for this step, when sound is on. */
const wallPlaySounds = (run: WallRun, sounds: i32[]): void => {
  if (!run.settings.sound) {
    return
  }
  const now: i64 = monotonicNanos()
  for (const id of sounds) {
    playSound(run.sound, id, now)
  }
}

/** Start a game at `level`, the menu's answer. */
const wallStartGame = (run: WallRun, level: i32): void => {
  run.games = run.games + 1
  run.startLevel = level
  run.game = newBreakGame(level, run.seed + toI64(run.games))
  run.game.effects = run.settings.effects
  run.scene = WALL_SCENE_GAME
}

/** Back to the title card, offering the level the last game started at, with the same settings. */
const wallBackToMenu = (run: WallRun): void => {
  run.menu = newBreakMenuWith(run.startLevel, run.seed + toI64(run.games), run.settings)
  run.scene = WALL_SCENE_MENU
}

/**
 * One step: the director's keys, then the scene's step and what its answer
 * asks for. Answers false to close the terminal, to quit or (with `reopen`)
 * to open it again with new options.
 */
const wallUpdate = (run: WallRun, input: TermInput): boolean => {
  wallTakeHotkeys(run, input.events)
  // What the hotkeys left, so a change the menu makes below is told apart from theirs.
  const resolution: i32 = run.settings.resolution
  const sound: boolean = run.settings.sound
  if (run.toastSteps > 0) {
    run.toastSteps = run.toastSteps - 1
  }
  if (run.reopen) {
    return false
  }
  if (run.small) {
    return !wallQuitPressed(input.events)
  }
  if (run.scene === WALL_SCENE_INTRO) {
    run.intro.effects = run.settings.effects
    const answer: i32 = stepBreakIntro(run.intro, input)
    wallPlaySounds(run, run.intro.sounds)
    if (answer === INTRO_QUIT) {
      return false
    }
    if (answer === INTRO_DONE) {
      run.scene = WALL_SCENE_MENU
    }
    return true
  }
  if (run.scene === WALL_SCENE_MENU) {
    const inSettings: boolean = run.menu.screen === SCREEN_SETTINGS
    const answer: i32 = stepBreakMenu(run.menu, input)
    if (run.settings.sound !== sound) {
      run.keptSound = run.settings.sound
    }
    if (inSettings && run.menu.screen !== SCREEN_SETTINGS) {
      wallSaveSettings(run)
    }
    if (answer === MENU_QUIT) {
      return false
    }
    if (run.settings.resolution !== resolution) {
      wallResetAuto(run)
    }
    if (run.settings.sound !== sound) {
      wallToast(run, wallSoundToast(run))
    }
    if (answer === MENU_APPLY) {
      // Only the rate needs the terminal opened again: the graphics setting
      // is not handed to it yet, so a change there is only said.
      if (run.settings.fps !== run.openFps) {
        run.reopen = true
        return false
      }
      if (run.settings.graphics !== run.openGraphics) {
        run.openGraphics = run.settings.graphics
        wallToast(run, wallGraphicsToast(run.openGraphics))
      }
      return true
    }
    if (answer !== MENU_STAY) {
      wallStartGame(run, answer)
    }
    return true
  }
  run.game.effects = run.settings.effects
  const answer: i32 = stepBreakGame(run.game, input)
  wallPlaySounds(run, run.game.sounds)
  if (answer !== GAME_PLAYING) {
    wallBackToMenu(run)
  }
  return true
}

/** The cell size in pixels a probed size stands for, `fallback` when the probe did not learn it. */
const wallCellPx = (px: i32, fallback: i32): i32 => (px > 0 && px <= 256 ? px : fallback)

/** The next resolution choice below `lines`, or `lines` when none is: what auto steps down to. */
const wallStepDown = (lines: i32): i32 => {
  if (lines > 720) {
    return 720
  }
  if (lines > 540) {
    return 540
  }
  if (lines > 360) {
    return 360
  }
  return lines > 270 ? 270 : lines
}

/**
 * Under auto resolution, step `autoLines` down below the frame's height when
 * the rate has been under 60 for `WALL_SLOW_NS` on a fast link, then wait
 * `WALL_SETTLE_NS` for the controller to see the smaller frames.
 */
const wallAdaptResolution = (run: WallRun, stats: TermStats, height: i32, now: i64): void => {
  if (resolutionChoice(run.settings.resolution) !== 0 || height <= 270 || now < run.settleUntil) {
    return
  }
  if (stats.tier >= 60 || stats.rttMs >= WALL_FAST_RTT_MS) {
    run.slowSince = toI64(0)
    return
  }
  if (run.slowSince === toI64(0)) {
    run.slowSince = now
    return
  }
  if (now - run.slowSince >= WALL_SLOW_NS) {
    run.autoLines = wallStepDown(Math.min(run.autoLines, height))
    run.slowSince = toI64(0)
    run.settleUntil = now + WALL_SETTLE_NS
  }
}

/**
 * Size `fb` for a screen of `cols × rows` cells drawn with `backend`: as large
 * a 16:9 image as the cells hold, no taller than the resolution setting, or
 * under auto than `autoLines`. Resizes only when the size changes, as a
 * resize blanks the pixels.
 */
const wallSizeFramebuffer = (run: WallRun, frame: Frame, fb: Framebuffer): void => {
  const cols: i32 = frame.screen.width
  const rows: i32 = frame.screen.height
  const backend: i32 = frame.stats.backend
  const pixels: boolean = backend === GRAPHICS_KITTY || backend === GRAPHICS_SIXEL
  const roomW: i32 = pixels ? cols * wallCellPx(frame.caps.cellWidthPx, 8) : cols
  const roomH: i32 = pixels ? rows * wallCellPx(frame.caps.cellHeightPx, 16) : rows * 2
  const chosen: i32 = resolutionChoice(run.settings.resolution)
  let h: i32 = Math.min(roomH, chosen === 0 ? run.autoLines : chosen)
  let w: i32 = (h * 16) / 9
  if (w > roomW) {
    w = roomW
    h = (w * 9) / 16
  }
  if (fb.width !== w || fb.height !== h) {
    fb.resize(w, h)
  }
}

/** A whole number of `x`, for the stats line. */
const wallWhole = (x: f64): i32 => (x > -1000000000.0 && x < 1000000000.0 ? toI32(Math.round(x)) : 0)

/** The director's text over the scene: the stats when they are on, and the toast while it lasts. */
const wallDrawText = (run: WallRun, fb: Framebuffer, stats: TermStats): void => {
  const view: View = run.view
  viewFor(view, fb, 0.0, 0.0)
  const scale: i32 = Math.max(fontScaleFor(view, 6.0), 1)
  const shadow: i32 = gfxRgb(0, 0, 0)
  // The stats lines are built afresh each frame while F3 has them on; off,
  // nothing is built. They are a diagnostic, so the strings are not cached.
  if (run.settings.stats) {
    const s: BreakSettings = run.settings
    blendRect(view, 0.0, 0.0, WORLD_W, 20.0, shadow, 0.6)
    drawTextShadow(
      view,
      3.0,
      2.0,
      scale,
      `${stats.tier}fps ${wallWhole(stats.rttMs)}ms ${wallWhole(stats.bytesPerSec / 1000.0)}kB/s ${wallWhole(stats.frameCostMs)}ms drop ${stats.dropped}`,
      gfxRgb(255, 255, 255),
      shadow
    )
    const fps: i32 = fpsChoice(s.fps)
    drawTextShadow(
      view,
      3.0,
      11.0,
      scale,
      `${wallGraphicsLabel(stats.backend)} ${fb.width}x${fb.height} ${fps === 0 ? "auto" : `${fps}`}fps`,
      gfxRgb(200, 200, 200),
      shadow
    )
  }
  if (run.toastSteps > 0 && run.toast !== "") {
    blendRect(view, 0.0, WORLD_H - 14.0, WORLD_W, 14.0, shadow, 0.7)
    drawTextCentred(view, WORLD_W / 2.0, WORLD_H - 11.0, scale, run.toast, gfxRgb(255, 230, 120), shadow)
  }
}

/** What a reopening of the terminal came to, from what the probe made of the options and the environment. */
const wallReopenToast = (run: WallRun): string => {
  const s: BreakSettings = run.settings
  let said: string = ""
  if (s.graphics !== run.openGraphics) {
    said = wallGraphicsToast(s.graphics)
  }
  if (s.fps !== run.openFps) {
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

/** One frame: the scene in the framebuffer with the director's text over it, or the prompt on a small screen. */
const wallRender = (run: WallRun, frame: Frame): void => {
  const screen: Screen = frame.screen
  const fb: Framebuffer = frame.framebuffer
  screen.clear(COLOR_DEFAULT)
  run.drawn = true
  if (run.reopened) {
    run.reopened = false
    const said: string = wallReopenToast(run)
    if (said !== "") {
      wallToast(run, said)
    }
    run.openFps = run.settings.fps
    run.openGraphics = run.settings.graphics
  }
  run.small = screen.width < WALL_MIN_COLS || screen.height < WALL_MIN_ROWS
  if (run.small) {
    if (fb.width !== 0) {
      fb.resize(0, 0)
    }
    wallCentre(screen, screen.height / 2, "make me bigger")
    return
  }
  wallAdaptResolution(run, frame.stats, fb.height, monotonicNanos())
  wallSizeFramebuffer(run, frame, fb)
  const alpha: f64 = run.settings.smoothing ? frame.alpha : 1.0
  if (run.scene === WALL_SCENE_INTRO) {
    drawBreakIntro(run.intro, fb, alpha)
  } else if (run.scene === WALL_SCENE_MENU) {
    drawBreakMenu(run.menu, fb, alpha)
  } else {
    drawBreakGame(run.game, fb, alpha)
  }
  wallDrawText(run, fb, frame.stats)
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
 * setting needs it, and keep the settings however it ends. Answers the exit
 * code: 1, with a sentence on stderr, when the terminal cannot be opened (a
 * pipe, say) before anything was drawn.
 */
export const playBreak = (): i32 => {
  const path: string = breakSettingsPath(wallGetenv("XDG_CONFIG_HOME"), wallGetenv("HOME"))
  const run: WallRun = new WallRun(monotonicNanos(), path)
  if (wallGetenv("NISH_BREAK_SOUND") === "1") {
    run.settings.sound = true
    wallToast(run, wallSoundToast(run))
  }
  run.reopen = true
  let code: i32 = 0
  while (run.reopen) {
    run.reopen = false
    const played: Result<i32, string> = runTerminal(wallOptions(run.settings), run, wallUpdate, wallRender)
    if (!played.isOk()) {
      if (!run.drawn) {
        console.error("the wall is only visible in a terminal.")
        code = 1
      }
      run.reopen = false
    } else {
      run.reopened = run.reopen
    }
  }
  wallSaveSettings(run)
  closeSound(run.sound)
  return code
}
