// The compile worker: one Nish compilation per message, each in a fresh
// instance of `nish.wasm` over an in-memory filesystem.
//
// The worker is written against the browser Worker API (`self.onmessage`,
// `postMessage`) and bridged onto `node:worker_threads` at the bottom, so the
// same file is what a page loads and what `web/compile.mjs` drives. Nothing
// above the bridge is Node-specific.
//
// Protocol — one request, one reply, matched by `id`:
//
//   in   { id, files: { "main.ts": "<source>" }, args?: ["--number-mode", "f64"],
//          entry?: "main.ts", output?: "main.ll" }
//   out  { id, status, stdout, stderr, files: { "main.ll": "<ir>" } }
//
// `status` is the compiler's exit code: 0 wrote IR, 1 refused the program with
// diagnostics on stderr, 2 a usage error, 3 a toolchain failure, 70 an internal
// one — a trap included, since a page should see that as a compiler bug rather
// than as a dead worker. Everything the compiler wrote is in `files`, so a page
// can show the `.ll` and any sidecar (`--emit-header`, `--emit-dts`) it asked for.
//
// A compile gets its own instance because the arena only grows and `proc_exit`
// ends the instance that ran it; compiling the module once and instantiating it
// per request keeps the expensive half cached.

import { MemoryFileSystem, WasiHost } from "./wasi.mjs";

/** The compiled module, set by the first `{ wasm }` message and kept. */
let compiled = null;

/** `WebAssembly.compile` the module once; every later compile reuses it. */
const load = async (source) => {
  if (source instanceof WebAssembly.Module) return source;
  if (typeof source === "string") return WebAssembly.compileStreaming(fetch(source));
  return WebAssembly.compile(source);
};

const compile = async (request) => {
  const { id, files, args = [], entry = "main.ts", output = "main.ll" } = request;
  const fs = new MemoryFileSystem(files);
  const host = new WasiHost({ args: ["nish", entry, "-o", output, ...args], fs });
  // `instantiate` given a Module (rather than bytes) resolves to the Instance itself.
  const instance = await WebAssembly.instantiate(compiled, host.imports());
  let status;
  try {
    status = host.start(instance);
  } catch (error) {
    // A trap is a compiler bug, not a rejected program: report it as one
    // rather than letting the worker die silently on the page.
    return {
      id,
      status: 70,
      stdout: host.stdoutText,
      stderr: `${host.stderrText}nish.wasm trapped: ${error?.message ?? error}\n`,
      files: {},
    };
  }
  const written = fs.toText();
  for (const name of Object.keys(files)) delete written[name];
  return { id, status, stdout: host.stdoutText, stderr: host.stderrText, files: written };
};

/** Handle one message; `{ wasm }` loads the module, anything else compiles. */
export const handle = async (message) => {
  if (message.wasm !== undefined) {
    compiled = await load(message.wasm);
    return { id: message.id, ready: true };
  }
  if (compiled === null) throw new Error("worker: send { wasm } before the first compile request");
  return await compile(message);
};

// ---- The two host bindings ---------------------------------------------------
// A browser worker talks through `self`; a Node worker through `parentPort`.
// Neither branch runs when the module is merely imported, so `handle` is also
// callable directly by anything that would rather not spawn a worker at all.
if (typeof self !== "undefined" && typeof self.postMessage === "function" && typeof window === "undefined") {
  self.onmessage = async (event) => {
    self.postMessage(await handle(event.data));
  };
} else if (typeof process !== "undefined" && process.versions?.node) {
  const { parentPort } = await import("node:worker_threads");
  parentPort?.on("message", async (message) => {
    parentPort.postMessage(await handle(message));
  });
}
