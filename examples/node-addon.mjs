// Load an AmritScript module built as a native Node addon (N-API) and call it.
// Same interop direction as node-host.mjs, but native code instead of wasm:
// full -O3 machine code, the C runtime (strings, arena) linked in, and Node's
// stable ABI so the .node file survives Node upgrades.
//
//   node dist/index.js examples/add.ts -o build/add.ll --emit-napi build/add_napi.c
//   scripts/build.sh build/add.ll runtime/runtime.c build/add_napi.c -o build/add.node --profile napi
//   node examples/node-addon.mjs build/add.node
//
// The same two commands on examples/arrays.ts give an addon whose functions
// take and return typed arrays. An Int32Array / Float64Array argument is not
// copied: the shim hands the AmritScript function a header over the typed array's
// own bytes, so `fill(xs, 7)` changes `xs` in place; a returned array is a
// fresh typed array. Strings cross as copies (examples/strings.ts).
//
//   node examples/node-addon.mjs build/arrays.node
import { createRequire } from "node:module";
import path from "node:path";

// Addons are CommonJS modules; `createRequire` is the ESM way to load one.
const require = createRequire(import.meta.url);
const file = path.resolve(process.argv[2] ?? "build/add.node");
const addon = require(file);

/** Call `fn`, printing the TypeError the shim throws for a wrong argument. */
function attempt(label, fn) {
  try {
    console.log(`${label} = ${fn()}`);
  } catch (err) {
    console.log(`${label} throws: ${err.message}`);
  }
}

if (typeof addon.add === "function") {
  console.log(`add(2, 3) = ${addon.add(2, 3)}`);
  // The shim type-checks every argument and throws a TypeError otherwise.
  attempt('add("2", 3)', () => addon.add("2", 3));
}
if (typeof addon.scale === "function") {
  const xs = new Float64Array([1, 2, 3]);
  console.log(`sumF64([${xs}]) = ${addon.sumF64(xs)}`);
  console.log(`scale([${xs}], 2) = ${addon.scale(xs, 2)} (${addon.scale(xs, 2).constructor.name})`);
  console.log(`squares(5) = ${addon.squares(5)}`);
  const buf = new Int32Array(4);
  addon.fill(buf, 7); // zero-copy: the addon writes into buf's own bytes
  console.log(`fill(buf, 7) leaves buf = ${buf}`);
  console.log(`sumI64([1n << 40n, 2n]) = ${addon.sumI64(new BigInt64Array([1n << 40n, 2n]))}`);
  attempt("sumF64(new Int32Array(3))", () => addon.sumF64(new Int32Array(3)));
}
if (typeof addon.pick === "function") {
  console.log(`pick(true, "yes", "no") = ${addon.pick(true, "yes", "no")}`);
  attempt("pick(true, 1, \"no\")", () => addon.pick(true, 1, "no"));
}
