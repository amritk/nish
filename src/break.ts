// The director of `nish break`, the brick breaker hidden in the CLI: it owns
// the terminal and hands it between the title card (`break-menu.ts`) and the
// game (`break-game.ts`), which are pure and never touch it.
//
// It runs both under `runTerminal` at 120 steps a second and draws each into
// a framebuffer sized to the backend in use, the terminal's cells and the
// resolution setting. The function keys F3 to F8 change a setting from any
// scene and say so in a toast. A change the terminal must be opened again for
// (the frame rate or the graphics) closes it and opens it with the new
// options; the scene goes on where it was, and the toast says what the
// terminal made of the change, or that an environment variable won.
//
// Its text is drawn into the framebuffer with the pixel font rather than as
// screen cells, because a kitty image is drawn above the cells and would hide
// them. A screen too small to play on gets a prompt in plain cells instead,
// and an empty framebuffer, which takes the image off.

import {
  ACTION_PRESS,
  COLOR_DEFAULT,
  EVENT_KEY,
  KEY_F3,
  KEY_F4,
  KEY_F5,
  KEY_F6,
  KEY_F7,
  KEY_F8,
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
  BreakMenu,
  BreakSettings,
  FPS_CHOICE_COUNT,
  MENU_APPLY,
  MENU_QUIT,
  MENU_STAY,
  RESOLUTION_CHOICE_COUNT,
  drawBreakMenu,
  fpsChoice,
  newBreakMenuWith,
  resolutionChoice,
  stepBreakMenu,
} from "./break-menu"

/** The least screen, in cells, the scenes are drawn on; a smaller one gets a prompt. */
const WALL_MIN_COLS: i32 = 40
const WALL_MIN_ROWS: i32 = 16

/** How long a toast stays up, in steps (two seconds). */
const WALL_TOAST_STEPS: i32 = 240

/** The scene the director is showing. */
const WALL_SCENE_MENU: i32 = 0
const WALL_SCENE_GAME: i32 = 1

/** Everything the director keeps across steps, frames and reopenings of the terminal. */
class WallRun {
  menu: BreakMenu
  game: BreakGame
  /** The settings the menu edits; every menu after the first edits the same ones. */
  settings: BreakSettings
  seed: i64
  toast: string
  /** The view the director's own text is drawn through. */
  view: View
  scene: i32
  /** The level the game in play started at, which the menu after it offers again. */
  startLevel: i32
  /** Games started, which varies each game's seed. */
  games: i32
  /** The frame rate setting the terminal was last opened with, and the graphics setting last announced. */
  openFps: i32
  openGraphics: i32
  toastSteps: i32
  /** Whether `update` answered false to have the terminal opened again rather than to quit. */
  reopen: boolean
  /** Whether the first frame after a reopening still has to say what came of it. */
  reopened: boolean
  /** Whether a frame has been drawn, so an error after it is not the refusal of a pipe. */
  drawn: boolean
  /** Whether the screen is too small to play on, which holds the scene still. */
  small: boolean

  constructor(seed: i64) {
    this.settings = new BreakSettings()
    this.seed = seed
    this.scene = WALL_SCENE_MENU
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
  }
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

/** The graphics setting after `graphics` on F6: auto, then the best backend down to ascii, then auto again. */
const wallNextGraphics = (graphics: i32): i32 => {
  if (graphics < 0) {
    return GRAPHICS_KITTY
  }
  return graphics === GRAPHICS_ASCII ? -1 : graphics - 1
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

/** Whether `e` is a press of one of the director's keys, F3 to F8. */
const wallHotkey = (e: TermEvent): boolean => e.type === EVENT_KEY && e.key >= KEY_F3 && e.key <= KEY_F8

/** Apply the director's key `key`: change its setting, say so, and ask for a reopening where it needs one. */
const wallApplyKey = (run: WallRun, key: i32): void => {
  const s: BreakSettings = run.settings
  if (key === KEY_F3) {
    s.stats = !s.stats
    wallToast(run, s.stats ? "stats on" : "stats off")
  } else if (key === KEY_F4) {
    s.fps = (s.fps + 1) % FPS_CHOICE_COUNT
    run.reopen = true
  } else if (key === KEY_F5) {
    s.resolution = (s.resolution + 1) % RESOLUTION_CHOICE_COUNT
    wallToast(run, `resolution: ${resolutionChoice(s.resolution)} lines at most`)
  } else if (key === KEY_F6) {
    s.graphics = wallNextGraphics(s.graphics)
    run.openGraphics = s.graphics
    wallToast(run, wallGraphicsToast(s.graphics))
  } else if (key === KEY_F7) {
    s.smoothing = !s.smoothing
    wallToast(run, s.smoothing ? "smoothing on" : "smoothing off")
  } else if (key === KEY_F8) {
    s.effects = s.effects === 0 ? 1 : 0
    wallToast(run, s.effects === 0 ? "effects low" : "effects high")
  }
}

/**
 * Take the director's keys out of `events` in place, applying each press, so
 * the scene sees only its own; a held key's repeats are taken and ignored.
 */
const wallTakeHotkeys = (run: WallRun, events: TermEvent[]): void => {
  let kept: i32 = 0
  const n: i32 = toI32(events.length)
  for (let i: i32 = 0; i < n; i++) {
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
  if (run.toastSteps > 0) {
    run.toastSteps = run.toastSteps - 1
  }
  if (run.reopen) {
    return false
  }
  if (run.small) {
    return true
  }
  if (run.scene === WALL_SCENE_MENU) {
    const answer: i32 = stepBreakMenu(run.menu, input)
    if (answer === MENU_QUIT) {
      return false
    }
    if (answer === MENU_APPLY) {
      run.reopen = true
      return false
    }
    if (answer !== MENU_STAY) {
      wallStartGame(run, answer)
    }
    return true
  }
  run.game.effects = run.settings.effects
  if (stepBreakGame(run.game, input) !== GAME_PLAYING) {
    wallBackToMenu(run)
  }
  return true
}

/** The cell size in pixels a probed size stands for, `fallback` when the probe did not learn it. */
const wallCellPx = (px: i32, fallback: i32): i32 => (px > 0 && px <= 256 ? px : fallback)

/**
 * Size `fb` for a screen of `cols × rows` cells drawn with `backend`: as large
 * a 16:9 image as the cells hold, no taller than the resolution setting.
 * Resizes only when the size changes, as a resize blanks the pixels.
 */
const wallSizeFramebuffer = (run: WallRun, frame: Frame, fb: Framebuffer): void => {
  const cols: i32 = frame.screen.width
  const rows: i32 = frame.screen.height
  const backend: i32 = frame.stats.backend
  const pixels: boolean = backend === GRAPHICS_KITTY || backend === GRAPHICS_SIXEL
  const roomW: i32 = pixels ? cols * wallCellPx(frame.caps.cellWidthPx, 8) : cols
  const roomH: i32 = pixels ? rows * wallCellPx(frame.caps.cellHeightPx, 16) : rows * 2
  let h: i32 = Math.min(roomH, resolutionChoice(run.settings.resolution))
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
    let rate: string = fps === 0 ? "fps: auto, up to 120" : `${fps} fps fixed`
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
  wallSizeFramebuffer(run, frame, fb)
  const alpha: f64 = run.settings.smoothing ? frame.alpha : 1.0
  if (run.scene === WALL_SCENE_MENU) {
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
 * setting needs it. Answers the exit code: 1, with a sentence on stderr, when
 * the terminal cannot be opened (a pipe, say) before anything was drawn.
 */
export const playBreak = (): i32 => {
  const run: WallRun = new WallRun(monotonicNanos())
  run.reopen = true
  while (run.reopen) {
    run.reopen = false
    const played: Result<i32, string> = runTerminal(wallOptions(run.settings), run, wallUpdate, wallRender)
    if (!played.isOk()) {
      if (run.drawn) {
        return 0
      }
      console.error("the wall is only visible in a terminal.")
      return 1
    }
    run.reopened = run.reopen
  }
  return 0
}
