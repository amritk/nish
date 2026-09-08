// Import an AmritScript module compiled to WebAssembly from ordinary Node.js.
// This is the recommended interop direction: keep hot loops in AmritScript,
// let Node handle I/O and npm packages, and cross the boundary rarely.
//
//   scripts/build.sh build/add.ll -o build/add.wasm --profile wasm
//   node examples/node-host.mjs build/add.wasm              # add(2, 3) = 5
//   node examples/node-host.mjs build/add.wasm add 40 2     # add(40, 2) = 42
//
// Arrays cross as typed arrays (examples/arrays.ts). `amritc --emit-dts
// build/arrays.d.ts` writes the typings and, next to them, `build/arrays.mjs`,
// a loader that copies Int32Array / Float64Array / BigInt64Array arguments
// into the module's arena and copies results out; when that companion sits
// next to the .wasm file this script uses it instead of the plain loader:
//
//   scripts/build.sh build/arrays.ll runtime/runtime_wasm.c -o build/arrays.wasm --profile wasm
//   node examples/node-host.mjs build/arrays.wasm scale f64:1,2,3 2      # scale(...) = 2, 4, 6
//   node examples/node-host.mjs build/arrays.wasm sumI64 i64:1,2,3      # sumI64(...) = 6n
//
// Arguments spelled `i32:1,2,3`, `f64:0.5,1.5`, `i64:1,2` become the matching
// typed array; anything else is a Number.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** Instantiate a freestanding AmritScript wasm module and return its exports (scalars only). */
export async function load(bytes) {
  const { instance } = await WebAssembly.instantiate(bytes, {});
  return instance.exports;
}

const TYPED = { i32: Int32Array, f64: Float64Array, i64: BigInt64Array };
function parseArg(text) {
  const m = /^(i32|f64|i64):(.*)$/.exec(text);
  if (!m) return Number(text);
  const items = m[2] === "" ? [] : m[2].split(",");
  return TYPED[m[1]].from(m[1] === "i64" ? items.map(BigInt) : items.map(Number));
}
const show = (v) => (ArrayBuffer.isView(v) ? Array.from(v).join(", ") : String(v));

const [file = "build/add.wasm", fn = "add", ...rawArgs] = process.argv.slice(2);
// `<stem>.mjs` next to the module is the marshalling loader `--emit-dts` generated.
const companion = path.resolve(file).replace(/\.wasm$/i, ".mjs");
const loader = existsSync(companion) ? (await import(pathToFileURL(companion))).load : load;
const exports = await loader(readFileSync(file));
if (typeof exports[fn] !== "function") {
  console.error(`${file} does not export a function named ${fn}`);
  process.exit(1);
}
const args = rawArgs.length > 0 ? rawArgs.map(parseArg) : [2, 3];
console.log(`${fn}(${args.map(show).join(", ")}) = ${show(exports[fn](...args))}`);
