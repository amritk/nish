// What the boundary around a bytes-in Nish module costs, and when a Web Worker
// is worth its round trip.
//
// Builds bench/scan.ts as a freestanding wasm module and measures the same scan
// three ways:
//   1. in-process: copy the document into the arena and call, no worker
//   2. one document per worker message
//   3. N documents per worker message, so the round trip amortises
// plus the two ways an ArrayBuffer crosses a worker boundary (structured clone
// against a transfer), and a JSON.parse row for scale.
//
//   npm run build && node bench/worker.mjs [--docs N] [--size BYTES] [--compiler <nish>]
//
// The headline this was written to settle: a worker round trip is tens of
// microseconds and the scan is a fraction of one, so a worker that answers one
// document per message is almost entirely `postMessage`. The break-even table
// at the bottom says how large a batch has to be before the worker pays for
// itself, on the machine running it.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";

import { scanBatch } from "../web/bytes-worker.mjs";
import { compilerFrom } from "./compiler.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "build", "bench");

const flag = (name, fallback) => {
  const at = process.argv.indexOf(`--${name}`);
  return at === -1 ? fallback : Number(process.argv[at + 1]);
};
const DOCS = flag("docs", 1000);
const SIZE = flag("size", 0);

const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
  if (r.status !== 0) {
    console.error(`${cmd} ${args.join(" ")}\n${r.stdout}${r.stderr}`);
    process.exit(1);
  }
};

if (spawnSync("clang", ["-print-prog-name=wasm-ld"]).status !== 0) {
  console.error("bench/worker.mjs needs wasm-ld (install lld; see docs/INSTALL.md)");
  process.exit(2);
}
const nishc = compilerFrom(process.argv, root);
run(nishc.cmd, [...nishc.prefix, "bench/scan.ts", "-o", `${out}/scan.ll`]);
run("bash", [
  "scripts/build.sh",
  `${out}/scan.ll`,
  "runtime/runtime_wasm.c",
  "-o",
  `${out}/scan.wasm`,
  "--profile",
  "wasm",
]);
const wasmBytes = readFileSync(`${out}/scan.wasm`);

// The document under test: the `order` shape the mjst benches use, so a number
// here can be read next to one there, optionally padded out with `--size` to
// measure a payload where the per-byte work rather than the boundary dominates.
const ORDER = {
  id: "00000000-0000-4000-8000-000000000000",
  status: "paid",
  total: 59.97,
  customer: { name: "Ada", age: 36 },
  items: [
    { sku: "A-1", qty: 2 },
    { sku: "B-2", qty: 1 },
  ],
};
const json =
  SIZE > 0 ? JSON.stringify({ ...ORDER, pad: "x".repeat(Math.max(0, SIZE - 200)) }) : JSON.stringify(ORDER);
const doc = new TextEncoder().encode(json);
const docs = Array.from({ length: DOCS }, () => doc);

const { instance } = await WebAssembly.instantiate(wasmBytes, {});
const local = instance.exports;

// Correctness before timing, the same rule bench/run.mjs follows: a benchmark
// that measures the wrong answer quickly is worse than no benchmark.
const expected = scanBatch(local, [doc])[0];
if (expected < 0) {
  console.error(`bench/worker.mjs: the fixture does not scan clean (${expected})`);
  process.exit(1);
}

const worker = new Worker(new URL("../web/bytes-worker.mjs", import.meta.url));
let seq = 0;
const ask = (message, transfer) =>
  new Promise((resolve) => {
    const id = ++seq;
    const on = (reply) => {
      if (reply.id === id) {
        worker.off("message", on);
        resolve(reply);
      }
    };
    worker.on("message", on);
    worker.postMessage({ ...message, id }, transfer);
  });
await ask({ wasm: wasmBytes });

/** Median of `runs` timings of `body`, in nanoseconds per call. */
const median = async (body, iters, runs = 5) => {
  for (let i = 0; i < Math.min(iters, 200); i++) await body();
  const samples = [];
  for (let r = 0; r < runs; r++) {
    const t0 = performance.now();
    for (let i = 0; i < iters; i++) await body();
    samples.push(((performance.now() - t0) * 1e6) / iters);
  }
  return samples.sort((a, b) => a - b)[runs >> 1];
};

const row = (label, ns, per) =>
  console.log(
    `${label.padEnd(44)} ${(ns / 1000).toFixed(2).padStart(9)} us` +
      (per === undefined ? "" : `   ${(ns / per).toFixed(0).padStart(6)} ns/doc`)
  );

console.log(`\nbench/scan.ts over a ${doc.length}-byte document, ${DOCS} per batch\n`);
console.log("--- no worker (the default a caller should want) ---");
const oneLocal = await median(() => scanBatch(local, [doc]), 20_000);
row("in-process: copy + scan, 1 doc", oneLocal, 1);
const batchLocal = await median(() => scanBatch(local, docs), 200);
row(`in-process: copy + scan, ${DOCS} docs`, batchLocal, DOCS);
const parseNs = await median(() => JSON.parse(json), 20_000);
row("JSON.parse, for scale", parseNs, 1);

console.log("\n--- across a worker ---");
const empty = await median(() => ask({ docs: [] }), 2000);
row("empty round trip (the floor)", empty);
const oneRemote = await median(() => ask({ docs: [doc] }), 2000);
row("1 doc per message", oneRemote, 1);
const batchRemote = await median(() => ask({ docs }), 200);
row(`${DOCS} docs per message`, batchRemote, DOCS);

// `mode: "echo"` so these price the crossing alone. Scanning 25 MB at a few
// hundred MB/s takes far longer than handing it over, and a row that includes
// both cannot answer "is a transfer worth it".
console.log("\n--- how a big buffer crosses (echo: no scan) ---");
const big = 25 * 1024 * 1024;
const cloned = await median(() => ask({ mode: "echo", docs: [new Uint8Array(big)] }), 20);
row("25 MB, structured clone", cloned);
const moved = await median(() => {
  const b = new Uint8Array(big);
  return ask({ mode: "echo", docs: [b] }, [b.buffer]);
}, 20);
row("25 MB, transferred", moved);
// And the same 25 MB actually scanned, so the ratio of crossing to work is
// visible rather than implied.
const scanned = await median(() => {
  const b = new Uint8Array(big).fill(32);
  return ask({ docs: [b] }, [b.buffer]);
}, 20);
row("25 MB, transferred AND scanned", scanned);

// Where the two lines cross: the worker is worth it once the work in a message
// clears the round trip it costs. `oneLocal` is the per-document work, `empty`
// is the round trip, so the batch size that breaks even is their ratio.
const breakEven = Math.ceil(empty / oneLocal);
console.log(`
--- verdict ---
  worker round trip        ${(empty / 1000).toFixed(1)} us
  work per document        ${oneLocal.toFixed(0)} ns
  break-even batch         ~${breakEven} documents (${((breakEven * doc.length) / 1024).toFixed(0)} KB)

A worker pays for itself above roughly ${breakEven} documents per message, or one
document of about ${((breakEven * doc.length) / 1024).toFixed(0)} KB. Below that it is slower than doing the
work inline, and its only remaining argument is keeping the main thread free.`);

await worker.terminate();
