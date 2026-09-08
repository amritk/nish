// Run an AmritScript program built with `scripts/build.sh --profile wasi` under
// Node's WASI implementation (no wasmtime needed):
//
//   amritc examples/argv.ts --link build/argv.wasm --profile wasi
//   node examples/wasi-host.mjs build/argv.wasm 3 4 five
//
// The module's `_start` runs the C `main`, so stdout, process.exit codes, the
// working directory (preopened as `.`, which is what readFileSync/writeFileSync
// paths resolve against) and process.argv (argv[0] is the module path, like
// the native binary) all behave as in the native build. The process exit
// status is the program's return value.
import { readFileSync } from "node:fs";
import { WASI } from "node:wasi";

const [module, ...args] = process.argv.slice(2);
if (!module) {
  console.error("usage: node examples/wasi-host.mjs <program.wasm> [args...]");
  process.exit(2);
}
const wasi = new WASI({
  version: "preview1",
  args: [module, ...args],
  env: {},
  preopens: { ".": "." },
  returnOnExit: true,
});
const compiled = await WebAssembly.compile(readFileSync(module));
const instance = await WebAssembly.instantiate(compiled, wasi.getImportObject());
process.exitCode = wasi.start(instance);
