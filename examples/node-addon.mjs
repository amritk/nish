// Load a StaticTS module built as a native Node addon (N-API) and call it.
// Same interop direction as node-host.mjs, but native code instead of wasm:
// full -O3 machine code, the C runtime (strings, arena) linked in, and Node's
// stable ABI so the .node file survives Node upgrades.
//
//   node dist/index.js examples/add.ts -o build/add.ll --emit-napi build/add_napi.c
//   scripts/build.sh build/add.ll runtime/runtime.c build/add_napi.c -o build/add.node --profile napi
//   node examples/node-addon.mjs build/add.node
import { createRequire } from "node:module";
import path from "node:path";

// Addons are CommonJS modules; `createRequire` is the ESM way to load one.
const require = createRequire(import.meta.url);
const file = path.resolve(process.argv[2] ?? "build/add.node");
const addon = require(file);

console.log(`add(2, 3) = ${addon.add(2, 3)}`);
// The shim type-checks every argument and throws a TypeError otherwise.
try {
  addon.add("2", 3);
} catch (err) {
  console.log(`add("2", 3) throws: ${err.message}`);
}
