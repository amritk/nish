// The director of `nish break`, with no host: it hands the player from the
// intro (`break-intro.ts`), where the help falls apart into the title, to the
// title card (`break-menu.ts`) and between it and the game (`break-game.ts`),
// applies the function keys F3 to F9 from any scene, says what they changed in
// a toast, and steps auto resolution down when the frames come too slowly.
//
// It is pure, like the scenes: no terminal, no file, no clock and no process.
// A host owns it and does what it cannot. `break.ts` is the terminal's host;
// a page or a test is another. Each step the host hands it a `StepInput`
// (`stepBreakDirector`), then reads what the step asks of it:
//
// - `sounds`, the ids the scene asked for, to play when `settings.sound` is on;
// - `soundChanged`, sound just turned on or off: the host finds a player and
//   plays the hello, and when `soundToastWanted` still holds, says how it went
//   in a toast (`toastBreak`), as no later toast of the step has replaced it;
// - `saveWanted`, the settings to keep (`keptSettings`, with the sound the
//   player chose rather than one an override set) written now, since an
//   interrupt could end the run before its end;
// - `reopen`, a setting (the frame rate) that only a host which opens the
//   terminal with it can apply.
//
// Each frame the host sizes the framebuffer (`sizeBreakFramebuffer`, from the
// room it has), reports how fast the frames are going (`adaptBreakResolution`,
// with its clock's time) and draws (`drawBreakDirector`). The seed and the help
// the intro breaks apart are the host's too, so a host with a fixed seed and
// scripted keys draws the same frames every run.
//
// Auto resolution starts at the most the room holds, up to 1080 lines, and
// steps down a choice when the frame rate has been under 60 for
// `DIRECTOR_SLOW_NS` on a link fast enough that the frames' size is the cause;
// it never steps back up within a run, so it cannot see-saw.

import {
  ACTION_PRESS,
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
  TermEvent,
} from "nish/term"
import { StepInput } from "../std/input"
import {
  Framebuffer,
  GRAPHICS_ASCII,
  GRAPHICS_HALFBLOCK,
  GRAPHICS_KITTY,
  GRAPHICS_SIXEL,
} from "nish/term-pixels"
import { TermStats } from "nish/term-rate"
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
import {
  BreakMenu,
  BreakSettings,
  MENU_APPLY,
  MENU_QUIT,
  MENU_STAY,
  SCREEN_SETTINGS,
  cycleSetting,
  drawBreakMenu,
  fpsChoice,
  newBreakMenuWith,
  resolutionChoice,
  stepBreakMenu,
} from "./break-menu"

/** How long a toast stays up, in steps (two seconds). */
const DIRECTOR_TOAST_STEPS: i32 = 240

/** Settings' rows F3 and F9 step: stats and sound. */
const DIRECTOR_ROW_STATS: i32 = 5
const DIRECTOR_ROW_SOUND: i32 = 6

/** The height auto resolution starts from: the largest choice. */
const DIRECTOR_AUTO_LINES: i32 = 1080

/** How long the rate stays under 60 before auto resolution steps down (1.5 s), and how long it waits after a step (2 s). */
const DIRECTOR_SLOW_NS: i64 = 1500000000
const DIRECTOR_SETTLE_NS: i64 = 2000000000

/** A round trip under this many milliseconds leaves the frames' size, not the link, to blame for a low rate. */
const DIRECTOR_FAST_RTT_MS: f64 = 20.0

/** The scene the director is showing. */
export const SCENE_MENU: i32 = 0
export const SCENE_GAME: i32 = 1
export const SCENE_INTRO: i32 = 2

/** Everything the director keeps across steps and frames, and what a step asks of its host. */
export class BreakDirector {
  intro: BreakIntro
  menu: BreakMenu
  game: BreakGame
  /** The settings the menu edits; every menu after the first edits the same ones. */
  settings: BreakSettings
  seed: i64
  toast: string
  /** The view the director's own text is drawn through. */
  view: View
  /** The sounds the scene asked for this step: the scene's own list, or `quiet`. */
  sounds: i32[]
  /** The empty list `sounds` is when the scene asked for none. */
  quiet: i32[]
  /** What `keptSettings` fills, made once. */
  kept: BreakSettings
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
  /** The most lines auto resolution allows now; it starts at `DIRECTOR_AUTO_LINES` and only falls. */
  autoLines: i32
  /** The sound setting to keep: the one the host gave, until the player changes sound, so an override is never kept. */
  keptSound: boolean
  /** Whether the step asks the host to open the terminal again with the settings: a frame rate changed. */
  reopen: boolean
  /** Whether the step asks the host to keep `keptSettings` now. */
  saveWanted: boolean
  /** Whether sound was turned on or off this step, and whether its toast is still the one to show. */
  soundChanged: boolean
  soundToastWanted: boolean
  /** Whether the host's room is too small to play in, which holds the scene still; the host sets it. */
  small: boolean

  /**
   * A director at the start of the intro.
   *
   * @param seed The seed of every scene's randomness; games after the first add their count to it.
   * @param settings The settings to start from, which the host loaded.
   * @param help The help text the intro breaks apart, with its colours.
   */
  constructor(seed: i64, settings: BreakSettings, help: string) {
    this.settings = settings
    this.keptSound = settings.sound
    this.seed = seed
    this.intro = newBreakIntro(help, seed)
    this.scene = SCENE_INTRO
    this.menu = newBreakMenuWith(1, seed, settings)
    this.game = newBreakGame(1, seed)
    this.startLevel = 1
    this.games = 0
    this.reopen = false
    this.saveWanted = false
    this.soundChanged = false
    this.soundToastWanted = false
    this.openFps = settings.fps
    this.openGraphics = settings.graphics
    this.small = false
    this.toast = ""
    this.toastSteps = 0
    this.view = new View()
    this.quiet = []
    this.sounds = this.quiet
    this.kept = new BreakSettings()
    this.autoLines = DIRECTOR_AUTO_LINES
    this.slowSince = toI64(0)
    this.settleUntil = toI64(0)
  }
}

/** The settings to keep: `d`'s, with the sound the player chose rather than one an override set. */
export const keptSettings = (d: BreakDirector): BreakSettings => {
  const s: BreakSettings = d.settings
  const k: BreakSettings = d.kept
  k.fps = s.fps
  k.resolution = s.resolution
  k.graphics = s.graphics
  k.effects = s.effects
  k.smoothing = s.smoothing
  k.stats = s.stats
  k.sound = d.keptSound
  return k
}

/** Show `text` as a toast from now on. */
export const toastBreak = (d: BreakDirector, text: string): void => {
  d.toast = text
  d.toastSteps = DIRECTOR_TOAST_STEPS
  d.soundToastWanted = false
}

/** Sound was just turned on or off: the host says how it went, unless a later toast of the step replaces it. */
const directorSoundChanged = (d: BreakDirector): void => {
  toastBreak(d, d.settings.sound ? "sound on" : "sound off")
  d.soundChanged = true
  d.soundToastWanted = true
}

/** A `GRAPHICS_*` setting as it reads in a toast, -1 being the host's choice. */
const breakGraphicsLabel = (graphics: i32): string => {
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
export const breakGraphicsToast = (graphics: i32): string =>
  graphics < 0 ? "graphics: auto" : `graphics: ${breakGraphicsLabel(graphics)}, from the next release`

/** Whether this step's events press q (either case) or Esc. */
const breakQuitPressed = (events: TermEvent[]): boolean => {
  for (const e of events) {
    if (e.type === EVENT_KEY && e.action === ACTION_PRESS) {
      if (e.key === KEY_ESCAPE || (e.key === KEY_CHAR && (e.code === 113 || e.code === 81))) {
        return true
      }
    }
  }
  return false
}

/**
 * Record that the host has just opened the terminal with the settings as they
 * are now, so neither the frame rate nor the graphics reads as changed.
 *
 * @param d The director.
 */
export const breakTerminalOpened = (d: BreakDirector): void => {
  d.openFps = d.settings.fps
  d.openGraphics = d.settings.graphics
}

/** Whether `e` is a press of one of the director's keys, F3 to F9. */
const directorHotkey = (e: TermEvent): boolean => e.type === EVENT_KEY && e.key >= KEY_F3 && e.key <= KEY_F9

/** The settings row director key `key` steps: F4 to F8 are the first five in order, F3 stats, F9 sound. */
const directorKeyRow = (key: i32): i32 => {
  if (key === KEY_F3) {
    return DIRECTOR_ROW_STATS
  }
  return key === KEY_F9 ? DIRECTOR_ROW_SOUND : key - KEY_F4
}

/** Auto resolution from the top again, as when it is chosen afresh. */
const directorResetAuto = (d: BreakDirector): void => {
  d.autoLines = DIRECTOR_AUTO_LINES
  d.slowSince = toI64(0)
  d.settleUntil = toI64(0)
}

/** What the resolution setting says in a toast. */
const directorResolutionToast = (resolution: i32): string => {
  const lines: i32 = resolutionChoice(resolution)
  return lines === 0 ? "resolution: auto" : `resolution: ${lines} lines at most`
}

/** Ask the host to keep the settings as they are now. */
const directorSave = (d: BreakDirector): void => {
  keptSettings(d)
  d.saveWanted = true
}

/**
 * Apply the director's key `key`: step its setting as Settings does, say so,
 * ask for a reopening where it needs one, and ask for the settings to be kept
 * now, since an interrupt could end the run before its end keeps them.
 */
const directorApplyKey = (d: BreakDirector, key: i32): void => {
  const s: BreakSettings = d.settings
  cycleSetting(s, directorKeyRow(key), 1)
  if (key === KEY_F3) {
    toastBreak(d, s.stats ? "stats on" : "stats off")
  } else if (key === KEY_F4) {
    d.reopen = true
  } else if (key === KEY_F5) {
    directorResetAuto(d)
    toastBreak(d, directorResolutionToast(s.resolution))
  } else if (key === KEY_F9) {
    d.keptSound = s.sound
    directorSoundChanged(d)
  } else if (key === KEY_F6) {
    d.openGraphics = s.graphics
    toastBreak(d, breakGraphicsToast(s.graphics))
  } else if (key === KEY_F7) {
    toastBreak(d, s.smoothing ? "smoothing on" : "smoothing off")
  } else if (key === KEY_F8) {
    toastBreak(d, s.effects === 0 ? "effects low" : "effects high")
  }
  directorSave(d)
}

/**
 * Take the director's keys out of `events` in place, applying each press, so
 * the scene sees only its own; a held key's repeats are taken and ignored.
 */
const directorTakeHotkeys = (d: BreakDirector, events: TermEvent[]): void => {
  let kept: i32 = 0
  for (let i: i32 = 0; i < events.length; i++) {
    const e: TermEvent = events[i]
    if (directorHotkey(e)) {
      if (e.action === ACTION_PRESS) {
        directorApplyKey(d, e.key)
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

/** Start a game at `level`, the menu's answer. */
const directorStartGame = (d: BreakDirector, level: i32): void => {
  d.games = d.games + 1
  d.startLevel = level
  d.game = newBreakGame(level, d.seed + toI64(d.games))
  d.game.effects = d.settings.effects
  d.scene = SCENE_GAME
}

/** Back to the title card, offering the level the last game started at, with the same settings. */
const directorBackToMenu = (d: BreakDirector): void => {
  d.menu = newBreakMenuWith(d.startLevel, d.seed + toI64(d.games), d.settings)
  d.scene = SCENE_MENU
}

/** The menu's step and what its answer asks for; `resolution` and `sound` are the settings before it. */
const directorStepMenu = (d: BreakDirector, input: StepInput, resolution: i32, sound: boolean): boolean => {
  const inSettings: boolean = d.menu.screen === SCREEN_SETTINGS
  const answer: i32 = stepBreakMenu(d.menu, input)
  if (d.settings.sound !== sound) {
    d.keptSound = d.settings.sound
  }
  if (inSettings && d.menu.screen !== SCREEN_SETTINGS) {
    directorSave(d)
  }
  if (answer === MENU_QUIT) {
    return false
  }
  if (d.settings.resolution !== resolution) {
    directorResetAuto(d)
  }
  if (d.settings.sound !== sound) {
    directorSoundChanged(d)
  }
  if (answer === MENU_APPLY) {
    // Only the rate needs the terminal opened again: the graphics setting
    // is not handed to it yet, so a change there is only said.
    if (d.settings.fps !== d.openFps) {
      d.reopen = true
      return false
    }
    if (d.settings.graphics !== d.openGraphics) {
      d.openGraphics = d.settings.graphics
      toastBreak(d, breakGraphicsToast(d.openGraphics))
    }
    return true
  }
  if (answer !== MENU_STAY) {
    directorStartGame(d, answer)
  }
  return true
}

/**
 * One step: the director's keys, then the scene's step and what its answer
 * asks for. The director's keys are taken out of `input.events`.
 *
 * @param d The director.
 * @param input The step's input.
 * @returns False to stop: the player quit, or (with `reopen`) the host is to open the terminal again.
 */
export const stepBreakDirector = (d: BreakDirector, input: StepInput): boolean => {
  d.sounds = d.quiet
  d.saveWanted = false
  d.soundChanged = false
  d.soundToastWanted = false
  directorTakeHotkeys(d, input.events)
  // What the hotkeys left, so a change the menu makes below is told apart from theirs.
  const resolution: i32 = d.settings.resolution
  const sound: boolean = d.settings.sound
  if (d.toastSteps > 0) {
    d.toastSteps = d.toastSteps - 1
  }
  if (d.reopen) {
    return false
  }
  if (d.small) {
    return !breakQuitPressed(input.events)
  }
  if (d.scene === SCENE_INTRO) {
    d.intro.effects = d.settings.effects
    const answer: i32 = stepBreakIntro(d.intro, input)
    d.sounds = d.intro.sounds
    if (answer === INTRO_QUIT) {
      return false
    }
    if (answer === INTRO_DONE) {
      d.scene = SCENE_MENU
    }
    return true
  }
  if (d.scene === SCENE_MENU) {
    return directorStepMenu(d, input, resolution, sound)
  }
  d.game.effects = d.settings.effects
  const answer: i32 = stepBreakGame(d.game, input)
  d.sounds = d.game.sounds
  if (answer !== GAME_PLAYING) {
    directorBackToMenu(d)
  }
  return true
}

/** The next resolution choice below `lines`, or `lines` when none is: what auto steps down to. */
const directorStepDown = (lines: i32): i32 => {
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
 * Under auto resolution, step the most lines allowed down below the frame's
 * height when the frame rate has been under 60 for 1.5 s on a fast link, then
 * wait 2 s for the host's rate to see the smaller frames.
 *
 * @param d The director.
 * @param fps The frame rate the host is holding now.
 * @param rttMs How long a frame takes to reach the screen, in milliseconds; 0 for a host with no link.
 * @param height The framebuffer's height now, in pixels.
 * @param now The host's clock, in nanoseconds; only differences are read.
 */
export const adaptBreakResolution = (d: BreakDirector, fps: i32, rttMs: f64, height: i32, now: i64): void => {
  if (resolutionChoice(d.settings.resolution) !== 0 || height <= 270 || now < d.settleUntil) {
    return
  }
  if (fps >= 60 || rttMs >= DIRECTOR_FAST_RTT_MS) {
    d.slowSince = toI64(0)
    return
  }
  if (d.slowSince === toI64(0)) {
    d.slowSince = now
    return
  }
  if (now - d.slowSince >= DIRECTOR_SLOW_NS) {
    d.autoLines = directorStepDown(Math.min(d.autoLines, height))
    d.slowSince = toI64(0)
    d.settleUntil = now + DIRECTOR_SETTLE_NS
  }
}

/**
 * Size `fb` as large a 16:9 image as `roomW × roomH` pixels hold, no taller
 * than the resolution setting, or under auto than auto resolution allows now.
 * Resizes only when the size changes, as a resize blanks the pixels.
 *
 * @param d The director.
 * @param fb The framebuffer the scenes are drawn into.
 * @param roomW The widest image the host can show, in pixels.
 * @param roomH The tallest image the host can show, in pixels.
 */
export const sizeBreakFramebuffer = (d: BreakDirector, fb: Framebuffer, roomW: i32, roomH: i32): void => {
  const chosen: i32 = resolutionChoice(d.settings.resolution)
  let h: i32 = Math.min(roomH, chosen === 0 ? d.autoLines : chosen)
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
const directorWhole = (x: f64): i32 => (x > -1000000000.0 && x < 1000000000.0 ? toI32(Math.round(x)) : 0)

/** The director's text over the scene: the stats when they are on, and the toast while it lasts. */
const directorDrawText = (d: BreakDirector, fb: Framebuffer, stats: TermStats): void => {
  const view: View = d.view
  viewFor(view, fb, 0.0, 0.0)
  const scale: i32 = Math.max(fontScaleFor(view, 6.0), 1)
  const shadow: i32 = gfxRgb(0, 0, 0)
  // The stats lines are built afresh each frame while F3 has them on; off,
  // nothing is built. They are a diagnostic, so the strings are not cached.
  if (d.settings.stats) {
    const s: BreakSettings = d.settings
    blendRect(view, 0.0, 0.0, WORLD_W, 20.0, shadow, 0.6)
    drawTextShadow(
      view,
      3.0,
      2.0,
      scale,
      `${stats.tier}fps ${directorWhole(stats.rttMs)}ms ${directorWhole(stats.bytesPerSec / 1000.0)}kB/s ${directorWhole(stats.frameCostMs)}ms drop ${stats.dropped}`,
      gfxRgb(255, 255, 255),
      shadow
    )
    const fps: i32 = fpsChoice(s.fps)
    drawTextShadow(
      view,
      3.0,
      11.0,
      scale,
      `${breakGraphicsLabel(stats.backend)} ${fb.width}x${fb.height} ${fps === 0 ? "auto" : `${fps}`}fps`,
      gfxRgb(200, 200, 200),
      shadow
    )
  }
  if (d.toastSteps > 0 && d.toast !== "") {
    blendRect(view, 0.0, WORLD_H - 14.0, WORLD_W, 14.0, shadow, 0.7)
    drawTextCentred(view, WORLD_W / 2.0, WORLD_H - 11.0, scale, d.toast, gfxRgb(255, 230, 120), shadow)
  }
}

/**
 * One frame: the scene in the framebuffer with the director's text over it.
 *
 * @param d The director.
 * @param fb The framebuffer, sized by `sizeBreakFramebuffer`.
 * @param alpha How far into the next step the frame is, 0 to 1; read only while smoothing is on.
 * @param stats What the stats lines say, when they are on.
 */
export const drawBreakDirector = (d: BreakDirector, fb: Framebuffer, alpha: f64, stats: TermStats): void => {
  const a: f64 = d.settings.smoothing ? alpha : 1.0
  if (d.scene === SCENE_INTRO) {
    drawBreakIntro(d.intro, fb, a)
  } else if (d.scene === SCENE_MENU) {
    drawBreakMenu(d.menu, fb, a)
  } else {
    drawBreakGame(d.game, fb, a)
  }
  directorDrawText(d, fb, stats)
}
