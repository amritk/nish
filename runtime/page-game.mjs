// nish/page/game: runs a game built over `nish/host/game` on a canvas with one
// call. It loads the module from its URL, draws GAME_FRAME through
// nish/page/frame's presenter at the display's rate, feeds key, pointer and
// touch input into GAME_INPUT, and plays the ids the game queues on
// GAME_SOUNDS through WebAudio. Plain ECMAScript importing only its two
// siblings, so a page serves the three files as they are.
//
// Every browser object (`fetch`, `WebAssembly`, `AudioContext`,
// `ResizeObserver`, `matchMedia`, `devicePixelRatio`, `addEventListener`) is read from
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

/** The error an aborted start rejects with: the signal's reason, or an AbortError. */
const aborted = (signal) =>
  signal.reason ??
  (typeof globalThis.DOMException === "function"
    ? new globalThis.DOMException("nish/page/game: the start was aborted", "AbortError")
    : new Error("nish/page/game: the start was aborted"));

/** Throws a TypeError naming `what` unless `ok`. */
const expect = (ok, what) => {
  if (!ok) {
    throw new TypeError(`nish/page/game: ${what}`);
  }
};

/** Checks every option before `startGame` does anything, so a bad one costs nothing to undo. */
const validate = (url, options) => {
  expect(options !== null && typeof options === "object", "options is an object");
  const { keys, touch, stepsPerSecond, maxStepsPerFrame } = options;
  expect(keys === undefined || (Array.isArray(keys) && keys.every((k) => typeof k === "string")), "keys is an array of KeyboardEvent.key names");
  if (touch !== undefined && touch !== false) {
    expect(touch !== null && typeof touch === "object" && Array.isArray(touch.zones), "touch is false or { zones, tap }");
    for (const z of touch.zones) {
      expect(
        [z?.x, z?.y, z?.width, z?.height].every(Number.isFinite) && typeof z.key === "string",
        "each touch zone is { x, y, width, height, key }"
      );
    }
    expect(touch.tap === undefined || touch.tap === null || typeof touch.tap === "string", "touch.tap is a key name");
  }
  expect(
    stepsPerSecond === undefined || (Number.isFinite(stepsPerSecond) && stepsPerSecond > 0),
    `stepsPerSecond is a positive number, not ${stepsPerSecond}`
  );
  expect(
    maxStepsPerFrame === undefined || (Number.isInteger(maxStepsPerFrame) && maxStepsPerFrame >= 1),
    `maxStepsPerFrame is a whole number of at least 1, not ${maxStepsPerFrame}`
  );
  for (const name of ["onError", "onFallback"]) {
    expect(options[name] === undefined || typeof options[name] === "function", `${name} is a function`);
  }
  expect(
    options.signal === undefined || typeof options.signal?.addEventListener === "function",
    "signal is an AbortSignal"
  );
  expect(
    options.loader !== undefined || options.loaderUrl !== undefined || /\.wasm$/.test(url.pathname),
    `${url.href} does not end in .wasm, so its loader cannot be found beside it; pass options.loader or options.loaderUrl`
  );
};

/** A rejection naming the module's missing part. */
const missing = (what) => new TypeError(`nish/page/game: the module has no ${what}, which a game over nish/host/game exports`);

/**
 * Compiles the module at `url` in the background: `compileStreaming` as the
 * bytes arrive, or, when the server's MIME type is not `application/wasm`,
 * `compile` over the whole body.
 */
const compileFrom = async (url, signal) => {
  let response;
  try {
    response = await globalThis.fetch(url, signal === undefined ? undefined : { signal });
  } catch (e) {
    if (signal?.aborted) {
      throw aborted(signal);
    }
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
 * The module at `wasmUrl` is compiled with `WebAssembly.compileStreaming` and
 * instantiated by its generated loader: `options.loader`, the module at
 * `options.loaderUrl`, or the `.mjs` beside the `.wasm` (`game.wasm` →
 * `game.mjs`). It must export
 * `init(seed)`, `step(nowMs)` and `draw(alpha, frameMs)` and keep
 * `nish/host/game`'s storage; `sound(id)` and `resize(width, height)` are
 * optional. `init` runs once; `sound` runs for ids 0, 1, ... until it answers
 * 0, and each answer's samples become an `AudioBuffer`; then `step` runs
 * `stepsPerSecond` times a second and `draw` once per display frame, after
 * which `GAME_FRAME` is presented in place at `GAME_INFO`'s width and height.
 * A throw from the module (a panic) or from presenting its frame stops the
 * game, as `stop()` does, and reaches `options.onError`.
 *
 * @param canvas - the canvas to draw on; a fallback may replace it, see `presenter.canvas`
 * @param wasmUrl - the module's URL, read against the page's base URL
 * @param options - the seed, the keys and touch zones the game reads, the sound, the tier, the loader
 * @returns the running game, once the module is loaded and its first frame is scheduled
 */
export const startGame = async (canvas, wasmUrl, options = {}) => {
  const url = resolve(wasmUrl);
  validate(url, options);
  const keys = new Set((options.keys ?? DEFAULT_KEYS).map(keyName));
  const touch = options.touch === false ? null : (options.touch ?? DEFAULT_TOUCH);
  const stepsPerSecond = options.stepsPerSecond ?? 60;
  const soundOn = options.sound !== false;
  const signal = options.signal;
  let muted = options.sound?.muted === true;
  const checkAbort = () => {
    if (signal?.aborted) {
      throw aborted(signal);
    }
  };
  checkAbort();

  const loaderHref =
    options.loaderUrl === undefined ? url.href.replace(/\.wasm(?=$|[?#])/, ".mjs") : resolve(options.loaderUrl).href;
  const [loader, compiled] = await Promise.all([
    options.loader ?? import(loaderHref),
    compileFrom(url.href, signal),
  ]);
  checkAbort();
  if (typeof loader?.load !== "function") {
    throw new TypeError("nish/page/game: the loader has no load(source) export; pass the module's generated .mjs as options.loader");
  }
  const game = await loader.load(compiled, options.imports);
  checkAbort();
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
  // The keys the game has seen pressed, and the releases a full ring refused,
  // retried before each step: the game sees every press it is told of released.
  const held = new Map();
  const unreleased = new Map();
  const touches = new Map();
  const buttons = new Map();
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
    // A key whose release is still queued is down as far as the game knows.
    const again = held.has(id) || unreleased.delete(id);
    if (push(EVENT_KEY, words[0], words[1], mods, again || repeat ? ACTION_REPEAT : ACTION_PRESS, 0, 0) || again) {
      held.set(id, words);
    }
  };
  const releaseKey = (id, mods) => {
    const words = held.get(id);
    if (words !== undefined) {
      held.delete(id);
      if (!push(EVENT_KEY, words[0], words[1], mods, ACTION_RELEASE, 0, 0)) {
        unreleased.set(id, words);
      }
    }
  };
  const flushReleases = () => {
    for (const [id, words] of unreleased) {
      if (!push(EVENT_KEY, words[0], words[1], 0, ACTION_RELEASE, 0, 0)) {
        return;
      }
      unreleased.delete(id);
    }
  };
  const pressButton = (e) => {
    const [x, y] = framePoint(e);
    pendingMove = null;
    const button = MOUSE_BUTTONS[e.button] ?? MOUSE_NONE;
    if (push(EVENT_MOUSE, button, 0, modifiers(e), ACTION_PRESS, x, y)) {
      buttons.set(e.button, [x, y]);
    }
  };
  const releaseButton = (index, mods, x, y) => {
    if (buttons.delete(index)) {
      push(EVENT_MOUSE, MOUSE_BUTTONS[index] ?? MOUSE_NONE, 0, mods, ACTION_RELEASE, x, y);
    }
  };
  const releaseAll = () => {
    for (const id of [...held.keys()]) {
      releaseKey(id, 0);
    }
    for (const [index, [x, y]] of [...buttons]) {
      releaseButton(index, 0, x, y);
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

  // The context is made on the first gesture and resumed on every later one
  // until it runs: a browser starts it suspended unless the gesture activates
  // the page (a click, a key, a touch's end), and a pointerdown on a phone does not.
  let audio = null;
  let buffers = [];
  const unlock = () => {
    if (!running || !soundOn || sounds.length === 0) {
      return;
    }
    if (audio === null) {
      const Context = globalThis.AudioContext ?? globalThis.webkitAudioContext;
      if (typeof Context !== "function") {
        return;
      }
      let context = null;
      try {
        context = new Context();
        // A sound the browser refuses (a rate it cannot play) is skipped, not the rest.
        buffers = sounds.map(({ rate, samples }) => {
          try {
            const buffer = context.createBuffer(1, samples.length, rate);
            buffer.copyToChannel(samples, 0);
            return buffer;
          } catch {
            return undefined;
          }
        });
      } catch {
        // No context this time; the next gesture tries again.
        buffers = [];
        Promise.resolve(context?.close?.()).catch(() => {});
        return;
      }
      audio = context;
    }
    if (audio.state !== "running") {
      try {
        Promise.resolve(audio.resume?.()).catch(() => {});
      } catch {
        // A resume refused now is tried again on the next gesture.
      }
    }
  };
  const play = (id) => {
    const buffer = buffers[id];
    if (audio === null || muted || buffer === undefined || audio.state === "closed") {
      return;
    }
    const source = audio.createBufferSource();
    source.buffer = buffer;
    source.connect(audio.destination);
    source.start();
  };

  // ---- listeners ----------------------------------------------------------

  /** Ctrl, Alt and Meta make a key the browser's (Ctrl+Enter, Alt+Arrow, Cmd+Arrow), not the game's. */
  const shortcut = (e) => e.ctrlKey === true || e.altKey === true || e.metaKey === true;
  const onKeyDown = (e) => {
    const name = keyName(e.key);
    if (!running) {
      return;
    }
    if (name !== "Escape") {
      unlock();
    }
    if (!keys.has(name) || shortcut(e)) {
      return;
    }
    e.preventDefault();
    pressKey(e.code || name, name, modifiers(e), e.repeat === true);
  };
  const onKeyUp = (e) => {
    const name = keyName(e.key);
    const id = e.code || name;
    if (!running || !held.has(id)) {
      return;
    }
    e.preventDefault();
    releaseKey(id, modifiers(e));
  };
  const onGesture = () => unlock();
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
    // Captured, so a release off the canvas still reaches it.
    try {
      presenter.canvas.setPointerCapture?.(e.pointerId);
    } catch {
      // A pointer the browser no longer tracks; its release comes as a cancel.
    }
    pressButton(e);
  };
  const onPointerUp = (e) => {
    if (!running) {
      return;
    }
    if (e.type === "pointerup") {
      unlock();
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
    releaseButton(e.button, modifiers(e), x, y);
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

  // A devicePixelRatio change with no CSS resize (a zoom, a move to another
  // display) is heard through a media query for the ratio it was.
  let ratioQuery = null;
  const onRatio = () => {
    watchRatio();
    fit();
  };
  const watchRatio = () => {
    ratioQuery?.removeEventListener?.("change", onRatio);
    ratioQuery = null;
    if (running && typeof globalThis.matchMedia === "function") {
      ratioQuery = globalThis.matchMedia(`(resolution: ${globalThis.devicePixelRatio || 1}dppx)`);
      ratioQuery?.addEventListener?.("change", onRatio);
    }
  };

  const canvasListeners = [
    ["keydown", onKeyDown],
    ["keyup", onKeyUp],
    ["pointerdown", onPointerDown],
    ["pointerup", onPointerUp],
    ["pointercancel", onPointerUp],
    ["pointermove", onPointerMove],
    ["click", onGesture],
    ["touchend", onGesture],
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
  let loop = null;
  let stopped = false;
  const teardown = () => {
    if (stopped) {
      return;
    }
    stopped = true;
    running = false;
    loop?.stop();
    bind(null);
    observer?.disconnect();
    ratioQuery?.removeEventListener?.("change", onRatio);
    ratioQuery = null;
    globalThis.document?.removeEventListener?.("visibilitychange", onVisibility);
    globalThis.removeEventListener?.("resize", onWindowResize);
    signal?.removeEventListener?.("abort", teardown);
    held.clear();
    unreleased.clear();
    touches.clear();
    buttons.clear();
    if (audio !== null) {
      Promise.resolve(audio.close?.()).catch(() => {});
      audio = null;
    }
    presenter?.destroy();
  };
  /** Stops the game on a throw from the module or the presenter, and reports it. */
  const fail = (error) => {
    teardown();
    if (options.onError === undefined) {
      throw error;
    }
    options.onError(error);
  };

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
  if (signal?.aborted) {
    presenter.destroy();
    throw aborted(signal);
  }

  const fit = () => {
    const box = presenter.canvas.getBoundingClientRect();
    presenter.resize(box.width, box.height, globalThis.devicePixelRatio || 1);
    if (typeof game.resize === "function") {
      game.resize(Math.round(box.width), Math.round(box.height));
    }
  };

  let steps = 0;
  try {
    running = true;
    bind(presenter.canvas);
    globalThis.document?.addEventListener?.("visibilitychange", onVisibility);
    globalThis.addEventListener?.("resize", onWindowResize);
    signal?.addEventListener?.("abort", teardown);
    watchRatio();
    fit();
    presenter.canvas.focus?.({ preventScroll: true });

    loop = runFixedStep({
      stepsPerSecond,
      maxStepsPerFrame: options.maxStepsPerFrame,
      step: () => {
        try {
          flushReleases();
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
        } catch (e) {
          fail(e);
        }
      },
      render: (alpha, frameMs) => {
        try {
          game.draw(alpha, frameMs);
          // views() after the call: a memory that grew has a new buffer.
          const s = storage();
          const w = s.GAME_INFO[0];
          const h = s.GAME_INFO[1];
          if (w > 0 && h > 0) {
            presenter.present(s.GAME_FRAME, w, h);
          }
        } catch (e) {
          fail(e);
        }
      },
    });
  } catch (e) {
    teardown();
    throw e;
  }

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
    get running() {
      return running;
    },
    stop: teardown,
  };
};
