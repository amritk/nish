// Import a StaticTS module compiled to WebAssembly from ordinary Node.js.
// This is the recommended interop direction: keep hot loops in StaticTS,
// let Node handle I/O and npm packages, and cross the boundary rarely.
//
//   scripts/build.sh build/add.ll -o build/add.wasm --profile wasm
//   node examples/node-host.mjs build/add.wasm              # add(2, 3) = 5
//   node examples/node-host.mjs build/add.wasm add 40 2     # add(40, 2) = 42
//
// `statictsc --emit-dts add.d.ts` writes typings for the exports; its
// `load(bytes)` declaration is implemented here.
import { readFileSync } from "node:fs";

/** Instantiate a freestanding StaticTS wasm module and return its exports. */
export async function load(bytes) {
  const { instance } = await WebAssembly.instantiate(bytes, {});
  return instance.exports;
}

const [file = "build/add.wasm", fn = "add", ...rawArgs] = process.argv.slice(2);
const exports = await load(readFileSync(file));
if (typeof exports[fn] !== "function") {
  console.error(`${file} does not export a function named ${fn}`);
  process.exit(1);
}
const args = rawArgs.length ? rawArgs.map(Number) : [2, 3];
console.log(`${fn}(${args.join(", ")}) = ${exports[fn](...args)}`);
