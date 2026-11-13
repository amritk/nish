// The page side of the game behind the docs hero terminal: its shell (shell.mjs)
// imports this module (as /break/break.mjs) only when the terminal is asked
// for it, so none of it, nor the .wasm, costs a page that never asks.
//
// `open` covers the viewport with a canvas and a close control and runs
// game.wasm in it through nish/page/game's `startGame`. The game itself, its
// rules, scenes and settings menu, is the terminal game's code compiled to
// wasm (game.ts); this file only carries what a page has and a terminal does
// not: the overlay, localStorage, and focus.
//
// The module and the page share one word array, BREAK_LINK (see game.ts):
//
//   [0]     QUIT    the module sets it when the game asks to end (Escape on the title)
//   [1]     SAVES   the module counts each time the player changes a setting
//   [2..8]  the settings, in BreakSettings' field order: fps, resolution,
//           graphics, effects, smoothing, stats, sound
//   [9]     LOADED  the page sets it, with [2..8], before init, when it has saved settings
//
// The page writes the saved settings before `init` and reads the link after
// each `step`, by handing startGame a loader that wraps the generated one.
// build.mjs points this at nish/page-game.mjs beside the built copy.
import { startGame } from "../../runtime/page-game.mjs"

/** The localStorage key the settings live under. */
export const STORE = "nish-break-settings"
const QUIT = 0
const SAVES = 1
const SETTINGS = 2
const FIELDS = 7
const LOADED = 9

/** The game's fixed step: src/break-director.ts's STEPS_PER_SECOND. */
const STEPS_PER_SECOND = 120

/** Every key the game reads: the arrows, the letters its menus and Q accept, and F3 to F9. */
const KEYS = [
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  " ",
  "Enter",
  "Escape",
  "q",
  "w",
  "a",
  "s",
  "d",
  "h",
  "j",
  "k",
  "l",
  "F3",
  "F4",
  "F5",
  "F6",
  "F7",
  "F8",
  "F9",
]

/**
 * Each setting's least and greatest value, in BreakSettings' field order, as
 * src/break-menu.ts's applySettingLine accepts them: fps and resolution index
 * its FPS_CHOICE_COUNT (5) and RESOLUTION_CHOICE_COUNT (6) choices, graphics
 * is -1 (automatic) to 3, and effects, smoothing, stats and sound are 0 or 1.
 */
const RANGES = [
  [0, 4],
  [0, 5],
  [-1, 3],
  [0, 1],
  [0, 1],
  [0, 1],
  [0, 1],
]

/**
 * The settings kept under STORE: seven whole numbers each in its RANGES, or
 * null when there are none or they are not that. Another page on this origin
 * can write the key, so nothing out of range reaches the game.
 */
export const readSettings = (storage) => {
  let words
  try {
    words = JSON.parse(storage?.getItem(STORE) ?? "null")
  } catch {
    return null
  }
  const fits = (w, i) => Number.isInteger(w) && w >= RANGES[i][0] && w <= RANGES[i][1]
  return Array.isArray(words) && words.length === FIELDS && words.every(fits) ? words : null
}

/** The page's localStorage, or null where reading it throws (storage blocked, an opaque origin). */
const pageStorage = () => {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

/** Keeps `words` under STORE; a storage that refuses (private mode, a full quota) keeps nothing. */
export const writeSettings = (storage, words) => {
  try {
    storage?.setItem(STORE, JSON.stringify(words))
  } catch {
    // Settings are a convenience: the game runs on without them.
  }
}

/**
 * `loader` (a generated .mjs) with its `load` wrapped: the module it loads
 * starts with `saved` settings when there are some, and after each step
 * reports a settings change to `onSave` and a quit to `onQuit`. A `help`
 * string replaces the compiler's --help the intro breaks apart (game.ts's
 * BREAK_HELP_IN); the page passes none.
 */
export const linkLoader = (loader, saved, onSave, onQuit, help = null) => ({
  load: async (source, imports) => {
    const game = await loader.load(source, imports)
    if (game.layout?.BREAK_LINK === undefined) {
      throw new TypeError("the game module has no BREAK_LINK storage")
    }
    // views() on each use: a memory that grew has a new buffer.
    const link = () => game.views().storage.BREAK_LINK
    if (saved !== null) {
      link().set(saved, SETTINGS)
      link()[LOADED] = 1
    }
    if (help !== null) {
      const words = game.views().storage.BREAK_HELP_IN
      if (help.length >= words.length) {
        throw new RangeError(`a help of ${help.length} units does not fit BREAK_HELP_IN`)
      }
      words[0] = help.length
      for (let i = 0; i < help.length; i++) {
        words[i + 1] = help.charCodeAt(i)
      }
    }
    let saves = 0
    let quit = false
    const linked = Object.create(game)
    linked.step = (nowMs) => {
      game.step(nowMs)
      const words = link()
      if (words[SAVES] !== saves) {
        saves = words[SAVES]
        onSave(Array.from(words.subarray(SETTINGS, SETTINGS + FIELDS)))
      }
      if (words[QUIT] !== 0 && !quit) {
        quit = true
        onQuit()
      }
    }
    return linked
  },
})

const css = `
.nish-break{position:fixed;inset:0;z-index:2147483000;background:#000;overscroll-behavior:contain;touch-action:none}
.nish-break canvas{display:block;width:100%;height:100%;outline:none;touch-action:none}
.nish-break button{position:absolute;top:.5rem;right:.5rem;width:2.25rem;height:2.25rem;border:0;border-radius:50%;
background:#fff2;color:#fff;font:1.25rem/1 system-ui,sans-serif;cursor:pointer}
.nish-break button:focus-visible{outline:2px solid #fff}
`

let current = null

/**
 * Opens the game over the page. Resolves once it runs; rejects, with the page
 * as it was, when it cannot start. While it runs, Escape on its title, the
 * close control or an error closes it and hands focus back to `focus`; an
 * error is told to `say` in one line first.
 *
 * @param options.focus - the element focus returns to on close
 * @param options.say - shows one line of text where the game was asked for
 * @param options.document - the document to cover (the page's)
 * @param options.storage - where settings are kept (localStorage)
 * @param options.wasm - the game module's URL (game.wasm beside this file)
 * @param options.loader - the module's generated loader (game.mjs beside this file)
 * @param options.start - what runs it (nish/page/game's startGame); a test hands in its own
 */
export const open = ({
  focus,
  say,
  document = globalThis.document,
  storage = pageStorage(),
  wasm = new URL("game.wasm", import.meta.url),
  loader,
  start = startGame,
} = {}) => {
  if (current !== null) {
    return current.started
  }
  const controller = new AbortController()
  const overlay = document.createElement("div")
  overlay.className = "nish-break"
  overlay.setAttribute("role", "dialog")
  overlay.setAttribute("aria-modal", "true")
  overlay.setAttribute("aria-label", "Game")
  const style = document.createElement("style")
  style.textContent = css
  const canvas = document.createElement("canvas")
  canvas.setAttribute("aria-label", "Game screen")
  const close = document.createElement("button")
  close.setAttribute("type", "button")
  close.setAttribute("aria-label", "Close the game")
  close.textContent = "×"
  overlay.append(style, canvas, close)
  document.body.append(overlay)

  const me = { started: null }
  current = me
  const shut = () => {
    if (current !== me) {
      return
    }
    current = null
    controller.abort()
    overlay.remove()
    focus?.focus?.()
  }
  close.addEventListener("click", shut)
  // Modal: Tab moves between the canvas and the close control only, and a
  // wheel or a drag over the overlay cannot scroll the page beneath it.
  const signal = controller.signal
  overlay.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Tab") {
        event.preventDefault()
        const next = event.target === close ? canvas : close
        next.focus()
      }
    },
    { signal }
  )
  for (const type of ["wheel", "touchmove"]) {
    overlay.addEventListener(type, (event) => event.preventDefault(), { passive: false, signal })
  }
  me.started = (async () => {
    try {
      await start(canvas, wasm.toString(), {
        stepsPerSecond: STEPS_PER_SECOND,
        keys: KEYS,
        signal: controller.signal,
        loader: linkLoader(
          loader ?? (await import(new URL("game.mjs", wasm).toString())),
          readSettings(storage),
          (words) => writeSettings(storage, words),
          shut
        ),
        onError: (error) => {
          say?.(`nish break: ${error?.message ?? error}`)
          shut()
        },
      })
    } catch (error) {
      // Closed before it started: nothing went wrong.
      if (controller.signal.aborted) {
        return
      }
      shut()
      throw error
    }
  })()
  return me.started
}
