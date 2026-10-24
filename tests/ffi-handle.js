// WP40 H1.2's wasm checks (docs/wp40-ffi-buffers-handles.md): the close a
// `using` of a handle class emits, on a `--target wasm32` build and on the
// `--profile wasi` route. They live beside `tests/run.js`, which
// calls `runFfiHandleChecks` with its own helpers, so that file stays under
// Biome's size limit. A record cites each check by its exact name.
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"

/**
 * Runs the checks, each under `tests/run.js`'s filter: `only`, when set, is
 * matched against a group's name as `tests/run.js` matches its own sections.
 */
export const runFfiHandleChecks = ({ only, has, check, skip, shown, nish, root, buildDir, wasiSysroot }) => {
  // WP40 H1.2 on wasm. A `--target wasm32` build of ffi_handle_file assembles,
  // and llc gives its `counted_fclose` the handle's pointer as an i32. The `--profile wasi` route
  // links IR compiled for the host with runtime.c and the case's own driver
  // against wasi-libc, and runs it under Node's WASI: each `File` reads from
  // `fmemopen` there, and the run prints the native expected output, so every
  // exit closes each file once. The freestanding `--profile wasm` route is not
  // used: a handle's constructor hands C a path, and runtime-wasm.c provides
  // no strings.
  if (!only || "ffi_handle wasm".includes(only) || "wasi".includes(only)) {
    const wasmDir = path.join(buildDir, "ffi-handle-wasm")
    fs.mkdirSync(wasmDir, { recursive: true })
    const handleCase = path.join(root, "tests", "cases", "ffi_handle_file.ts")
    const w32Dir = path.join(wasmDir, "wasm32")
    const w32 = spawnSync(nish, [handleCase, "--target", "wasm32", "-o", `${w32Dir}${path.sep}`], {
      cwd: root,
      encoding: "utf8",
    })
    const w32Ll = path.join(w32Dir, "ffi_handle_file.ll")
    const w32As =
      w32.status === 0 ? spawnSync("llvm-as", [w32Ll, "-o", "/dev/null"], { encoding: "utf8" }) : w32
    const w32S = path.join(w32Dir, "ffi_handle_file.s")
    const w32Llc =
      w32As.status === 0 ? spawnSync("llc", ["-O0", w32Ll, "-o", w32S], { encoding: "utf8" }) : w32As
    const asm = w32Llc.status === 0 ? fs.readFileSync(w32S, "utf8") : ""
    const w32Ir = w32.status === 0 ? fs.readFileSync(w32Ll, "utf8") : ""
    check(
      "ffi_handle: a --target wasm32 build passes llvm-as, and llc calls `counted_fclose` with the handle's pointer as an i32",
      w32As.status === 0 &&
        w32Llc.status === 0 &&
        w32Ir.includes('target triple = "wasm32-unknown-unknown"') &&
        w32Ir.includes("declare i32 @counted_fclose(i8*)") &&
        w32Ir.includes("call i32 @counted_fclose(i8* ") &&
        /\.functype\s+counted_fclose \(i32\) -> \(i32\)/.test(asm) &&
        /call\s+counted_fclose\n/.test(asm),
      shown(w32Llc)
    )

    if (wasiSysroot && has("wasm-ld")) {
      const wasiDir = path.join(wasmDir, "wasi")
      const hostBuilt = spawnSync(nish, [handleCase, "-o", `${wasiDir}${path.sep}`], {
        cwd: root,
        encoding: "utf8",
      })
      const wasm = path.join(wasiDir, "handle.wasm")
      const linked =
        hostBuilt.status === 0
          ? spawnSync(
              "bash",
              [
                "scripts/build.sh",
                path.join(wasiDir, "ffi_handle_file.ll"),
                "runtime/runtime.c",
                path.join(root, "tests", "cases", "ffi_handle_file.c"),
                "-o",
                wasm,
                "--profile",
                "wasi",
              ],
              { cwd: root, encoding: "utf8", env: { ...process.env, WASI_SYSROOT: wasiSysroot } }
            )
          : hostBuilt
      const ran =
        linked.status === 0
          ? spawnSync("node", ["--no-warnings", "examples/wasi-host.mjs", wasm], {
              cwd: root,
              encoding: "utf8",
            })
          : linked
      const want = fs.readFileSync(path.join(root, "tests", "cases", "ffi_handle_file.out"), "utf8")
      check(
        `ffi_handle: the \`--profile wasi\` link of ffi_handle_file and its driver (sysroot ${wasiSysroot}) closes each file once and prints the native expected .out under Node's WASI`,
        ran.status === 0 && ran.stdout === want,
        `${shown(ran)}want\n${want}`
      )
    } else {
      skip(
        `skipped: ffi_handle: no WASI sysroot${has("wasm-ld") ? "" : " and no wasm-ld"} (set WASI_SYSROOT): the wasi build of a handle's close is not run`
      )
    }
  }
}
