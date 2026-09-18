// Call an Nish addon's asynchronous exports, and measure what they buy
// (WP24 A1). `--emit-napi-async` gives every export whose arguments and result
// are plain scalars a second, promise-returning name: `spin` stays exactly as
// synchronous as it was and `spinAsync` runs the same call on libuv's thread
// pool, so a long call no longer blocks Node's event loop.
//
//   node dist/index.js tests/self/interop_async.ts -o build/spin.ll \
//     --emit-napi-async build/spin_napi.c --threads
//   scripts/build.sh build/spin.ll runtime/runtime.c build/spin_napi.c \
//     -o build/spin.node --profile napi --threads
//   node examples/node-addon-async.mjs build/spin.node 120000
//
// `--threads` is not optional on either line: the asynchronous shim allocates
// on a worker thread while the JS thread runs, so the arena has to be the
// thread-local one (WP20 T0) in the generated C and in the module alike. The
// compiler refuses `--emit-napi-async` without it, and the generated C refuses
// to compile without `-DNISH_THREADS`, rather than either one racing.
//
// The ticker below asks to be woken every 5 ms. How late it actually is, at
// the worst, is the latency the event loop shows a user -- a stalled loop is
// a dropped frame, a late timer and an unanswered socket, all at once.
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const file = path.resolve(process.argv[2] ?? "build/spin.node");
const addon = require(file);
const ROUNDS = Number(process.argv[3] ?? 20000);

/** Watch the event loop until the returned function is called; answers the worst lateness in ms. */
const watchLoop = () => {
  let worst = 0;
  let ticks = 0;
  let last = process.hrtime.bigint();
  const timer = setInterval(() => {
    const now = process.hrtime.bigint();
    const late = Number(now - last) / 1e6 - 5;
    if (late > worst) worst = late;
    ticks += 1;
    last = now;
  }, 5);
  timer.unref();
  return () => {
    clearInterval(timer);
    return { worst, ticks };
  };
};

const show = (label, wall, loop) =>
  console.log(
    `${label.padEnd(18)} call ${wall.toFixed(0).padStart(5)} ms   ` +
      `worst loop stall ${loop.worst.toFixed(2).padStart(8)} ms   over ${String(loop.ticks).padStart(3)} ticks`
  );

if (typeof addon.spinAsync !== "function") {
  console.log(`${path.basename(file)} has no asynchronous exports (build it with --emit-napi-async)`);
  process.exit(0);
}

// Warm both paths, so neither measurement pays for a first-touch arena chunk.
addon.spin(1);
await addon.spinAsync(1);

const syncStop = watchLoop();
const syncStart = performance.now();
const syncAnswer = addon.spin(ROUNDS);
const syncWall = performance.now() - syncStart;
// The stall is already over by now, but the ticker needs a turn of the loop to
// report it: the queued timers all fire at once the moment the call returns.
await new Promise((resolve) => setTimeout(resolve, 40));
show("sync spin()", syncWall, syncStop());

const asyncStop = watchLoop();
const asyncStart = performance.now();
const asyncAnswer = await addon.spinAsync(ROUNDS);
const asyncWall = performance.now() - asyncStart;
show("async spinAsync()", asyncWall, asyncStop());

console.log(`same answer from both: ${syncAnswer === asyncAnswer} (${syncAnswer})`);

// The allocating twin, run many at a time: each worker allocates in its own
// arena, and the JS thread's is left untouched.
if (typeof addon.digestAsync === "function") {
  const expected = [];
  for (let i = 0; i < 32; i++) expected.push(addon.digest(i, 64));
  const got = await Promise.all(expected.map((_, i) => addon.digestAsync(i, 64)));
  const same = got.every((v, i) => v === expected[i]);
  console.log(`32 concurrent digestAsync calls agree with digest: ${same}`);
}

// A `void` export resolves to undefined rather than to a boxed nothing.
if (typeof addon.touchAsync === "function") {
  const answer = await addon.touchAsync(1000);
  console.log(`touchAsync(1000) resolves to ${answer === undefined ? "undefined" : String(answer)}`);
}

// A bad argument rejects rather than throwing: the caller already holds the promise.
await addon.spinAsync("nope").then(
  () => console.log("spinAsync(\"nope\") resolved, which is wrong"),
  (err) => console.log(`spinAsync("nope") rejects: ${err.message}`)
);
