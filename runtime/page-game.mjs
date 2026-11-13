// nish/page/game: runs a game built over `nish/host/game` on a canvas with one
// call. It loads the module from its URL, draws GAME_FRAME through
// nish/page/frame's presenter at the display's rate, feeds key, pointer and
// touch input into GAME_INPUT, and plays the ids the game queues on
// GAME_SOUNDS through WebAudio. Plain ECMAScript importing only its two
// siblings, so a page serves the three files as they are.
//
// Every browser object (`fetch`, `WebAssembly`, `AudioContext`,
// `ResizeObserver`, `devicePixelRatio`, `addEventListener`) is read from
// `globalThis` when it is used, never when the module loads, so
// tests/game-page drives it under Node against fakes.

import { createPresenter, runFixedStep } from "./page-frame.mjs";
import { ringOver } from "./page.mjs";

// nish/term's constants (std/term.ts), which a game's StepInput reads.
const EVENT_KEY = 1;
const EVENT_MOUSE = 2;
const EVENT_FOCUS = 4;
const ACTION_PRESS = 1;
const ACTION_REPEAT = 2;
const ACTION_RELEASE = 3;
const ACTION_MOVE = 4;
const KEY_CHAR = 1;
const MOD_SHIFT = 1;
const MOD_ALT = 2;
const MOD_CTRL = 4;
const MOD_SUPER = 8;
const MOUSE_NONE = 0;
const MOUSE_BUTTONS = [1, 2, 3];

/** `KeyboardEvent.key` names with a `KEY_` kind of their own; any other one-character key is `KEY_CHAR`. */
const KEY_KINDS = {
  ArrowUp: 2,
  ArrowDown: 3,
  ArrowRight: 4,
  ArrowLeft: 5,
  Enter: 6,
  " ": 7,
  Escape: 8,
  Tab: 10,
  Backspace: 11,
  Home: 26,
  End: 27,
  PageUp: 28,
  PageDown: 29,
  Insert: 30,
  Delete: 31,
};
for (let f = 1; f <= 12; f++) {
  KEY_KINDS[`F${f}`] = 13 + f;
}

/** The words of one GAME_INPUT record (`GAME_EVENT_WORDS`). */
const EVENT_WORDS = 7;
/** The storage `nish/host/game` declares, which the module's `layout` must name. */
const STORAGE = ["GAME_FRAME", "GAME_INFO", "GAME_INPUT", "GAME_SOUNDS", "GAME_SAMPLES"];
/** The most sound ids `startGame` asks the game for. */
const SOUND_IDS = 64;
/** A touch held no longer than this, and moved no further, is a tap. */
const TAP_MS = 250;
const TAP_CSS_PX = 12;

/** The keys a game reads unless `keys` says otherwise. */
export const DEFAULT_KEYS = Object.freeze(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " ", "Enter", "Escape"]);

/** Touch zones unless `touch` says otherwise: each half of the canvas steers, and a tap confirms. */
export const DEFAULT_TOUCH = Object.freeze({
  zones: Object.freeze([
    Object.freeze({ x: 0, y: 0, width: 0.5, height: 1, key: "ArrowLeft" }),
    Object.freeze({ x: 0.5, y: 0, width: 0.5, height: 1, key: "ArrowRight" }),
  ]),
  tap: "Enter",
});

/** A one-character key compares without case, so Shift+A releases the A pressed. */
const keyName = (key) => (typeof key === "string" && key.length === 1 ? key.toLowerCase() : key);

/** `[kind, code point]` for a `KeyboardEvent.key`, or null for one the game cannot read. */
const keyWords = (key) => {
  const kind = KEY_KINDS[key];
  if (kind !== undefined) {
    return [kind, 0];
  }
  const cp = typeof key === "string" ? key.codePointAt(0) : undefined;
  return cp !== undefined && String.fromCodePoint(cp) === key ? [KEY_CHAR, cp] : null;
};

const modifiers = (e) =>
  (e.shiftKey ? MOD_SHIFT : 0) | (e.altKey ? MOD_ALT : 0) | (e.ctrlKey ? MOD_CTRL : 0) | (e.metaKey ? MOD_SUPER : 0);

/** A rejection naming the module's missing part. */
const missing = (what) => new TypeError(`nish/page/game: the module has no ${what}, which a game over nish/host/game exports`);

/**
 * Compiles the module at `url` in the background: `compileStreaming` as the
 * bytes arrive, or, when the server's MIME type is not `application/wasm`,
 * `compile` over the whole body.
 */
const compileFrom = async (url) => {
  let response;
  try {
    response = await globalThis.fetch(url);
  } catch (e) {
    throw new Error(`nish/page/game: could not fetch ${url}: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!response.ok) {
    throw new Error(`nish/page/game: fetching ${url} answered ${response.status} ${response.statusText || ""}`.trim());
  }
  if (typeof WebAssembly.compileStreaming === "function") {
    try {
      return await WebAssembly.compileStreaming(response.clone());
    } catch (e) {
      // A TypeError is the response refused (the MIME type); a CompileError is the bytes.
      if (!(e instanceof TypeError)) {
        throw e;
      }
    }
  }
  return WebAssembly.compile(await response.arrayBuffer());
};

/** The URL `wasmUrl` names, read against the page. */
const resolve = (wasmUrl) => {
  const base = globalThis.document?.baseURI ?? globalThis.location?.href;
  return base === undefined ? new URL(String(wasmUrl)) : new URL(String(wasmUrl), base);
};

/**
 * Loads a game built over `nish/host/game` and runs it on `canvas`.
 *
 * The module at `wasmUrl` is compiled with streaming compilation and
 * instantiated by its generated loader: `options.loader`, or the `.mjs`
 * beside the `.wasm` (`game.wasm` → `game.mjs`). It must export
 * `init(seed)`, `step(nowMs)` and `draw(alpha, frameMs)` and keep
 * `nish/host/game`'s storage; `sound(id)` and `resize(width, height)` are
 * optional. `init` runs once; `sound` runs for ids 0, 1, ... until it answers
 * 0, and each answer's samples become an `AudioBuffer`; then `step` runs
 * `stepsPerSecond` times a second and `draw` once per display frame, after
 * which `GAME_FRAME` is presented in place at `GAME_INFO`'s width and height.
 *
 * @param canvas - the canvas to draw on; a fallback may replace it, see `presenter.canvas`
 * @param wasmUrl - the module's URL, read against the page's base URL
 * @param options - the seed, the keys and touch zones the game reads, the sound, the tier, the loader
 * @returns the running game, once the module is loaded and its first frame is scheduled
 */
export const startGame = async (canvas, wasmUrl, options = {}) => {
  const url = resolve(wasmUrl);
  const keys = new Set((options.keys ?? DEFAULT_KEYS).map(keyName));
  const touch = options.touch === false ? null : (options.touch ?? DEFAULT_TOUCH);
  const stepsPerSecond = options.stepsPerSecond ?? 60;
  const soundOn = options.sound !== false;
  let muted = options.sound?.muted === true;

  const [loader, compiled] = await Promise.all([
    options.loader ?? import(url.href.replace(/\.wasm(?=$|[?#])/, ".mjs")),
    compileFrom(url.href),
  ]);
  if (typeof loader?.load !== "function") {
    throw new TypeError("nish/page/game: the loader has no load(source) export; pass the module's generated .mjs as options.loader");
  }
  const game = await loader.load(compiled, options.imports);
  for (const name of ["init", "step", "draw"]) {
    if (typeof game[name] !== "function") {
      throw missing(`export \`${name}\``);
    }
  }
  for (const name of STORAGE) {
    if (game.layout?.[name] === undefined) {
      throw missing(`storage \`${name}\``);
    }
  }
  const input = ringOver(game.memory, game.layout.GAME_INPUT);
  const queue = ringOver(game.memory, game.layout.GAME_SOUNDS);
  const storage = () => game.views().storage;

  game.init(options.seed ?? (Date.now() & 0x7fffffff));

  // The samples are copied out once, at start: GAME_SAMPLES holds one sound at a time.
  const sounds = [];
  if (soundOn && typeof game.sound === "function") {
    for (let id = 0; id < SOUND_IDS; id++) {
      const n = game.sound(id);
      if (!(n > 0)) {
        break;
      }
      const s = storage();
      sounds.push({ rate: s.GAME_INFO[3], samples: s.GAME_SAMPLES.slice(0, n) });
    }
  }

  // ---- input --------------------------------------------------------------

  let running = false;
  const held = new Map();
  const touches = new Map();
  let pendingMove = null;

  const push = (type, what, code, mods, action, x, y) => {
    if (input.free() < EVENT_WORDS) {
      return false;
    }
    for (const word of [type, what, code, mods, action, x, y]) {
      input.push(word);
    }
    return true;
  };
  const pressKey = (id, name, mods, repeat) => {
    const words = keyWords(name);
    if (words === null) {
      return;
    }
    const again = held.has(id);
    held.set(id, words);
    push(EVENT_KEY, words[0], words[1], mods, again || repeat ? ACTION_REPEAT : ACTION_PRESS, 0, 0);
  };
  const releaseKey = (id, mods) => {
    const words = held.get(id);
    if (words !== undefined) {
      held.delete(id);
      push(EVENT_KEY, words[0], words[1], mods, ACTION_RELEASE, 0, 0);
    }
  };
  const releaseAll = () => {
    for (const id of [...held.keys()]) {
      releaseKey(id, 0);
    }
    touches.clear();
  };

  /** The frame pixel under a pointer, through the presenter's letterbox. */
  const framePoint = (e) => {
    const box = presenter.canvas.getBoundingClientRect();
    const info = storage().GAME_INFO;
    const w = info[0];
    const h = info[1];
    if (!(w > 0 && h > 0 && box.width > 0 && box.height > 0)) {
      return [0, 0];
    }
    const scale = Math.min(box.width / w, box.height / h);
    const fx = Math.floor((e.clientX - box.left - (box.width - w * scale) / 2) / scale);
    const fy = Math.floor((e.clientY - box.top - (box.height - h * scale) / 2) / scale);
    return [Math.min(Math.max(fx, 0), w - 1), Math.min(Math.max(fy, 0), h - 1)];
  };
  const zoneAt = (e) => {
    const box = presenter.canvas.getBoundingClientRect();
    const u = (e.clientX - box.left) / box.width;
    const v = (e.clientY - box.top) / box.height;
    return touch.zones.find((z) => u >= z.x && u < z.x + z.width && v >= z.y && v < z.y + z.height);
  };

  // ---- sound --------------------------------------------------------------

  let audio = null;
  let buffers = [];
  const unlock = () => {
    if (audio !== null || !soundOn || sounds.length === 0) {
      return;
    }
    const Context = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (typeof Context !== "function") {
      return;
    }
    audio = new Context();
    buffers = sounds.map(({ rate, samples }) => {
      const buffer = audio.createBuffer(1, samples.length, rate);
      buffer.copyToChannel(samples, 0);
      return buffer;
    });
    audio.resume?.();
  };
  const play = (id) => {
    const buffer = buffers[id];
    if (audio === null || muted || buffer === undefined) {
      return;
    }
    const source = audio.createBufferSource();
    source.buffer = buffer;
    source.connect(audio.destination);
    source.start();
  };

  // ---- listeners ----------------------------------------------------------

  const onKeyDown = (e) => {
    const name = keyName(e.key);
    if (!running || !keys.has(name)) {
      return;
    }
    e.preventDefault();
    unlock();
    pressKey(e.code || name, name, modifiers(e), e.repeat === true);
  };
  const onKeyUp = (e) => {
    const name = keyName(e.key);
    if (!running || !(held.has(e.code || name) || keys.has(name))) {
      return;
    }
    e.preventDefault();
    releaseKey(e.code || name, modifiers(e));
  };
  const onPointerDown = (e) => {
    if (!running) {
      return;
    }
    unlock();
    presenter.canvas.focus?.({ preventScroll: true });
    if (e.pointerType === "touch") {
      if (touch === null) {
        return;
      }
      e.preventDefault();
      const zone = zoneAt(e);
      const id = `touch:${e.pointerId}`;
      touches.set(e.pointerId, { at: e.timeStamp, x: e.clientX, y: e.clientY, id });
      if (zone !== undefined) {
        pressKey(id, zone.key, 0, false);
      }
      return;
    }
    const [x, y] = framePoint(e);
    pendingMove = null;
    push(EVENT_MOUSE, MOUSE_BUTTONS[e.button] ?? MOUSE_NONE, 0, modifiers(e), ACTION_PRESS, x, y);
  };
  const onPointerUp = (e) => {
    if (!running) {
      return;
    }
    if (e.pointerType === "touch") {
      const t = touches.get(e.pointerId);
      if (t === undefined) {
        return;
      }
      touches.delete(e.pointerId);
      releaseKey(t.id, 0);
      const still = Math.hypot(e.clientX - t.x, e.clientY - t.y) <= TAP_CSS_PX;
      if (e.type === "pointerup" && touch.tap && still && e.timeStamp - t.at <= TAP_MS) {
        pressKey("tap", touch.tap, 0, false);
        releaseKey("tap", 0);
      }
      return;
    }
    const [x, y] = framePoint(e);
    push(EVENT_MOUSE, MOUSE_BUTTONS[e.button] ?? MOUSE_NONE, 0, modifiers(e), ACTION_RELEASE, x, y);
  };
  const onPointerMove = (e) => {
    if (running && e.pointerType !== "touch") {
      // Moves are coalesced: the step reads where the pointer is, not every place it passed.
      pendingMove = [...framePoint(e), modifiers(e)];
    }
  };
  const onBlur = () => {
    if (running) {
      releaseAll();
      push(EVENT_FOCUS, 0, 0, 0, 0, 0, 0);
    }
  };
  const onFocus = () => {
    if (running) {
      push(EVENT_FOCUS, 1, 0, 0, 0, 0, 0);
    }
  };
  const onVisibility = () => {
    if (globalThis.document?.visibilityState === "hidden") {
      onBlur();
    }
  };
  const onWindowResize = () => fit();

  const canvasListeners = [
    ["keydown", onKeyDown],
    ["keyup", onKeyUp],
    ["pointerdown", onPointerDown],
    ["pointerup", onPointerUp],
    ["pointercancel", onPointerUp],
    ["pointermove", onPointerMove],
    ["blur", onBlur],
    ["focus", onFocus],
  ];
  let bound = null;
  let observer = null;
  const bind = (target) => {
    if (bound !== null) {
      for (const [type, listener] of canvasListeners) {
        bound.removeEventListener(type, listener);
      }
      observer?.disconnect();
    }
    bound = target;
    if (target === null) {
      return;
    }
    for (const [type, listener] of canvasListeners) {
      target.addEventListener(type, listener);
    }
    if (!target.hasAttribute?.("tabindex")) {
      target.setAttribute?.("tabindex", "0");
    }
    if (target.style !== undefined && touch !== null) {
      target.style.touchAction = "none";
    }
    if (typeof globalThis.ResizeObserver === "function") {
      observer = new globalThis.ResizeObserver(() => fit());
      observer.observe(target);
    }
  };

  // ---- presenter and loop -------------------------------------------------

  let presenter = null;
  presenter = await createPresenter(canvas, {
    prefer: options.prefer,
    onFallback: (from, to, reason, fresh) => {
      // A fallback hands over a fresh canvas: the listeners move to it.
      if (bound !== null && fresh !== bound) {
        bind(fresh);
        fit();
        fresh.focus?.({ preventScroll: true });
      }
      options.onFallback?.(from, to, reason, fresh);
    },
  });

  const fit = () => {
    const box = presenter.canvas.getBoundingClientRect();
    presenter.resize(box.width, box.height, globalThis.devicePixelRatio || 1);
    if (typeof game.resize === "function") {
      game.resize(Math.round(box.width), Math.round(box.height));
    }
  };

  running = true;
  bind(presenter.canvas);
  globalThis.document?.addEventListener?.("visibilitychange", onVisibility);
  globalThis.addEventListener?.("resize", onWindowResize);
  fit();
  presenter.canvas.focus?.({ preventScroll: true });

  let steps = 0;
  const loop = runFixedStep({
    stepsPerSecond,
    maxStepsPerFrame: options.maxStepsPerFrame,
    step: () => {
      if (pendingMove !== null) {
        const [x, y, mods] = pendingMove;
        pendingMove = null;
        push(EVENT_MOUSE, MOUSE_NONE, 0, mods, ACTION_MOVE, x, y);
      }
      game.step((steps * 1000) / stepsPerSecond);
      steps++;
      while (queue.size() > 0) {
        play(queue.shift());
      }
    },
    render: (alpha, frameMs) => {
      game.draw(alpha, frameMs);
      // views() after the call: a memory that grew has a new buffer.
      const s = storage();
      const w = s.GAME_INFO[0];
      const h = s.GAME_INFO[1];
      if (w > 0 && h > 0) {
        presenter.present(s.GAME_FRAME, w, h);
      }
    },
  });

  return {
    presenter,
    module: game,
    get fps() {
      return loop.fps;
    },
    get refreshHz() {
      return loop.refreshHz;
    },
    get muted() {
      return muted;
    },
    set muted(value) {
      muted = value === true;
    },
    stop() {
      if (!running) {
        return;
      }
      running = false;
      loop.stop();
      bind(null);
      observer?.disconnect();
      globalThis.document?.removeEventListener?.("visibilitychange", onVisibility);
      globalThis.removeEventListener?.("resize", onWindowResize);
      held.clear();
      touches.clear();
      audio?.close?.();
      audio = null;
      presenter.destroy();
    },
  };
};
