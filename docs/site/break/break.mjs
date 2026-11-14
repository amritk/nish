// The page side of the game behind the docs hero terminal: its shell (shell.mjs)
// imports this module (as /break/break.mjs) only when the terminal is asked
// for it, so none of it, nor the .wasm, costs a page that never asks.
//
// `open` covers the viewport with a canvas and one menu button and runs
// game.wasm in it through nish/page/game's `startGame`. The game itself, its
// rules, scenes and settings menu, is the terminal game's code compiled to
// wasm (game.ts); this file only carries what a page has and a terminal does
// not: the overlay and its menu, localStorage, focus, and a pointer's taps.
//
// The canvas is sized to the frame's own shape and kept inside the screen's
// safe area, with a bar beside it for the menu button, so all four edges of
// the frame show on a phone and the button covers none of it.
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
//   [15]    MENU    game.ts takes a count here as Escape; the page writes none
//   [16]    TOUCH   1 while the screen is touched, not pointed at
//
// Touch is this file's, not nish/page/game's: the game steers its paddle
// toward a held finger and acts on the menu line a tap lands on, so the
// page's half-screen arrow zones would only fight the drag. A mouse click
// taps as a finger does, so the game's menus take a mouse too; only a finger
// steers. Frame pixels are the frame as shown, which game.ts turns a quarter
// on a touched portrait screen; it turns them back.
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
const TOUCH = 16

/** A touch that ends within this many milliseconds and CSS pixels of where it began is a tap: nish/page/game's. */
const TAP_MS = 250
const TAP_CSS_PX = 12

/**
 * The frame's shape, wide over high: src/break-director.ts's
 * sizeBreakFramebuffer keeps it 16:9, and game.ts turns it to 9:16 when a
 * touched canvas is portrait.
 */
const FRAME_ASPECT = 16 / 9

/** The CSS pixels the menu bar takes above or beside the frame: a finger's target. */
const BAR_CSS_PX = 44

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
 * Where the canvas goes in a `width` by `height` stage: the largest box of
 * the frame's shape (turned, 9:16) that leaves a BAR_CSS_PX bar for the menu
 * button above it or to its right, whichever leaves the frame larger, centred
 * in what is left. The button sits in the stage's top right corner, inside
 * either bar, so it never covers the frame.
 */
export const frameBox = (width, height, turned) => {
  const aspect = turned ? 1 / FRAME_ASPECT : FRAME_ASPECT
  const fit = (w, h) => {
    const high = Math.max(0, Math.min(w / aspect, h))
    return [high * aspect, high]
  }
  const [aw, ah] = fit(width, height - BAR_CSS_PX)
  const [bw, bh] = fit(width - BAR_CSS_PX, height)
  if (aw * ah >= bw * bh) {
    return { left: (width - aw) / 2, top: BAR_CSS_PX + (height - BAR_CSS_PX - ah) / 2, width: aw, height: ah }
  }
  return { left: (width - BAR_CSS_PX - bw) / 2, top: (height - bh) / 2, width: bw, height: bh }
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
 * A pointer on `overlay` for the game, as BREAK_LINK words: a finger held
 * steers (AIM), a short still touch or mouse click taps (TAPS), and each press
 * tells the game whether the screen is touched (TOUCH). `storage` is the
 * module's storage views, or null before it loads. Presses on the overlay's
 * buttons are theirs, and none count while `paused()` is true (its menu is
 * open). `onPress` hears whether each press was a finger, before the game does.
 */
export const listenTouch = (overlay, storage, signal, { paused = () => false, onPress = null } = {}) => {
  const presses = new Map()
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
    if (e.target?.tagName === "BUTTON" || paused()) {
      return
    }
    const finger = e.pointerType === "touch"
    onPress?.(finger)
    const s = storage()
    if (s !== null) {
      s.BREAK_LINK[TOUCH] = finger ? 1 : 0
    }
    // A mouse taps with its main button only; it keeps its default, which focuses the screen.
    if (!finger && e.button !== 0) {
      return
    }
    if (finger) {
      e.preventDefault()
    }
    presses.set(e.pointerId, { at: e.timeStamp, x: e.clientX, y: e.clientY })
    if (finger && aim === null) {
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
    const t = presses.get(e.pointerId)
    if (t === undefined) {
      return
    }
    presses.delete(e.pointerId)
    if (e.pointerId === aim) {
      aim = null
      const s = storage()
      if (s !== null) {
        s.BREAK_LINK[AIM] = 0
      }
    }
    const still = Math.hypot(e.clientX - t.x, e.clientY - t.y) <= TAP_CSS_PX
    const tap = e.type === "pointerup" && still && e.timeStamp - t.at <= TAP_MS && !paused()
    const point = tap ? at(e) : null
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
 * on each use, before its `init`. While `paused()` is true no step runs and
 * each frame redraws the last one, so the game holds still under the menu.
 */
export const linkLoader = (
  loader,
  saved,
  onSave,
  onQuit,
  help = null,
  onLoad = null,
  paused = () => false
) => ({
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
    // The alpha last drawn at: a paused frame is drawn there again, with no time passing.
    let alpha = 0
    const linked = Object.create(game)
    linked.draw = (a, frameMs) => {
      if (paused()) {
        game.draw(alpha, 0)
      } else {
        alpha = a
        game.draw(a, frameMs)
      }
    }
    linked.step = (nowMs) => {
      if (paused()) {
        return
      }
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

// The stage is the screen less its safe area (a notch, rounded corners, a
// home bar) and a margin; the canvas and the menu button are placed in it,
// the canvas at frameBox's box through the --x, --y, --w and --h it sets. The
// edge is drawn in the colour of the game's walls, so the side the frame is open
// on, under the paddle, reads as its border rather than as the screen's edge.
const css = `
.nish-break{position:fixed;inset:0;z-index:2147483000;background:#000;overscroll-behavior:contain;touch-action:none;
font:600 .9375rem/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#dfe9f2}
.nish-break__stage{position:absolute;top:max(.5rem,env(safe-area-inset-top));right:max(.5rem,env(safe-area-inset-right));
bottom:max(.5rem,env(safe-area-inset-bottom));left:max(.5rem,env(safe-area-inset-left))}
.nish-break canvas{position:absolute;display:block;left:var(--x,0);top:var(--y,0);width:var(--w,100%);height:var(--h,100%);
outline:none;touch-action:none;border-radius:3px;box-shadow:0 0 0 2px #1e4d6f}
.nish-break button{border:0;margin:0;font:inherit;color:inherit;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
.nish-break button:focus-visible{outline:2px solid #fff;outline-offset:2px}
.nish-break__menu{position:absolute;top:0;right:0;width:2.25rem;height:2.25rem;display:grid;place-items:center;
border-radius:.5rem;background:#1e4d6f99;box-shadow:inset 0 0 0 1px #567993}
.nish-break__menu:hover,.nish-break__menu[aria-expanded=true]{background:#1e4d6f}
.nish-break__menu svg{width:1.125rem;height:1.125rem;fill:currentColor;pointer-events:none}
.nish-break__scrim{position:absolute;inset:0;display:grid;place-items:center;background:#000a}
.nish-break__scrim[hidden]{display:none}
.nish-break__panel{display:grid;gap:.375rem;min-width:12rem;padding:.75rem;border-radius:.5rem;background:#07101c;
box-shadow:0 0 0 2px #1e4d6f,0 .5rem 2rem #000c}
.nish-break__panel button{min-height:2.75rem;padding:0 1rem;border-radius:.375rem;background:#0f2338;text-align:left;
letter-spacing:.06em;text-transform:uppercase}
.nish-break__panel button:hover,.nish-break__panel button:focus-visible{background:#1e4d6f}
.nish-break__stage--turned .nish-break__panel,.nish-break__stage--turned .nish-break__menu svg{transform:rotate(90deg)}
`

let current = null

/**
 * Grows `overlay` out of `from`'s box, or with `back` shrinks it into it: a
 * clip from that rectangle to the whole screen, over an overlay that is full
 * size throughout, so the game lays out once. Null, and nothing moves, with no
 * box to grow from, no Web Animations, or a reader who asked for less motion.
 */
const grow = (overlay, from, view, back) => {
  if (
    !from?.isConnected ||
    !overlay.animate ||
    !view ||
    view.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  ) {
    return null
  }
  const box = from.getBoundingClientRect()
  const sides = [box.top, view.innerWidth - box.right, view.innerHeight - box.bottom, box.left]
  const frames = [
    { clipPath: `inset(${sides.map((side) => `${Math.max(0, side)}px`).join(" ")} round 12px)` },
    { clipPath: "inset(0 round 0)" },
  ]
  return overlay.animate(back ? frames.reverse() : frames, {
    duration: back ? 260 : 420,
    easing: "cubic-bezier(.2,.8,.2,1)",
    fill: "forwards",
  })
}

/** A button of `className` reading `text`, made in `document`. */
const button = (document, className, text) => {
  const made = document.createElement("button")
  made.setAttribute("type", "button")
  made.className = className
  made.textContent = text
  return made
}

/** The menu button's icon, three bars, drawn in the button's text colour. */
const bars = (document) => {
  const ns = "http://www.w3.org/2000/svg"
  const svg = document.createElementNS(ns, "svg")
  svg.setAttribute("viewBox", "0 0 18 18")
  svg.setAttribute("aria-hidden", "true")
  const path = document.createElementNS(ns, "path")
  path.setAttribute("d", "M2 3.5h14v2H2zM2 8h14v2H2zM2 12.5h14v2H2z")
  svg.append(path)
  return svg
}

/**
 * Opens the game over the page. Resolves once it runs; rejects, with the page
 * as it was, when it cannot start. While it runs, Quit on its title or in the
 * overlay's menu, or an error, closes it and hands focus back to `focus`; an
 * error is told to `say` in one line first.
 *
 * @param options.focus - the element focus returns to on close
 * @param options.from - the element the overlay grows out of and shrinks back into (the terminal)
 * @param options.say - shows one line of text where the game was asked for
 * @param options.document - the document to cover (the page's)
 * @param options.storage - where settings are kept (localStorage)
 * @param options.wasm - the game module's URL (game.wasm beside this file)
 * @param options.loader - the module's generated loader (game.mjs beside this file)
 * @param options.start - what runs it (nish/page/game's startGame); a test hands in its own
 */
export const open = ({
  focus,
  from,
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
  const signal = controller.signal
  const overlay = document.createElement("div")
  overlay.className = "nish-break"
  overlay.setAttribute("role", "dialog")
  overlay.setAttribute("aria-modal", "true")
  overlay.setAttribute("aria-label", "Game")
  const style = document.createElement("style")
  style.textContent = css
  const stage = document.createElement("div")
  stage.className = "nish-break__stage"
  const canvas = document.createElement("canvas")
  canvas.setAttribute("aria-label", "Game screen")
  // One button, for a mouse, a finger and the keyboard alike: it opens the
  // overlay's menu, which holds the game still and offers Resume and Quit.
  const menu = button(document, "nish-break__menu", "")
  menu.setAttribute("aria-label", "Game menu")
  menu.setAttribute("aria-haspopup", "menu")
  menu.setAttribute("aria-expanded", "false")
  menu.append(bars(document))
  const scrim = document.createElement("div")
  scrim.className = "nish-break__scrim"
  scrim.hidden = true
  const panel = document.createElement("div")
  panel.className = "nish-break__panel"
  panel.setAttribute("role", "menu")
  panel.setAttribute("aria-label", "Game menu")
  const resume = button(document, "nish-break__resume", "Resume")
  const quit = button(document, "nish-break__quit", "Quit")
  for (const item of [resume, quit]) {
    item.setAttribute("role", "menuitem")
  }
  panel.append(resume, quit)
  scrim.append(panel)
  stage.append(canvas, menu, scrim)
  overlay.append(style, stage)
  document.body.append(overlay)
  const view = document.defaultView

  // The canvas asked for now: a renderer may have put another in its place.
  const screen = () => overlay.querySelector("canvas") ?? canvas
  // Whether the last press was a finger's: a touched portrait stage gets a
  // portrait canvas, which game.ts fills with the frame turned a quarter.
  let touched = coarse()
  const place = () => {
    if (typeof stage.getBoundingClientRect !== "function") {
      return
    }
    const room = stage.getBoundingClientRect()
    const turned = touched && room.height > room.width
    const box = frameBox(room.width, room.height, turned)
    // The menu reads the way the frame does, for a phone held sideways.
    stage.className = turned ? "nish-break__stage nish-break__stage--turned" : "nish-break__stage"
    for (const [name, value] of [
      ["--x", box.left],
      ["--y", box.top],
      ["--w", box.width],
      ["--h", box.height],
    ]) {
      stage.style.setProperty(name, `${Math.round(value)}px`)
    }
  }
  place()
  view?.addEventListener?.("resize", place, { signal })
  if (typeof view?.ResizeObserver === "function") {
    const observer = new view.ResizeObserver(place)
    observer.observe(stage)
    signal.addEventListener("abort", () => observer.disconnect())
  }
  grow(overlay, from, view, false)
  // Focus into the overlay at once, to the menu button until the game runs:
  // keys while it loads reach the overlay (Escape closes), not the page beneath.
  menu.focus({ preventScroll: true })

  const me = { started: null }
  current = me
  const shut = () => {
    if (current !== me) {
      return
    }
    current = null
    controller.abort()
    focus?.focus?.()
    // Shrinking, it no longer takes the pointer: the page under it is back.
    const shrink = grow(overlay, from, view, true)
    if (shrink === null) {
      overlay.remove()
    } else {
      overlay.style.pointerEvents = "none"
      const gone = () => overlay.remove()
      shrink.finished.then(gone, gone)
    }
  }
  // The module's storage views once it loads (linkLoader's onLoad), null before.
  let moduleViews = () => null
  // While the menu is open the game holds still (linkLoader's paused) and
  // takes no pointer; closing it gives the keys back to the game's screen.
  let paused = false
  const showMenu = (shown) => {
    paused = shown
    scrim.hidden = !shown
    menu.setAttribute("aria-expanded", String(shown))
    ;(shown ? resume : screen()).focus({ preventScroll: true })
  }
  menu.addEventListener("click", () => showMenu(!paused), { signal })
  resume.addEventListener("click", () => showMenu(false), { signal })
  quit.addEventListener("click", shut, { signal })
  // A press on the dimmed game around the menu closes it, as Resume does.
  scrim.addEventListener("click", (event) => event.target === scrim && showMenu(false), { signal })
  listenTouch(overlay, () => moduleViews(), signal, {
    paused: () => paused,
    onPress: (finger) => {
      if (finger !== touched) {
        touched = finger
        place()
      }
    },
  })
  // Modal: Tab moves between the canvas and the menu button, or round the
  // menu's items while it is open; Escape closes the menu, and off the canvas
  // closes the game; a wheel or a drag over the overlay cannot scroll the
  // page beneath it.
  overlay.addEventListener(
    "keydown",
    (event) => {
      const ring = paused ? [resume, quit] : [screen(), menu]
      const i = ring.indexOf(event.target)
      const back = event.shiftKey === true || (paused && event.key === "ArrowUp")
      const moves = event.key === "Tab" || (paused && (event.key === "ArrowDown" || event.key === "ArrowUp"))
      if (moves) {
        event.preventDefault()
        ring[(Math.max(i, 0) + (back ? ring.length - 1 : 1)) % ring.length].focus()
      } else if (event.key === "Escape" && paused) {
        event.preventDefault()
        showMenu(false)
      } else if (event.key === "Escape" && event.target !== screen()) {
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
        signal,
        loader: linkLoader(
          loader ?? (await import(new URL("game.mjs", wasm).toString())),
          readSettings(storage),
          (words) => writeSettings(storage, words),
          shut,
          null,
          (views) => {
            moduleViews = views
          },
          () => paused
        ),
        onError: (error) => {
          say?.(`nish break: ${error?.message ?? error}`)
          shut()
        },
      })
      // Running: the game's screen takes the keys (startGame focuses it too),
      // or the menu does if it was opened while the game loaded.
      if (current === me) {
        ;(paused ? resume : screen()).focus({ preventScroll: true })
      }
    } catch (error) {
      // Closed before it started: nothing went wrong.
      if (signal.aborted) {
        return
      }
      shut()
      throw error
    }
  })()
  return me.started
}
