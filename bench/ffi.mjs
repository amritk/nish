// Per-call FFI cost versus batching (docs/wp8-interop.md).
//
// Builds bench/sum.ts as an N-API addon (and as a wasm module when wasm-ld is
// available), then sums 1..N three ways:
//   1. N calls to add(acc, i): every element crosses the JS/native boundary
//   2. one call to sumTo(N): the boundary is crossed once
//   3. a plain JS loop, for scale
//
//   npm run build && node bench/ffi.mjs [N]
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "build", "bench");
const N = Number(process.argv[2] ?? 1e6);
const REPEAT = 5;

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
  if (r.status !== 0) {
    console.error(`${cmd} ${args.join(" ")}\n${r.stdout}${r.stderr}`);
    process.exit(1);
  }
  return String(r.stdout);
}

// Compile once: IR + N-API shim + wasm typings from the same signatures.
run("node", [
  "dist/index.js", "bench/sum.ts", "--number-mode", "f64",
  "-o", `${out}/sum.ll`, "--emit-napi", `${out}/sum_napi.c`, "--emit-dts", `${out}/sum.d.ts`,
]);
run("bash", ["scripts/build.sh", `${out}/sum.ll`, "runtime/runtime.c", `${out}/sum_napi.c`, "-o", `${out}/sum.node`, "--profile", "napi"]);
const addon = createRequire(import.meta.url)(`${out}/sum.node`);

let wasm = null;
if (spawnSync("clang", ["-print-prog-name=wasm-ld"]).status === 0) {
  run("bash", ["scripts/build.sh", `${out}/sum.ll`, "-o", `${out}/sum.wasm`, "--profile", "wasm"]);
  wasm = (await WebAssembly.instantiate(readFileSync(`${out}/sum.wasm`), {})).instance.exports;
}

/** Best of REPEAT runs, in milliseconds, plus the value the last run produced. */
function time(label, fn) {
  let best = Infinity;
  let value;
  for (let r = 0; r < REPEAT; r++) {
    const t0 = process.hrtime.bigint();
    value = fn();
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    if (ms < best) best = ms;
  }
  const perElement = ((best * 1e6) / N).toFixed(2);
  console.log(`${label.padEnd(34)} ${best.toFixed(4).padStart(10)} ms   ${perElement.padStart(8)} ns/element   result ${value}`);
  return best;
}

const expected = (N * (N + 1)) / 2;
console.log(`sum of 1..${N.toLocaleString("en-US")}, best of ${REPEAT} runs (expected ${expected})\n`);

const perCall = time("N-API: N calls to add(acc, i)", () => {
  let acc = 0;
  for (let i = 1; i <= N; i++) acc = addon.add(acc, i);
  return acc;
});
const batched = time("N-API: one call to sumTo(N)", () => addon.sumTo(N));
let wasmPerCall = null;
if (wasm) {
  wasmPerCall = time("wasm: N calls to add(acc, i)", () => {
    let acc = 0;
    for (let i = 1; i <= N; i++) acc = wasm.add(acc, i);
    return acc;
  });
  time("wasm: one call to sumTo(N)", () => wasm.sumTo(N));
}
const js = time("JS loop (no boundary)", () => {
  let acc = 0;
  for (let i = 1; i <= N; i++) acc += i;
  return acc;
});

const ns = (ms) => ((ms * 1e6) / N).toFixed(1);
console.log(`\nOne N-API crossing costs about ${ns(perCall)} ns${wasmPerCall === null ? "" : `, one wasm crossing about ${ns(wasmPerCall)} ns`}; the JS loop body alone is ${ns(js)} ns.`);
console.log(`Batching the ${N.toLocaleString("en-US")} elements into one native call turns ${perCall.toFixed(1)} ms into ${(batched * 1e3).toFixed(1)} us: cross the boundary once per batch, not once per element.`);
