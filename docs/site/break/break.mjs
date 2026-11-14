// The page side of the game behind the docs hero terminal: its shell (shell.mjs)
// imports this module (as /break/break.mjs) only when the terminal is asked
// for it, so none of it, nor the .wasm, costs a page that never asks.
//
// `open` covers the viewport with a canvas, a menu button and a close control and runs
// game.wasm in it through nish/page/game's `startGame`. The game itself, its
// rules, scenes and settings menu, is the terminal game's code compiled to
// wasm (game.ts); this file only carries what a page has and a terminal does
// not: the overlay, localStorage, focus, and a phone's touch.
//
// The module and the page share one word array, BREAK_LINK (see game.ts):
//
//   [0]     QUIT    the module sets it when the game asks to end (Quit on the title)
//   [1]     SAVES   the module counts each time the player changes a setting
//   [2..8]  the settings, in BreakSettings' field order: fps, resolution,
//           graphics, effects, smoothing, stats, sound
//   [9]     LOADED  the page sets it, with [2..8], before init, when it has saved settings
//   [10,11] AIM     the frame pixel a finger holds, its column plus 1 (0: no finger)
//   [12]    TAPS    the page counts each tap, at the frame pixel [13], [14]
//   [15]    MENU    the page counts each press of the menu button: Escape to the game
//   [16]    TOUCH   1 while the screen is touched, not pointed at
//
// Touch is this file's, not nish/page/game's: the game steers its paddle
// toward a held finger and acts on the menu line a tap lands on, so the
// page's half-screen arrow zones would only fight the drag. Frame pixels are
// the frame as shown, which game.ts turns a quarter on a touched portrait
// screen; it turns them back.
//
// The page writes the saved settings before `init` and reads the link after
// each `step`, by handing startGame a loader that wraps the generated one.
// build.mjs points this at nish/page-game.mjs beside the built copy.
import { startGame } from "./nish/page-game.mjs"

/** The localStorage key the settings live under. */
export const STORE = "nish-break-settings"
const QUIT = 0
const SAVES = 1
const SETTINGS = 2
const FIELDS = 7
const LOADED = 9
const AIM = 10
const AIM_Y = 11
const TAPS = 12
const TAP_X = 13
const TAP_Y = 14
const MENU = 15
const TOUCH = 16

/** A touch that ends within this many milliseconds and CSS pixels of where it began is a tap: nish/page/game's. */
const TAP_MS = 250
const TAP_CSS_PX = 12

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
 * The frame pixel under the client point `x`, `y` of a canvas whose box is
 * `box` and that shows a `w` by `h` frame letterboxed in it, as
 * nish/page/game's presenter does; null before there is a frame to point at.
 */
export const framePixel = (x, y, box, w, h) => {
  if (!(w > 0 && h > 0 && box.width > 0 && box.height > 0)) {
    return null
  }
  const scale = Math.min(box.width / w, box.height / h)
  const fx = Math.floor((x - box.left - (box.width - w * scale) / 2) / scale)
  const fy = Math.floor((y - box.top - (box.height - h * scale) / 2) / scale)
  return [Math.min(Math.max(fx, 0), w - 1), Math.min(Math.max(fy, 0), h - 1)]
}

/**
 * Whether the page is pointed at by a coarse pointer, a finger, rather than
 * a mouse; false where it cannot ask.
 */
const coarse = () => {
  try {
    return globalThis.matchMedia?.("(pointer: coarse)")?.matches === true
  } catch {
    return false
  }
}

/**
 * Touch on `overlay` for the game, as BREAK_LINK words: a finger held steers
 * (AIM), a short still touch taps (TAPS), and any touch tells the game the
 * screen is touched (TOUCH). `storage` is the module's storage views, or null
 * before it loads; the overlay's buttons keep their own touches.
 */
export const listenTouch = (overlay, storage, signal) => {
  const touches = new Map()
  let aim = null
  /** The canvas asked for now: a renderer may have put another in its place. */
  const at = (e) => {
    const s = storage()
    const screen = overlay.querySelector("canvas")
    if (s === null || screen === null) {
      return null
    }
    const p = framePixel(e.clientX, e.clientY, screen.getBoundingClientRect(), s.GAME_INFO[0], s.GAME_INFO[1])
    return p === null ? null : [s.BREAK_LINK, p]
  }
  const steer = (e) => {
    const point = at(e)
    if (point !== null) {
      point[0][AIM] = point[1][0] + 1
      point[0][AIM_Y] = point[1][1]
    }
  }
  const down = (e) => {
    const s = storage()
    if (s !== null) {
      s.BREAK_LINK[TOUCH] = e.pointerType === "touch" ? 1 : 0
    }
    if (e.pointerType !== "touch" || e.target?.tagName === "BUTTON") {
      return
    }
    e.preventDefault()
    touches.set(e.pointerId, { at: e.timeStamp, x: e.clientX, y: e.clientY })
    if (aim === null) {
      aim = e.pointerId
      steer(e)
    }
  }
  const move = (e) => {
    if (e.pointerId === aim) {
      steer(e)
    }
  }
  const up = (e) => {
    const t = touches.get(e.pointerId)
    if (t === undefined) {
      return
    }
    touches.delete(e.pointerId)
    if (e.pointerId === aim) {
      aim = null
      const s = storage()
      if (s !== null) {
        s.BREAK_LINK[AIM] = 0
      }
    }
    const still = Math.hypot(e.clientX - t.x, e.clientY - t.y) <= TAP_CSS_PX
    const point = e.type === "pointerup" && still && e.timeStamp - t.at <= TAP_MS ? at(e) : null
    if (point !== null) {
      const [words, [x, y]] = point
      words[TAP_X] = x
      words[TAP_Y] = y
      words[TAPS] += 1
    }
  }
  overlay.addEventListener("pointerdown", down, { signal })
  overlay.addEventListener("pointermove", move, { signal })
  overlay.addEventListener("pointerup", up, { signal })
  overlay.addEventListener("pointercancel", up, { signal })
}

/**
 * `loader` (a generated .mjs) with its `load` wrapped: the module it loads
 * starts with `saved` settings when there are some, and after each step
 * reports a settings change to `onSave` and a quit to `onQuit`. A `help`
 * string replaces the compiler's --help the intro breaks apart (game.ts's
 * BREAK_HELP_IN); the page passes none, and an empty one keeps the compiler's.
 * `onLoad` is handed the loaded module's storage views, as a function to call
 * on each use, before its `init`.
 */
export const linkLoader = (loader, saved, onSave, onQuit, help = null, onLoad = null) => ({
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
      if (words === undefined) {
        throw new TypeError("the game module has no BREAK_HELP_IN storage")
      }
      // UTF-8, one byte a word: a Nish string is its bytes.
      const bytes = new TextEncoder().encode(help)
      if (bytes.length >= words.length) {
        throw new RangeError(`a help of ${bytes.length} bytes does not fit BREAK_HELP_IN`)
      }
      words[0] = bytes.length
      words.set(bytes, 1)
    }
    link()[TOUCH] = coarse() ? 1 : 0
    onLoad?.(() => game.views().storage)
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
background:#fff2;color:#fff;font:1.25rem/1 system-ui,sans-serif;cursor:pointer;touch-action:manipulation}
.nish-break button:focus-visible{outline:2px solid #fff}
.nish-break .nish-break__menu{right:3.25rem;font-size:.875rem;opacity:0;pointer-events:none}
.nish-break .nish-break__menu:focus-visible{opacity:1;pointer-events:auto}
@media (pointer:coarse){.nish-break .nish-break__menu{opacity:1;pointer-events:auto}}
@media (pointer:coarse){.nish-break button{width:2.75rem;height:2.75rem}.nish-break .nish-break__menu{right:3.75rem}}
`

let current = null

/**
 * Opens the game over the page. Resolves once it runs; rejects, with the page
 * as it was, when it cannot start. While it runs, Quit on its title, the
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
  // The pause menu for a phone, which has no Escape key: shown to a coarse
  // pointer, and to the keyboard when Tab reaches it.
  const menu = document.createElement("button")
  menu.setAttribute("type", "button")
  menu.setAttribute("aria-label", "Game menu")
  menu.className = "nish-break__menu"
  menu.textContent = "❚❚"
  const close = document.createElement("button")
  close.setAttribute("type", "button")
  close.setAttribute("aria-label", "Close the game")
  close.textContent = "×"
  overlay.append(style, canvas, menu, close)
  document.body.append(overlay)
  // Focus into the overlay at once, to the close control until the game runs:
  // keys while it loads reach the overlay (Escape closes), not the page beneath.
  close.focus({ preventScroll: true })

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
  // The module's storage views once it loads (linkLoader's onLoad), null before.
  let moduleViews = () => null
  // The menu button is Escape to the game: it pauses a game and backs out of
  // a menu. A press keeps the keys on the game's screen.
  menu.addEventListener("mousedown", (event) => event.preventDefault())
  menu.addEventListener("click", () => {
    const s = moduleViews()
    if (s !== null) {
      s.BREAK_LINK[MENU] += 1
    }
    ;(overlay.querySelector("canvas") ?? canvas).focus({ preventScroll: true })
  })
  // Modal: Tab moves between the canvas, the menu button and the close control
  // only, Escape off the canvas closes, and a wheel or a drag over the overlay
  // cannot scroll the page beneath it.
  const signal = controller.signal
  listenTouch(overlay, () => moduleViews(), signal)
  overlay.addEventListener(
    "keydown",
    (event) => {
      // The canvas asked for now: a renderer may have put another in its place.
      const screen = overlay.querySelector("canvas") ?? canvas
      if (event.key === "Tab") {
        event.preventDefault()
        const ring = [screen, menu, close]
        const i = ring.indexOf(event.target)
        const next = ring[(Math.max(i, 0) + (event.shiftKey === true ? ring.length - 1 : 1)) % ring.length]
        next.focus()
      } else if (event.key === "Escape" && event.target !== screen) {
        // The game reads Escape on its own screen; anywhere else it closes.
        event.preventDefault()
        shut()
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
        // Touch is listenTouch's: no arrow zones, no tap as Enter.
        touch: false,
        signal: controller.signal,
        loader: linkLoader(
          loader ?? (await import(new URL("game.mjs", wasm).toString())),
          readSettings(storage),
          (words) => writeSettings(storage, words),
          shut,
          null,
          (views) => {
            moduleViews = views
          }
        ),
        onError: (error) => {
          say?.(`nish break: ${error?.message ?? error}`)
          shut()
        },
      })
      // Running: the game's screen takes the keys (startGame focuses it too).
      const screen = overlay.querySelector("canvas") ?? canvas
      if (current === me) {
        screen.focus({ preventScroll: true })
      }
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
