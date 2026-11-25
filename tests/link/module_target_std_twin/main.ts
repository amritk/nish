// WP89 S6: how a build resolves `nish/<name>` when the library has a
// `<name>.wasm32.ts` beside `<name>.ts`. No library module has a twin yet
// (WP89 S7 adds the first), so this drives `Compilation.resolveSpecifier`
// against a library root of its own (`./root/std/`): a wasm32 build takes
// the twin's path and name, a native build keeps the module's, a module with
// no twin is the same in both, and each build compares the pair (NL3063).
import { Suite } from "../../../std/testing"
import { Compilation } from "../../../src/compilation"
import { Options } from "../../../src/options"

const ROOT: string = "tests/link/module_target_std_twin/root"

const build = (target: string): Compilation => {
  const opts = new Options()
  opts.packageRoot = ROOT
  opts.target = target
  return new Compilation(opts)
}

export const main = (): i32 => {
  const t = new Suite("module_target_std_twin")
  const wasm = build("wasm32-unknown-unknown")
  const native = build("")
  const twinWasm = wasm.resolveSpecifier(".", "nish/twin")
  const twinNative = native.resolveSpecifier(".", "nish/twin")
  t.eqStr("a wasm32 build reads the twin's file", twinWasm.path, `${ROOT}/std/twin.wasm32.ts`)
  t.eqStr("a wasm32 build names the module by the twin", twinWasm.name, "std/twin.wasm32.ts")
  t.eqStr("a native build reads the module's own file", twinNative.path, `${ROOT}/std/twin.ts`)
  t.eqStr("a native build names the module by its own name", twinNative.name, "std/twin.ts")
  t.eqStr("a module with no twin is the same file under wasm32", wasm.resolveSpecifier(".", "nish/plain").path, `${ROOT}/std/plain.ts`)
  t.eqStr("a pair that agrees is not refused under wasm32", wasm.twinMismatchOf(twinWasm.path), "")
  t.eqStr("a pair that agrees is not refused natively", native.twinMismatchOf(twinNative.path), "")
  const driftWasm = wasm.resolveSpecifier(".", "nish/drift")
  const driftNative = native.resolveSpecifier(".", "nish/drift")
  t.ok("a drifted pair is refused under wasm32", wasm.twinMismatchOf(driftWasm.path).indexOf("`scale` is") >= 0)
  t.ok("a drifted pair is refused natively", native.twinMismatchOf(driftNative.path).indexOf("`scale` is") >= 0)
  t.eqStr("a module with no twin is never compared", wasm.twinMismatchOf(`${ROOT}/std/plain.ts`), "")
  return t.done()
}
