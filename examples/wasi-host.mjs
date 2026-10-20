// Run an Nish program built with `scripts/build.sh --profile wasi` under
// Node's WASI implementation (no wasmtime needed):
//
//   nish examples/argv.ts --link build/argv.wasm --profile wasi
//   node examples/wasi-host.mjs build/argv.wasm 3 4 five
//
// The module's `_start` runs the C `main`, so stdout, process.exit codes, the
// working directory (preopened as `.`, which is what readFileSync/writeFileSync
// paths resolve against) and process.argv (argv[0] is the module path, like
// the native binary) all behave as in the native build. The process exit
// status is the program's return value.
//
// Node 22 calls WASI's `fd_write` as a V8 fast API call, and uvwasi's buffer
// for it is reported to V8 as external memory, which can start a full garbage
// collection inside that call; the collector's frame walk then segfaults
// (`InnerPointerToCodeCache::GetCacheEntry`). A long-running module trips it
// after printing a few lines. Turning fast API calls off before any code is
// compiled keeps every call on the slow path, where a collection is safe.
import { readFileSync } from "node:fs"
import { setFlagsFromString } from "node:v8"
import { WASI } from "node:wasi"

// Node 24 stops crashing but still collects inside the call, and no Node
// release fixes it yet; #732 tracks when this line can go.
setFlagsFromString("--no-turbo-fast-api-calls")

const [module, ...args] = process.argv.slice(2)
if (!module) {
  console.error("usage: node examples/wasi-host.mjs <program.wasm> [args...]")
  process.exit(2)
}
const wasi = new WASI({
  version: "preview1",
  args: [module, ...args],
  env: {},
  preopens: { ".": "." },
  returnOnExit: true,
})
const compiled = await WebAssembly.compile(readFileSync(module))
const instance = await WebAssembly.instantiate(compiled, wasi.getImportObject())
process.exitCode = wasi.start(instance)
