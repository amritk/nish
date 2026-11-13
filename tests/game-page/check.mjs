// Runs runtime/page-game.mjs under Node over the starter game built to real
// wasm (the directory examples/game-starter/build.mjs wrote, argv[2]), with
// tests/page-frame's fake canvas and presenter tiers, a fake fetch, WebAudio
// and ResizeObserver, and a scripted animation-frame clock. Prints one
// `ok <name>` or `not ok <name>\t<detail>` line per check, then `checks: <n>`;
// the `game-page` section of tests/run.js turns each line into a check and
// compares the count, so a run cut short is caught.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import os from "node:os";
import { startGame } from "../../runtime/page-game.mjs";
import { ringOver } from "../../runtime/page.mjs";
import { installClock, World } from "../page-frame/fakes.mjs";

const dir = path.resolve(process.argv[2]);
const results = [];
const check = (name, ok, detail) => {
  results.push(ok ? `ok ${name}` : `not ok ${name}\t${detail === undefined ? "" : detail}`);
};
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

// --- The browser around the page --------------------------------------------

/** What the fake fetch serves `.wasm` as; anything but application/wasm makes compileStreaming refuse. */
let wasmType = "application/wasm";
const compiled = { streaming: 0, whole: 0 };
const realStreaming = WebAssembly.compileStreaming;
const realCompile = WebAssembly.compile;
WebAssembly.compileStreaming = (source) => {
  compiled.streaming++;
  return realStreaming(source);
};
const gameBytes = fs.statSync(path.join(dir, "game.wasm")).size;
WebAssembly.compile = (bytes) => {
  // Node's own fetch compiles its HTTP parser through here too.
  compiled.whole += bytes.byteLength === gameBytes ? 1 : 0;
  return realCompile(bytes);
};
let fetched = 0;
globalThis.fetch = async (url) => {
  fetched++;
  const file = new URL(url).pathname;
  if (!fs.existsSync(file)) {
    return new Response("not found", { status: 404, statusText: "Not Found" });
  }
  return new Response(fs.readFileSync(file), { headers: { "content-type": wasmType } });
};

/** Listeners on an object that only needs add/remove and a dispatch. */
const target = (into) => {
  const listeners = new Map();
  into.addEventListener = (type, listener) => listeners.set(type, [...(listeners.get(type) ?? []), listener]);
  into.removeEventListener = (type, listener) =>
    listeners.set(
      type,
      (listeners.get(type) ?? []).filter((l) => l !== listener)
    );
  into.dispatch = (type, event) => (listeners.get(type) ?? []).forEach((l) => l(event));
  into.listenerCount = () => [...listeners.values()].reduce((n, list) => n + list.length, 0);
  return into;
};
const windowEvents = target({});
globalThis.addEventListener = windowEvents.addEventListener;
globalThis.removeEventListener = windowEvents.removeEventListener;
globalThis.devicePixelRatio = 2;
/** Every media query the page made, each one a target its `change` is dispatched on. */
const queries = [];
globalThis.matchMedia = (media) => {
  const q = target({ media, matches: true });
  queries.push(q);
  return q;
};

// A context starts suspended; resume() makes it run only once `resumes` is set,
// as a browser does only inside a gesture that activates the page.
const audio = { made: 0, closed: 0, buffers: [], started: [], resumed: 0, resumes: false, failNext: false, last: null };
globalThis.AudioContext = class {
  constructor() {
    if (audio.failNext) {
      audio.failNext = false;
      throw new Error("no audio device");
    }
    audio.made++;
    audio.last = this;
    this.state = "suspended";
    this.destination = { kind: "destination" };
  }
  createBuffer(channels, length, rate) {
    const buffer = { channels, length, rate, data: null, copyToChannel: (samples) => (buffer.data = samples.slice()) };
    audio.buffers.push(buffer);
    return buffer;
  }
  createBufferSource() {
    const source = { buffer: null, connect: (to) => (source.to = to), start: () => audio.started.push(source) };
    return source;
  }
  resume() {
    audio.resumed++;
    if (audio.resumes) {
      this.state = "running";
    }
    return Promise.resolve();
  }
  close() {
    audio.closed++;
    this.state = "closed";
  }
};

const observers = [];
globalThis.ResizeObserver = class {
  constructor(callback) {
    this.callback = callback;
    this.targets = [];
    observers.push(this);
  }
  observe(t) {
    this.targets.push(t);
  }
  disconnect() {
    this.targets = [];
  }
};

/** A world whose canvases have the layout, focus and attributes a page's canvas has. */
const makeWorld = (settings) => {
  const world = new World(settings).install();
  const proto = Object.getPrototypeOf(world.canvas);
  proto.getBoundingClientRect ??= () => ({ left: 0, top: 0, width: 640, height: 360 });
  proto.focus ??= function () {
    this.focused = (this.focused ?? 0) + 1;
  };
  proto.hasAttribute ??= function (name) {
    return name in this.attributes;
  };
  proto.setAttribute ??= function (name, value) {
    this.attributes[name] = String(value);
  };
  proto.setPointerCapture ??= function (id) {
    this.captured = [...(this.captured ?? []), id];
  };
  for (const c of world.canvases) {
    c.style ??= {};
  }
  const make = world.document.createElement;
  world.document.createElement = (tag) => Object.assign(make(tag), { style: {} });
  world.document.baseURI = pathToFileURL(`${dir}/`).href;
  world.document.visibilityState = "visible";
  target(world.document);
  globalThis.document = world.document;
  return world;
};

const key = (k, code, extra) => ({
  key: k,
  code,
  repeat: false,
  prevented: false,
  preventDefault() {
    this.prevented = true;
  },
  ...extra,
});
const FRAME_MS = 1000 / 60;

/** The input records queued for the next step, each [type, what, code, mods, action, x, y]. */
const queued = (game) => {
  const words = new Int32Array(game.module.memory.buffer, game.module.layout.GAME_INPUT.at, game.module.layout.GAME_INPUT.length);
  const ring = ringOver(game.module.memory, game.module.layout.GAME_INPUT);
  const capacity = ring.capacity;
  const flat = [];
  for (let i = 0; i < ring.size(); i++) {
    flat.push(words[2 + ((words[0] + i) % capacity)]);
  }
  const records = [];
  for (let i = 0; i + 7 <= flat.length; i += 7) {
    records.push(flat.slice(i, i + 7));
  }
  return records;
};

/** Starts the starter in a fresh world; `run(n)` advances n display frames. */
const start = async (settings, options) => {
  const world = makeWorld(settings);
  const clock = installClock();
  let now = 0;
  clock.tick(now);
  const game = await startGame(world.canvas, "game.wasm", { seed: 7, ...options });
  const run = (frames) => {
    for (let i = 0; i < frames; i++) {
      now += FRAME_MS;
      clock.tick(now);
    }
  };
  run(1);
  const state = () => game.module.views().storage;
  return { world, clock, game, run, state };
};

// --- Loading -----------------------------------------------------------------

{
  const { world, game, run, state, clock } = await start({ contexts: ["2d"] });
  check("load: streaming compilation through the generated loader", compiled.streaming === 1 && compiled.whole === 0,
    JSON.stringify(compiled));
  check("load: the 2D tier when it is the only one", game.presenter.backend === "canvas2d", game.presenter.backend);
  check("load: GAME_INFO holds the game's size", state().GAME_INFO[0] === 320 && state().GAME_INFO[1] === 180,
    `${state().GAME_INFO[0]}x${state().GAME_INFO[1]}`);

  // --- Presenting ------------------------------------------------------------
  const presented = [];
  const present = game.presenter.present;
  game.presenter.present = (pixels, w, h) => {
    presented.push([pixels, w, h]);
    return present.call(game.presenter, pixels, w, h);
  };
  run(3);
  const last = presented.at(-1);
  check("present: once per display frame", presented.length === 3, presented.length);
  check("present: at GAME_INFO's width and height", last !== undefined && last[1] === 320 && last[2] === 180,
    last && `${last[1]}x${last[2]}`);
  check(
    "present: GAME_FRAME itself, a view of the module's memory with no copy",
    last !== undefined &&
      last[0].buffer === game.module.memory.buffer &&
      last[0].byteOffset === game.module.layout.GAME_FRAME.at,
    last && `${last[0].byteOffset} vs ${game.module.layout.GAME_FRAME.at}`
  );
  // The paddle is 48x4 at y 164, centred on x 160 before any input: 0xf0f0f0 there, the background below it.
  const pixel = (x, y) => last[0][y * 320 + x] & 0xffffff;
  const paddleRows = [164, 165, 166, 167].every((y) => [137, 160, 183].every((x) => pixel(x, y) === 0xf0f0f0));
  check("present: the frame is drawn, the paddle where the game put it",
    last !== undefined && paddleRows && pixel(160, 170) !== 0xf0f0f0 && pixel(130, 165) !== 0xf0f0f0,
    last && [pixel(160, 165), pixel(160, 170), pixel(130, 165)].map((p) => p.toString(16)).join());

  // --- The canvas ------------------------------------------------------------
  const canvas = game.presenter.canvas;
  check("canvas: focusable", canvas.attributes.tabindex === "0", JSON.stringify(canvas.attributes));
  check("canvas: focused at start", canvas.focused >= 1);
  check("canvas: touch-action none, so a touch steers instead of scrolling", canvas.style.touchAction === "none");
  const resized = [];
  const resize = game.presenter.resize;
  game.presenter.resize = (w, h, dpr) => {
    resized.push([w, h, dpr]);
    return resize.call(game.presenter, w, h, dpr);
  };
  observers.at(-1).callback([]);
  check("resize: the observer resizes the presenter at devicePixelRatio",
    JSON.stringify(resized) === JSON.stringify([[640, 360, 2]]), JSON.stringify(resized));
  windowEvents.dispatch("resize", {});
  check("resize: a window resize does too", resized.length === 2, resized.length);
  const ratio = queries.at(-1);
  check("resize: the ratio is watched through a media query", ratio?.media === "(resolution: 2dppx)", ratio?.media);
  globalThis.devicePixelRatio = 3;
  ratio.dispatch("change", {});
  check("resize: a devicePixelRatio change refits at the new ratio, and watches it",
    resized.at(-1)?.[2] === 3 && ratio.listenerCount() === 0 && queries.at(-1).media === "(resolution: 3dppx)",
    `${JSON.stringify(resized.at(-1))} ${queries.at(-1).media}`);
  globalThis.devicePixelRatio = 2;

  // --- Keys ------------------------------------------------------------------
  const paddle = () => state().BALL[4];
  check("sound: no AudioContext before a gesture", audio.made === 0, audio.made);
  const before = paddle();
  const right = key("ArrowRight", "ArrowRight");
  canvas.dispatch("keydown", right);
  run(10);
  check("keys: a held ArrowRight moves the paddle", paddle() > before + 30, `${before} -> ${paddle()}`);
  check("keys: the game's key has its default prevented", right.prevented);
  const other = key("a", "KeyA");
  canvas.dispatch("keydown", other);
  check("keys: any other key keeps its default", !other.prevented);
  const shortcut = key("ArrowLeft", "ArrowLeft", { altKey: true });
  canvas.dispatch("keydown", shortcut);
  check("keys: a game key held with Alt, Ctrl or Meta is the browser's", !shortcut.prevented && queued(game).length === 0,
    JSON.stringify(queued(game)));
  canvas.dispatch("keyup", key("ArrowRight", "ArrowRight"));
  run(1);
  const released = paddle();
  run(5);
  check("keys: the release stops it", paddle() === released, `${released} -> ${paddle()}`);

  canvas.dispatch("keydown", key("ArrowLeft", "ArrowLeft"));
  run(2);
  canvas.dispatch("blur", {});
  run(1);
  const blurred = paddle();
  run(5);
  check("keys: blur releases the keys held", paddle() === blurred, `${blurred} -> ${paddle()}`);
  canvas.dispatch("focus", {});
  canvas.dispatch("keydown", key("ArrowLeft", "ArrowLeft"));
  run(2);
  world.document.visibilityState = "hidden";
  world.document.dispatch("visibilitychange", {});
  run(1);
  const hidden = paddle();
  run(5);
  check("keys: a hidden page releases them too", paddle() === hidden, `${hidden} -> ${paddle()}`);
  world.document.visibilityState = "visible";

  // --- Sound -----------------------------------------------------------------
  check("sound: the first key press makes the AudioContext", audio.made === 1, audio.made);
  check(
    "sound: one buffer per sound the game answers, built once",
    audio.buffers.length === 3 && audio.buffers.every((b) => b.rate === 22050 && b.length > 0 && b.data.some((s) => s !== 0)),
    JSON.stringify(audio.buffers.map((b) => [b.rate, b.length]))
  );
  check("sound: the context is resumed inside the gesture", audio.resumed >= 1 && audio.last.state === "suspended", audio.resumed);
  const tries = audio.resumed;
  canvas.dispatch("click", {});
  check("sound: each later gesture resumes it again while it is suspended", audio.resumed === tries + 1, audio.resumed);
  audio.resumes = true;
  canvas.dispatch("pointerup", { pointerType: "mouse", button: 0, clientX: 0, clientY: 0, type: "pointerup" });
  canvas.dispatch("click", {});
  check("sound: and stops once it runs", audio.last.state === "running" && audio.resumed === tries + 2, audio.resumed);
  check("serve: waiting before a serve", state().SCORE[2] === 1);
  canvas.dispatch("keydown", key(" ", "Space"));
  run(1);
  canvas.dispatch("keyup", key(" ", "Space"));
  check("serve: Space serves", state().SCORE[2] === 0, state().SCORE[2]);
  run(120);
  check(
    "sound: the wall sound plays when the ball reaches the top",
    audio.started.some((s) => s.buffer === audio.buffers[1] && s.to?.kind === "destination"),
    audio.started.length
  );
  const heard = audio.started.length;
  game.muted = true;
  run(300);
  check("sound: muted plays nothing", audio.started.length === heard, `${heard} -> ${audio.started.length}`);
  check("sound: muted reads back", game.muted === true);

  // --- Stop --------------------------------------------------------------------
  game.stop();
  game.stop();
  check("stop: no frame left requested", clock.pending === null);
  check("stop: no listener left on the canvas", [...canvas.listeners.values()].every((l) => l.length === 0));
  check(
    "stop: none on the document, the window or the media query",
    world.document.listenerCount() === 0 && windowEvents.listenerCount() === 0 && queries.every((q) => q.listenerCount() === 0),
    `${world.document.listenerCount()} ${windowEvents.listenerCount()}`
  );
  check("stop: the resize observer disconnected", observers.at(-1).targets.length === 0);
  check("stop: the AudioContext closed", audio.closed === 1, audio.closed);
  const after = presented.length;
  clock.tick(1e6);
  check("stop: nothing presented after", presented.length === after);
}

// --- Touch, and a fallback to a fresh canvas --------------------------------

{
  // WebGL 2 fails to compile, so the presenter falls back to 2D on a fresh canvas.
  const falls = [];
  const { world, game, run, state } = await start(
    { contexts: ["webgl2", "2d"], glCompiles: false },
    { onFallback: (from, to) => falls.push([from, to]) }
  );
  check("fallback: reported through onFallback", falls.at(-1)?.join() === "webgl2,canvas2d", JSON.stringify(falls));
  const fresh = game.presenter.canvas;
  check("fallback: the presenter's canvas is the page's", world.current === fresh);
  check("fallback: the listeners are on the fresh canvas", (fresh.listeners.get("keydown") ?? []).length === 1);
  const paddle = () => state().BALL[4];
  const touch = (type, x, timeStamp) => {
    const e = { pointerType: "touch", pointerId: 3, clientX: x, clientY: 100, timeStamp, type };
    e.preventDefault = () => (e.prevented = true);
    fresh.dispatch(type, e);
    return e;
  };
  const before = paddle();
  const down = touch("pointerdown", 50, 0);
  run(10);
  check("touch: holding the left half steers left", paddle() < before - 30, `${before} -> ${paddle()}`);
  check("touch: its default prevented", down.prevented === true);
  touch("pointerup", 50, 1000);
  check("touch: a long hold is not a tap", state().SCORE[2] === 1);
  touch("pointerdown", 600, 2000);
  touch("pointerup", 600, 2100);
  run(1);
  check("touch: a tap serves", state().SCORE[2] === 0, state().SCORE[2]);
  game.stop();
}

// --- The WebGL 2 tier, and a mouse --------------------------------------------

{
  const { game, run, state } = await start({ contexts: ["webgl2"] });
  check("webgl2: the tier when WebGPU is missing", game.presenter.backend === "webgl2", game.presenter.backend);
  const canvas = game.presenter.canvas;
  canvas.dispatch("pointermove", { pointerType: "mouse", clientX: 100, clientY: 180 });
  run(1);
  // 640x360 CSS pixels over 320x180: x 100 is frame x 50.
  check("mouse: a move puts the paddle under the pointer", Math.abs(state().BALL[4] - 50) < 1e-9, state().BALL[4]);
  const gl = canvas.context;
  check("webgl2: the frame uploaded", gl.calls.some((c) => c[0] === "texSubImage2D" || c[0] === "texImage2D"));
  const made = audio.made;
  audio.failNext = true;
  canvas.dispatch("pointerdown", { pointerType: "mouse", pointerId: 9, button: 0, clientX: 100, clientY: 180 });
  check("mouse: a press captures the pointer", JSON.stringify(canvas.captured) === "[9]", JSON.stringify(canvas.captured));
  check("sound: a context the browser refuses is not kept", audio.made === made, audio.made);
  run(1);
  canvas.dispatch("blur", {});
  check(
    "mouse: blur releases the button held",
    queued(game).some((r) => r[0] === 2 && r[1] === 1 && r[4] === 3),
    JSON.stringify(queued(game))
  );
  canvas.dispatch("click", {});
  check("sound: the next gesture makes it again", audio.made === made + 1, audio.made);
  game.stop();
}

// --- A full input ring --------------------------------------------------------

{
  const { game, run, state } = await start({ contexts: ["2d"] });
  const canvas = game.presenter.canvas;
  canvas.dispatch("keydown", key("ArrowRight", "ArrowRight"));
  // Presses of keys the starter ignores fill the ring; a step drains it.
  for (let i = 0; queued(game).length < 64 && i < 64; i++) {
    canvas.dispatch("keydown", key("ArrowUp", `Up${i}`));
  }
  const ring = ringOver(game.module.memory, game.module.layout.GAME_INPUT);
  check("ring: filled", ring.free() < 7, ring.free());
  const refused = key("Enter", "Enter");
  canvas.dispatch("keydown", refused);
  const refusedUp = key("Enter", "Enter");
  canvas.dispatch("keyup", refusedUp);
  check("ring: a press the full ring refused is not held, so its release is the page's", !refusedUp.prevented);
  canvas.dispatch("keyup", key("ArrowRight", "ArrowRight"));
  run(3);
  const stopped = state().BALL[4];
  run(5);
  check("ring: a release the full ring refused reaches a later step", state().BALL[4] === stopped,
    `${stopped} -> ${state().BALL[4]}`);
  game.stop();
}

// --- The wrong MIME type, and refusals ---------------------------------------

{
  wasmType = "application/octet-stream";
  compiled.streaming = 0;
  compiled.whole = 0;
  const { game } = await start({ contexts: ["2d"] });
  check("load: a server's wrong MIME type falls back to compile", compiled.streaming === 1 && compiled.whole === 1,
    JSON.stringify(compiled));
  game.stop();
  wasmType = "application/wasm";
}

/** The rejection's message, or null when the start resolved. */
const refusal = async (url, options) => {
  const world = makeWorld({ contexts: ["2d"] });
  installClock();
  try {
    const game = await startGame(world.canvas, url, options);
    game.stop();
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
};
{
  const message = await refusal("missing.wasm", { loader: await import(pathToFileURL(path.join(dir, "game.mjs")).href) });
  check("refuse: a 404 rejects, naming the URL and the status",
    message !== null && message.includes("missing.wasm") && message.includes("404"), message);
}
const real = await import(pathToFileURL(path.join(dir, "game.mjs")).href);
const without = (strip) => ({
  load: async (module, imports) => {
    const game = await real.load(module, imports);
    return strip({ ...game, layout: { ...game.layout } });
  },
});
{
  const message = await refusal("game.wasm", { loader: without((g) => ({ ...g, draw: undefined })) });
  check("refuse: a module without `draw` rejects, naming it", message !== null && message.includes("`draw`"), message);
}
{
  const message = await refusal("game.wasm", {
    loader: without((g) => {
      delete g.layout.GAME_SOUNDS;
      return g;
    }),
  });
  check("refuse: a module without GAME_SOUNDS rejects, naming it", message !== null && message.includes("`GAME_SOUNDS`"), message);
}
{
  const message = await refusal("game.wasm", { loader: {} });
  check("refuse: a loader without load rejects, saying so", message !== null && message.includes("load(source)"), message);
}

// --- Errors, aborts and options -----------------------------------------------

{
  const errors = [];
  const loader = {
    load: async (module, imports) => {
      const real = await import(pathToFileURL(path.join(dir, "game.mjs")).href);
      const g = await real.load(module, imports);
      return {
        ...g,
        step: () => {
          throw new Error("panic in step");
        },
      };
    },
  };
  const { game, clock, run } = await start({ contexts: ["2d"] }, { loader, onError: (e) => errors.push(e) });
  const canvas = game.presenter.canvas;
  run(2);
  check("error: a throw from step reaches onError once", errors.length === 1 && errors[0].message === "panic in step",
    errors.map(String).join());
  check("error: the game has stopped", game.running === false && clock.pending === null);
  check("error: its listeners are gone", [...canvas.listeners.values()].every((l) => l.length === 0));
}
{
  const controller = new AbortController();
  const { game, clock } = await start({ contexts: ["2d"] }, { signal: controller.signal });
  check("abort: a running game runs until its signal aborts", game.running === true);
  controller.abort();
  check("abort: then it stops", game.running === false && clock.pending === null);
}
{
  const before = fetched;
  const message = await refusal("game.wasm", { signal: AbortSignal.abort() });
  check("abort: an aborted signal rejects the start before any fetch", message !== null && /abort/i.test(message) && fetched === before,
    message);
}
{
  const before = fetched;
  const bad = [
    await refusal("game.wasm", { stepsPerSecond: 0 }),
    await refusal("game.wasm", { keys: "ArrowLeft" }),
    await refusal("game.wasm", { touch: { zones: [{ x: 0, y: 0, width: 1, height: 1 }] } }),
    await refusal("game.wasm", { onError: "log" }),
  ];
  check("options: malformed ones reject before any fetch", bad.every((m) => m !== null) && fetched === before,
    `${JSON.stringify(bad)} ${fetched - before}`);
}
{
  const message = await refusal("game.bin");
  check("loader: a module URL not ending in .wasm needs a loader, and says so", message?.includes("loaderUrl") === true, message);
  const elsewhere = fs.mkdtempSync(path.join(os.tmpdir(), "game-page-"));
  fs.copyFileSync(path.join(dir, "game.wasm"), path.join(elsewhere, "module.bin"));
  const world = makeWorld({ contexts: ["2d"] });
  installClock();
  const game = await startGame(world.canvas, pathToFileURL(path.join(elsewhere, "module.bin")), {
    loaderUrl: pathToFileURL(path.join(dir, "game.mjs")),
  });
  check("loader: loaderUrl names it", typeof game.module.step === "function" && game.running);
  game.stop();
  fs.rmSync(elsewhere, { recursive: true, force: true });
}

await settle();
for (const line of results) {
  console.log(line);
}
console.log(`checks: ${results.length}`);
