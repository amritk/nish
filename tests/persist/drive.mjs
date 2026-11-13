// WP55 root storage, driven as a page drives it: load a module through the
// loader `--emit-dts` wrote, call its exports for many steps, and check the
// answers and that neither linear memory nor the kept heap grows.
//
//   node tests/persist/drive.mjs world    <loader.mjs> <module.wasm> <steps>
//   node tests/persist/drive.mjs director <loader.mjs> <module.wasm> <steps>
//   node tests/persist/drive.mjs chain    <loader.mjs> <module.wasm> <steps>
//   node tests/persist/drive.mjs graph    <loader.mjs> <module.wasm> <steps>
//
// The kept heap is the arena's offset after a call, which only the runtime's
// `nish_arena_mark` answers; the loader keeps the instance to itself, so the
// driver notes the instance as `WebAssembly.Instance` makes it.

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const [mode, loaderPath, wasmPath, stepsArg] = process.argv.slice(2);
const steps = Number(stepsArg);
if (!["world", "director", "chain", "graph"].includes(mode) || !loaderPath || !wasmPath || !(steps > 0)) {
  console.error("usage: drive.mjs world|director|chain|graph <loader.mjs> <module.wasm> <steps>");
  process.exit(2);
}

const NativeInstance = WebAssembly.Instance;
let instance = null;
let keeps = true;
WebAssembly.Instance = function Instance(module, imports) {
  instance = new NativeInstance(module, imports);
  if (keeps) {
    return instance;
  }
  // A reference that never compacts: the loader's keep does nothing, so
  // every block stays where it was made and nothing is released.
  return { exports: { ...instance.exports, nish_root_keep() {} } };
};
const { loadSync } = await import(pathToFileURL(loaderPath).href);
const { ringOver } = await import(new URL("../../runtime/page.mjs", import.meta.url).href);
const wasmModule = new WebAssembly.Module(readFileSync(wasmPath));
/** A fresh instance of the module, compacting or not, with its own `kept`. */
const load = (compacts) => {
  keeps = compacts;
  const loaded = loadSync(wasmModule);
  const own = instance;
  keeps = true;
  return { mod: loaded, kept: () => Number(own.exports.nish_arena_mark()) };
};
const main = load(true);
const mod = main.mod;
const kept = main.kept;
const fail = (message) => {
  console.error(`persist ${mode}: ${message}`);
  process.exit(1);
};

/** The slack the kept heap may pass its warm-up peak by: one wasm page. */
const PAGE = 65536;

/**
 * Memory and kept heap, sampled after every call once the first quarter of
 * the run has warmed up (the director takes some 10,000 steps to reach its
 * largest): the most either reached in the warm-up is the bound the rest must
 * stay under, so a leak of a few bytes a step shows long before the end.
 */
const watch = () => {
  let warm = false;
  let memMax = 0;
  let keptMax = 0;
  let worst = 0;
  return {
    note(step) {
      const mem = mod.memory.buffer.byteLength;
      const k = kept();
      if (!warm) {
        memMax = Math.max(memMax, mem);
        keptMax = Math.max(keptMax, k);
        warm = step >= steps / 4;
        return;
      }
      if (mem > memMax) {
        fail(`memory grew from ${memMax} to ${mem} bytes at step ${step}`);
      }
      // Compaction runs once the kept region passes twice the live bytes and
      // a page, so the region's peak moves by twice what the live graph does
      // (a score gaining a digit). A page of slack covers that; a leak of a
      // few bytes a step passes it within the run.
      if (k > keptMax + PAGE) {
        fail(`kept heap grew from ${keptMax} to ${k} at step ${step}`);
      }
      worst = Math.max(worst, k);
    },
    report() {
      return `memory ${memMax} bytes, kept heap at most ${worst} (warm-up ${keptMax})`;
    },
  };
};

const digits = (n) => String(n).length;

/** What `draw` answers after `t` steps, worked out the way world.ts builds it. */
const worldSum = (t) => {
  let sum = 0;
  for (let id = Math.max(1, t - 63); id <= t; id++) {
    sum += 6 * id + 5 + digits(id);
  }
  for (let s = Math.max(1, t - 15); s <= t; s++) {
    sum += s % 2 === 0 ? s : s + 4 + digits(s);
  }
  return sum + t * 1000 + 5 + digits(t) + ((t * 496) % 1000);
};

const runWorld = () => {
  mod.init();
  const w = watch();
  for (let t = 1; t <= steps; t++) {
    mod.step();
    w.note(t);
    if (t % 97 === 0 || t === steps) {
      const got = mod.draw();
      w.note(t);
      if (got !== worldSum(t)) {
        fail(`draw() after ${t} steps is ${got}, expected ${worldSum(t)}`);
      }
    }
  }
  if (mod.tick() !== steps) {
    fail(`tick() is ${mod.tick()} after ${steps} steps`);
  }
  console.log(`persist world: ${steps} steps, draw() ${mod.draw()}; ${w.report()}`);
};

// nish/term's key constants, as std/host/game.ts documents the record.
const EVENT_KEY = 1;
const KEY_CHAR = 1;
const KEY_RIGHT = 4;
const KEY_LEFT = 5;
const KEY_ENTER = 6;
const ACTION_PRESS = 1;
const ACTION_RELEASE = 3;
const SCENES = ["menu", "game", "intro"];

/**
 * A scripted player for `m`: Enter every 3 s takes the intro to the menu and
 * the menu into a game; in a game, hold left or right for a second and serve
 * with space. `play(t)` feeds step `t`'s keys.
 */
const player = (m) => {
  const input = ringOver(m.memory, m.layout.GAME_INPUT);
  const key = (kind, code, action) => {
    if (input.free() >= 7) {
      for (const word of [EVENT_KEY, kind, code, 0, action, 0, 0]) {
        input.push(word);
      }
    }
  };
  const tap = (kind, code) => {
    key(kind, code, ACTION_PRESS);
    key(kind, code, ACTION_RELEASE);
  };
  let held = 0;
  return (t) => {
    if (t % 360 === 0) {
      tap(KEY_ENTER, 0);
    }
    if (t % 120 === 0) {
      if (held !== 0) {
        key(held, 0, ACTION_RELEASE);
      }
      held = (t / 120) % 3 === 0 ? 0 : (t / 120) % 3 === 1 ? KEY_LEFT : KEY_RIGHT;
      if (held !== 0) {
        key(held, 0, ACTION_PRESS);
      }
      tap(KEY_CHAR, 32);
    }
  };
};

/**
 * Steps the director runs beside a reference that never compacts. Its kept
 * heap grows slowly, so the first compaction comes near step 16,000; 40,000
 * covers three.
 */
const SAME_STEPS = 40000;

/**
 * The director twice in lockstep, one instance compacting after every call
 * and one whose keep does nothing: every answer must match, so a compaction
 * that moved a block wrong, or rewrote a pointer it should not have, shows as
 * a frame that differs from the one nothing moved under.
 */
const sameAsUncompacted = () => {
  const a = load(true);
  const b = load(false);
  const playA = player(a.mod);
  const playB = player(b.mod);
  a.mod.init(1505);
  b.mod.init(1505);
  let compactions = 0;
  for (let t = 1; t <= SAME_STEPS; t++) {
    playA(t);
    playB(t);
    const before = a.kept();
    const got = [a.mod.step(), a.mod.scene(), a.mod.draw()];
    const want = [b.mod.step(), b.mod.scene(), b.mod.draw()];
    if (got.some((v, i) => v !== want[i])) {
      fail(`step ${t}: step/scene/draw answered ${got} compacting, ${want} without`);
    }
    // Two calls, each ending in a keep: lower after them than before means
    // at least one compacted.
    if (a.kept() < before) {
      compactions++;
    }
  }
  if (compactions === 0) {
    fail(`no compaction in ${SAME_STEPS} steps beside the reference`);
  }
  return compactions;
};

const runDirector = () => {
  const compactions = sameAsUncompacted();
  const play = player(mod);
  mod.init(1505);
  const w = watch();
  const seen = new Map();
  const frames = new Set();
  for (let t = 1; t <= steps; t++) {
    play(t);
    const running = mod.step();
    w.note(t);
    if (running !== 1) {
      fail(`step() answered ${running} at step ${t}: the director stopped`);
    }
    const scene = SCENES[mod.scene()] ?? `scene ${mod.scene()}`;
    seen.set(scene, (seen.get(scene) ?? 0) + 1);
    if (t % 2 === 0) {
      frames.add(mod.draw());
      w.note(t);
    }
  }
  for (const scene of SCENES) {
    if (!seen.has(scene)) {
      fail(`the director never reached its ${scene} scene: ${JSON.stringify([...seen])}`);
    }
  }
  const info = new Int32Array(mod.memory.buffer, mod.layout.GAME_INFO.at, 2);
  if (info[0] <= 0 || info[1] <= 0 || frames.size < 10) {
    fail(`frames ${info[0]}x${info[1]}, ${frames.size} distinct`);
  }
  const counts = SCENES.map((s) => `${s} ${seen.get(s)}`).join(", ");
  console.log(
    `persist director: ${steps} steps (${counts}), ${frames.size} distinct frames; ${w.report()}; ` +
      `the first ${SAME_STEPS} match an uncompacted run frame for frame across ${compactions} compactions`
  );
};

/**
 * tests/cases/root_storage_page.ts, one node pushed a call: a list as long as
 * the run, which every compaction traces end to end. A trace that recursed
 * would run out of stack long before the end; this one keeps a work list.
 */
const runChain = () => {
  let sum = 0;
  for (let t = 1; t <= steps; t++) {
    mod.push(t % 100);
    sum += t % 100;
    if (t % 9973 === 0 || t === steps) {
      const got = mod.total();
      if (got !== sum) {
        fail(`total() after ${t} pushes is ${got}, expected ${sum}`);
      }
    }
  }
  // A node is 8 bytes on wasm32 (an i32 and a pointer), so the list is
  // 8 * steps; between compactions the kept region grows to twice that and a
  // page.
  const live = 8 * steps;
  if (kept() > 2 * live + 2 * PAGE) {
    fail(`kept heap ${kept()} for a ${live}-byte list`);
  }
  console.log(`persist chain: ${steps} steps, total() ${sum}; memory ${mod.memory.buffer.byteLength} bytes, kept heap ${kept()}`);
};

/** What graph.ts's `draw` answers after `t` steps, worked out on its own. */
const graphSum = (t) => {
  let sum = 0;
  for (let id = Math.max(1, t - 31); id <= t; id++) {
    sum += id + 1 + digits(id);
  }
  for (let k = Math.max(1, t - 7); k <= t; k++) {
    const n = k % 4;
    sum += n + n * (3 + digits(k)) + (k * n * (n - 1)) / 2;
  }
  for (let v = t - (t % 10) + 1; v <= t; v++) {
    sum += v + 1;
  }
  return sum + t * 7 + ((49985001 + 9999 * t) % 1000);
};

/**
 * tests/persist/graph.ts: cycles, a hub two root storages and two slots share,
 * arrays of arrays with empty rows, an empty array and string, and an array
 * reset to empty and grown again, under 80 KB of garbage a call, so at least
 * every third keep compacts. After each, `check` must find every identity and back
 * pointer intact and `draw` the checksum the steps add up to.
 */
const runGraph = () => {
  mod.init();
  const w = watch();
  let compactions = 0;
  for (let t = 1; t <= steps; t++) {
    const before = kept();
    mod.step();
    w.note(t);
    if (kept() < before) {
      compactions++;
    }
    const bad = mod.check();
    if (bad !== 0) {
      fail(`check() answered ${bad} after ${t} steps (${compactions} compactions)`);
    }
    const got = mod.draw();
    if (got !== graphSum(t)) {
      fail(`draw() after ${t} steps is ${got}, expected ${graphSum(t)}`);
    }
  }
  if (compactions < steps / 3) {
    fail(`only ${compactions} compactions in ${steps} steps`);
  }
  console.log(`persist graph: ${steps} steps, ${compactions} compactions, every check and draw() right; ${w.report()}`);
};

if (mode === "world") {
  runWorld();
} else if (mode === "director") {
  runDirector();
} else if (mode === "graph") {
  runGraph();
} else {
  runChain();
}
