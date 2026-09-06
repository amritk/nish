// Import a StaticTS module compiled to WebAssembly from ordinary Node.js.
// This is the recommended interop direction: keep hot loops in StaticTS,
// let Node handle I/O and npm packages, and cross the boundary rarely.
//
//   scripts/build.sh build/add.ll -o build/add.wasm --profile wasm
//   node examples/node-host.mjs build/add.wasm
import { readFileSync } from "node:fs";

const file = process.argv[2] ?? "build/add.wasm";
const { instance } = await WebAssembly.instantiate(readFileSync(file), {});
const { add } = instance.exports;
console.log(`add(2, 3) = ${add(2, 3)}`);
