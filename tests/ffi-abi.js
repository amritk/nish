// #1755's native round trip: a `u8`, `u16` or `boolean` crossing a `declare
// function` is widened by the caller, as the x86-64 SysV and Apple arm64 ABIs
// require, so a callee clang compiled apart reads 255 for `toU8(511)`. The
// callees of tests/cases/ffi_narrow_zeroext.c are built into a shared object
// of their own, so no LTO or inlining can widen the value for the caller, and
// the program is linked against it under `--profile speed`. It lives beside
// `tests/run.js`, which calls `runFfiAbiChecks` with its own helpers, so that
// file stays under Biome's size limit.
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { withAllowPanics } from "./allow-panics.js"

/**
 * Runs the check under `tests/run.js`'s filter: `only`, when set, is matched
 * against the group's name as `tests/run.js` matches its own sections.
 */
export const runFfiAbiChecks = ({ only, has, check, skip, shown, nish, root, buildDir }) => {
  // A fixture may panic on purpose, so a build takes `--allow-panics` from a
  // compiler that lists it (tests/allow-panics.js).
  const nishSync = (args, options) => spawnSync(nish, withAllowPanics(nish, args), options)
  if (only && !"ffi_narrow_zeroext ffi_abi shared object".includes(only)) {
    return
  }
  const name =
    "ffi_narrow_zeroext: a shared object clang built apart reads 255 for toU8(511) under --profile speed"
  if (!has("clang")) {
    skip(`skipped: ${name}: no clang to build the shared object`)
    return
  }
  const dir = path.join(buildDir, "ffi-abi")
  fs.mkdirSync(dir, { recursive: true })
  const caseDir = path.join(root, "tests", "cases")
  const source = path.join(caseDir, "ffi_narrow_zeroext.ts")
  const driver = path.join(caseDir, "ffi_narrow_zeroext.c")
  const ll = path.join(dir, "ffi_narrow_zeroext.ll")
  const compiled = nishSync([source, "-o", ll], { cwd: root, encoding: "utf8" })
  const lib = path.join(dir, "libnarrow.so")
  const shared =
    compiled.status === 0
      ? spawnSync("clang", ["-O2", "-shared", "-fPIC", "-DNARROW_CALLEES_ONLY", driver, "-o", lib], {
          encoding: "utf8",
        })
      : compiled
  const mainOnly = path.join(dir, "main_only.c")
  fs.writeFileSync(mainOnly, `#define NARROW_MAIN_ONLY 1\n#include ${JSON.stringify(driver)}\n`)
  const exe = path.join(dir, "narrow")
  const linked =
    shared.status === 0
      ? spawnSync(
          "bash",
          [
            "scripts/build.sh",
            ll,
            "runtime/runtime.c",
            mainOnly,
            `-L${dir}`,
            "-lnarrow",
            `-Wl,-rpath,${dir}`,
            "-o",
            exe,
            "--profile",
            "speed",
          ],
          { cwd: root, encoding: "utf8" }
        )
      : shared
  const ran = linked.status === 0 ? spawnSync(exe, [], { encoding: "utf8" }) : linked
  const want = fs.readFileSync(path.join(caseDir, "ffi_narrow_zeroext.out"), "utf8")
  check(
    name,
    ran.status === 0 && ran.stdout === want,
    `${shown(ran)}\n--- want\n${want}--- got\n${ran.stdout ?? ""}`
  )
}
