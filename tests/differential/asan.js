#!/usr/bin/env node
/**
 * Build and run a Nish program under AddressSanitizer (#883).
 *
 * The checked build panics before it reads past an array, so a bounds check
 * the compiler drops by mistake is invisible there: the program reads a
 * neighbour's bytes and carries on. This harness links the program against a
 * runtime compiled with `-DNISH_ASAN` (runtime/runtime.c, "AddressSanitizer
 * build"), where every arena block is its own exact malloc, so the same read
 * lands in ASan's redzone and is reported. The C runtime also gets
 * `-fsanitize=undefined`.
 *
 * The compiled program is instrumented by adding `sanitize_address` to every
 * function the IR defines: ASan only touches functions that carry the
 * attribute, and nish emits none. The link is done by hand here rather than
 * through `scripts/build.sh`, which has no sanitizer profile.
 *
 * A run is classified as one of
 *   - `asan`: AddressSanitizer reported, which is a memory error;
 *   - `ubsan`: the C runtime hit undefined behaviour;
 *   - `panic`: the program stopped on one of its own checks (an index, a
 *     slice, arithmetic, out of memory);
 *   - `clean`: it exited without any of those (`status` says with what).
 *
 * Usage: node tests/differential/asan.js <file.ts> [--compiler <nish>] [--unchecked] [--threads]
 *        node tests/differential/asan.js --self-test [--compiler <nish>]
 *
 * The self-test reads one past the end of an arena array in a build with
 * `--unchecked-indexing`, which no check can stop, and fails unless ASan
 * reports it; it also runs the in-bounds twin, which must come out clean.
 * Without clang's ASan runtime (Debian: `libclang-rt-18-dev`) it says so and
 * exits 2 instead of passing.
 */
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import * as lib from "./lib.js"

const runtimeDir = path.join(lib.root, "runtime")
const asanDir = path.join(lib.buildDir, "asan")

/**
 * The runtime units `scripts/build.sh` links into every native program.
 * runtime-wasm.c is the WASI build's and is never linked here.
 */
const RUNTIME_UNITS = [
  "",
  "-os",
  "-parallel",
  "-cross",
  "-host",
  "-net",
  "-simd",
  "-aes",
  "-term",
  "-bytes",
].map((suffix) => path.join(runtimeDir, `runtime${suffix}.c`))

/** The attribute group the instrumented IR adds to every definition. */
const ASAN_GROUP = "#9999"

const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 64 << 20, ...opts })

/**
 * Whether clang can link an ASan program at all. The sanitizer runtime is a
 * separate package on Debian, and without it every link fails with a missing
 * `libclang_rt.asan`; the caller says that once rather than per program.
 */
const hasAsanRuntime = () => {
  if (!lib.hasClang()) {
    return false
  }
  fs.mkdirSync(asanDir, { recursive: true })
  const probe = path.join(asanDir, "probe.c")
  fs.writeFileSync(probe, "int main(void) { return 0; }\n")
  return run("clang", ["-fsanitize=address,undefined", probe, "-o", path.join(asanDir, "probe")]).status === 0
}

/**
 * `ir` with every defined function opted into ASan. A function may name more
 * than one attribute group, so the extra group goes onto each `define` line
 * whatever it already carries, and the declarations (the runtime's functions,
 * compiled with ASan on their own) are left alone.
 */
const instrument = (ir) =>
  `${ir.replace(/^(define [^\n]*?)\s*\{$/gm, `$1 ${ASAN_GROUP} {`)}\nattributes ${ASAN_GROUP} = { sanitize_address }\n`

/**
 * The sanitized runtime objects, compiled once per set of sources and flags
 * and kept under build/test/differential/asan/ for the next run.
 */
const runtimeObjects = (threads) => {
  const flags = ["-c", "-g", "-O1", "-fno-omit-frame-pointer", "-fsanitize=address,undefined", "-DNISH_ASAN"]
  if (threads) {
    flags.push("-DNISH_THREADS=1", "-ftls-model=initial-exec", "-pthread")
  }
  const hash = crypto.createHash("sha256").update(flags.join(" "))
  for (const unit of RUNTIME_UNITS) {
    hash.update(fs.readFileSync(unit))
  }
  for (const header of fs.readdirSync(runtimeDir).filter((f) => f.endsWith(".h"))) {
    hash.update(fs.readFileSync(path.join(runtimeDir, header)))
  }
  const dir = path.join(asanDir, `runtime-${hash.digest("hex").slice(0, 16)}`)
  const objects = RUNTIME_UNITS.map((unit) => path.join(dir, `${path.basename(unit, ".c")}.o`))
  if (objects.every((o) => fs.existsSync(o))) {
    return { objects }
  }
  fs.mkdirSync(dir, { recursive: true })
  for (let i = 0; i < RUNTIME_UNITS.length; i++) {
    const res = run("clang", [...flags, RUNTIME_UNITS[i], "-o", `${objects[i]}.tmp`])
    if (res.status !== 0) {
      return { error: `compiling ${path.basename(RUNTIME_UNITS[i])} with ASan failed:\n${res.stderr}` }
    }
    fs.renameSync(`${objects[i]}.tmp`, objects[i])
  }
  return { objects }
}

/**
 * Compile `file` with `compiler` (a `lib.compilerFor` result) and link it under
 * ASan into `exe`. `unchecked` builds with `--unchecked-indexing`, `threads`
 * with `--threads`. The compiler writes one `.ll` per module (a program that
 * imports `nish/threads` has two) and each is instrumented. Returns `{ exe }`,
 * `{ rejected, stderr }` when the compiler refuses the program, or `{ error }`
 * when the toolchain fails.
 */
const build = (file, exe, { compiler, unchecked = false, threads = false }) => {
  const modules = `${exe}.modules`
  fs.rmSync(modules, { recursive: true, force: true })
  const args = [...compiler.prefix, file, "-o", `${modules}/`]
  if (unchecked) {
    args.push("--unchecked-indexing")
  }
  if (threads) {
    args.push("--threads")
  }
  const compiled = run(compiler.cmd, args)
  if (compiled.status !== 0) {
    return { rejected: true, stderr: compiled.stderr }
  }
  const asanLls = fs
    .readdirSync(modules)
    .filter((name) => name.endsWith(".ll"))
    .map((name) => {
      const asanLl = path.join(modules, name.replace(/\.ll$/, ".asan.ll"))
      fs.writeFileSync(asanLl, instrument(fs.readFileSync(path.join(modules, name), "utf8")))
      return asanLl
    })
  const rt = runtimeObjects(threads)
  if (rt.error !== undefined) {
    return { error: rt.error }
  }
  const link = [
    "-g",
    "-O1",
    "-fno-omit-frame-pointer",
    "-fsanitize=address,undefined",
    "-Wno-override-module",
    ...asanLls,
    ...rt.objects,
    "-lm",
    "-pthread",
    "-o",
    exe,
  ]
  const linked = run("clang", link)
  if (linked.status !== 0) {
    return { error: `linking ${path.basename(file)} under ASan failed:\n${linked.stderr}` }
  }
  return { exe }
}

/**
 * Which of the four outcomes a finished run is. ASan wins over everything,
 * since a memory error can go on to cause a panic; UBSan's reports do not stop
 * the program, so a run that also panics is still `ubsan`.
 */
const classify = ({ status, signal, stdout = "", stderr = "" }) => {
  const firstLine = (pattern) => stderr.split("\n").find((line) => pattern.test(line)) ?? ""
  if (/ERROR: AddressSanitizer/.test(stderr)) {
    return { kind: "asan", status, detail: firstLine(/ERROR: AddressSanitizer/) }
  }
  if (/runtime error:/.test(stderr)) {
    return { kind: "ubsan", status, detail: firstLine(/runtime error:/) }
  }
  const panic = /^(index out of range|slice out of range|attempt to |parallelMapInto: |nish: out of memory)/m
  if (status === 1 && panic.test(stderr)) {
    return { kind: "panic", status, detail: firstLine(panic), stdout }
  }
  return { kind: "clean", status, signal, stdout }
}

/** Run `exe` under the sanitizers and classify how it ended. */
const runExe = (exe, timeoutMs = 20000) => {
  const res = run(exe, [], {
    timeout: timeoutMs,
    env: {
      ...process.env,
      // The arena's chunks live until exit by design; a leak report is noise.
      ASAN_OPTIONS: "detect_leaks=0:abort_on_error=0:symbolize=1",
      UBSAN_OPTIONS: "print_stacktrace=1",
    },
  })
  if (res.error?.code === "ETIMEDOUT") {
    return { kind: "clean", status: null, signal: "SIGTERM", timedOut: true, stdout: res.stdout ?? "" }
  }
  return classify(res)
}

/** Build and run in one: `{ kind, ... }`, or the `build` refusal or error. */
const runUnderAsan = (file, opts) => {
  fs.mkdirSync(asanDir, { recursive: true })
  const exe = opts.exe ?? path.join(asanDir, path.basename(file, ".ts"))
  const built = build(file, exe, opts)
  if (built.exe === undefined) {
    return built
  }
  return runExe(built.exe, opts.timeoutMs)
}

/**
 * The self-test's program. The array is filled by `push`, so it lives in the
 * arena whatever escape analysis decides, and the loop reads `a[i]` for
 * `i <= a.length` when `past` is set: one element past the end.
 */
const selfTestSource = (past) => `export const main = (): void => {
  const a: number[] = []
  for (let i = 0; i < 6; i++) {
    a.push(i * 3)
  }
  let s = 0
  for (let i = 0; i ${past ? "<=" : "<"} a.length; i++) {
    s += a[i]
  }
  console.log(s)
}
`

const selfTest = (compiler) => {
  const dir = path.join(asanDir, "self-test")
  fs.mkdirSync(dir, { recursive: true })
  const cases = [
    { name: "one-past", past: true, unchecked: true, want: "asan" },
    { name: "in-bounds", past: false, unchecked: true, want: "clean" },
    { name: "one-past-checked", past: true, unchecked: false, want: "panic" },
  ]
  let failed = 0
  for (const c of cases) {
    const file = path.join(dir, `${c.name}.ts`)
    fs.writeFileSync(file, selfTestSource(c.past))
    const res = runUnderAsan(file, { compiler, unchecked: c.unchecked, exe: path.join(dir, c.name) })
    const got = res.kind ?? (res.rejected ? "rejected" : "error")
    const ok = got === c.want && (got !== "clean" || res.status === 0)
    console.log(`  ${ok ? "ok  " : "FAIL"} ${c.name}: ${got}${res.detail ? ` (${res.detail.trim()})` : ""}`)
    if (!ok) {
      failed++
      if (res.error !== undefined || res.stderr !== undefined) {
        console.log(String(res.error ?? res.stderr).trim())
      }
    }
  }
  return failed
}

export { build, classify, hasAsanRuntime, instrument, runExe, runUnderAsan }

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2)
  let compilerSpec = null
  let file = null
  let self = false
  let unchecked = false
  let threads = false
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--compiler") {
      compilerSpec = argv[++i]
    } else if (argv[i] === "--self-test") {
      self = true
    } else if (argv[i] === "--unchecked") {
      unchecked = true
    } else if (argv[i] === "--threads") {
      threads = true
    } else if (!argv[i].startsWith("-") && file === null) {
      file = argv[i]
    } else {
      console.error(`unknown option: ${argv[i]}`)
      process.exit(2)
    }
  }
  if (!self && file === null) {
    console.error("usage: node tests/differential/asan.js <file.ts> | --self-test [--compiler <nish>]")
    process.exit(2)
  }
  const compiler = lib.compilerFor(compilerSpec)
  if (compiler.error !== undefined) {
    console.error(compiler.error)
    process.exit(2)
  }
  if (!hasAsanRuntime()) {
    console.error("asan: clang cannot link -fsanitize=address here (install libclang-rt-18-dev)")
    process.exit(2)
  }
  if (self) {
    console.log(`asan self-test with ${compiler.label}`)
    process.exit(selfTest(compiler) === 0 ? 0 : 1)
  }
  const res = runUnderAsan(path.resolve(file), { compiler, unchecked, threads })
  if (res.kind === undefined) {
    console.error(res.error ?? res.stderr)
    process.exit(2)
  }
  console.log(`${res.kind}${res.detail ? `: ${res.detail.trim()}` : ""}`)
  process.exit(res.kind === "clean" ? 0 : 1)
}
