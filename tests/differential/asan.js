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
 * attribute, and nish emits none. The module's own inline bump allocator,
 * `nish_alloc_struct`, is replaced by a call to the runtime's
 * `nish_asan_alloc`, which gives every block a malloc of its own and poisons
 * the bytes the 8-byte rounding adds; without that a literal or
 * `new Array(n)` shares a chunk with its neighbours and a read past it is
 * invisible. The link is done by hand here rather than
 * through `scripts/build.sh`, which has no sanitizer profile.
 *
 * A run is classified as one of
 *   - `asan`: AddressSanitizer reported, which is a memory error;
 *   - `ubsan`: the C runtime hit undefined behaviour;
 *   - `panic`: the program stopped on one of its own checks (an index, a
 *     slice, arithmetic, out of memory);
 *   - `timeout`: it ran past the time limit and was killed;
 *   - `signal`: it died on a signal with no sanitizer report;
 *   - `error`: it exited non-zero without a known panic message;
 *   - `clean`: it exited with status 0 and none of the above.
 * Only `clean` exits 0; every other kind, and a program the compiler
 * refuses, exits 1. A file with no `export const main` is skipped (exit 0).
 *
 * Usage: node tests/differential/asan.js <file.ts> [--compiler <nish>] [--unchecked] [--threads] [--exe <path>]
 *        node tests/differential/asan.js --self-test [--compiler <nish>]
 *
 * The self-test reads one past the end of arrays built every way the compiler
 * allocates them (push, a literal, `new Array(n)`, 8-, 4- and 1-byte elements)
 * in a build with `--unchecked-indexing`, which no check can stop, and fails
 * unless ASan reports each; it also runs the in-bounds twins, which must come
 * out clean, and a checked build, which must panic. A C driver then checks
 * that the runtime's `nish_array_grow` moves a block at the push a normal
 * build would, after the arena forgot other blocks or grew many.
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
  const probe = path.join(asanDir, `probe-${process.pid}.c`)
  fs.writeFileSync(probe, "int main(void) { return 0; }\n")
  const exe = path.join(asanDir, `probe-${process.pid}`)
  const ok = run("clang", ["-fsanitize=address,undefined", probe, "-o", exe]).status === 0
  fs.rmSync(probe, { force: true })
  fs.rmSync(exe, { force: true })
  return ok
}

/**
 * `ir` with every defined function opted into ASan. A function may name more
 * than one attribute group, so the extra group goes onto each `define` line
 * whatever it already carries, and the declarations (the runtime's functions,
 * compiled with ASan on their own) are left alone. Each module's inline-bump
 * `nish_alloc_struct` becomes a call to the runtime's `nish_asan_alloc`; a
 * module whose definition no longer has the form matched here gives `null`.
 */
const instrument = (ir) => {
  let out = ir.replace(/^(define [^\n]*?)\s*\{$/gm, `$1 ${ASAN_GROUP} {`)
  const bump = /^(define internal [^\n]*@nish_alloc_struct\(i64 noundef %size\)[^\n]*\{)\n[\s\S]*?^\}$/m
  if (bump.test(out)) {
    out = out.replace(bump, "$1\n  %p = call i8* @nish_asan_alloc(i64 %size)\n  ret i8* %p\n}")
    out += "declare i8* @nish_asan_alloc(i64)\n"
  } else if (/^define [^\n]*@nish_alloc_struct\(/m.test(out)) {
    // Left alone, the inline bump would hide every literal's overflow again.
    return null
  }
  return `${out}\nattributes ${ASAN_GROUP} = { sanitize_address }\n`
}

/**
 * The sanitized runtime objects, compiled once per set of sources and flags
 * and kept under build/test/differential/asan/ for the next run.
 */
const runtimeObjects = (threads) => {
  const flags = ["-c", "-g", "-O1", "-fno-omit-frame-pointer", "-fsanitize=address,undefined", "-DNISH_ASAN"]
  if (threads) {
    flags.push("-DNISH_THREADS=1", "-ftls-model=initial-exec", "-pthread")
  }
  // The clang version too: a cached object from another toolchain may not link.
  const hash = crypto
    .createHash("sha256")
    .update(flags.join(" "))
    .update(run("clang", ["--version"]).stdout ?? "")
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
    const tmp = `${objects[i]}.${process.pid}.tmp`
    const res = run("clang", [...flags, RUNTIME_UNITS[i], "-o", tmp])
    if (res.status !== 0) {
      return { error: `compiling ${path.basename(RUNTIME_UNITS[i])} with ASan failed:\n${res.stderr}` }
    }
    fs.renameSync(tmp, objects[i])
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
  const asanLls = []
  for (const name of fs.readdirSync(modules).filter((n) => n.endsWith(".ll"))) {
    const ir = instrument(fs.readFileSync(path.join(modules, name), "utf8"))
    if (ir === null) {
      return {
        error: `${name} defines @nish_alloc_struct in a form asan.js cannot rewrite; update instrument()`,
      }
    }
    const asanLl = path.join(modules, name.replace(/\.ll$/, ".asan.ll"))
    fs.writeFileSync(asanLl, ir)
    asanLls.push(asanLl)
  }
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
 * Which outcome a finished run is. ASan wins over everything, since a memory
 * error can go on to cause a panic; UBSan's reports do not stop the program,
 * so a run that also panics is still `ubsan`. A UBSan report is matched by the
 * `SUMMARY: UndefinedBehaviorSanitizer: ` line it ends with, at the start of a
 * line, or by its `runtime/<file>:line:col: runtime error: ` anywhere in one,
 * so a report after a partial line from another thread still counts.
 * Only the C runtime is built with UBSan, so a report names one of its files;
 * a program printing `runtime error:` on its own does not.
 */
const classify = ({ status, signal, stdout = "", stderr = "" }) => {
  const firstLine = (pattern) => stderr.split("\n").find((line) => pattern.test(line)) ?? ""
  if (/ERROR: AddressSanitizer/.test(stderr)) {
    return { kind: "asan", status, detail: firstLine(/ERROR: AddressSanitizer/) }
  }
  const ubsan = /^SUMMARY: UndefinedBehaviorSanitizer: |runtime\/[\w-]+\.[ch]:\d+:\d+: runtime error: /m
  if (ubsan.test(stderr)) {
    return { kind: "ubsan", status, detail: firstLine(ubsan) }
  }
  // The compiler's and the runtime's own checks; a program's `panic(...)` has
  // a message of its own and comes out as `error`.
  const panic =
    /^(index out of range|slice out of range|array length out of range|attempt to |value out of range: |parallelMapInto: |spawn: destination index |crypto\.getRandomValues: |nish: out of memory|`[^`\n]+`(: argument \d+ \(| returned NULL for a `string` result))/m
  if (status === 1 && panic.test(stderr)) {
    return { kind: "panic", status, detail: firstLine(panic), stdout }
  }
  if (signal) {
    return { kind: "signal", status, signal, detail: signal, stdout }
  }
  if (status !== 0) {
    return { kind: "error", status, detail: `exit ${status}: ${stderr.trim().split("\n")[0] ?? ""}`, stdout }
  }
  return { kind: "clean", status, stdout }
}

/** Run `exe` under the sanitizers and classify how it ended. */
const runExe = (exe, timeoutMs = 20000, args = []) => {
  const res = run(exe, args, {
    timeout: timeoutMs,
    env: {
      ...process.env,
      // The arena's chunks live until exit by design; a leak report is noise.
      ASAN_OPTIONS: "detect_leaks=0:abort_on_error=0:symbolize=1",
      UBSAN_OPTIONS: "print_stacktrace=1",
    },
  })
  if (res.error?.code === "ETIMEDOUT") {
    return { kind: "timeout", status: null, detail: `killed after ${timeoutMs} ms`, stdout: res.stdout ?? "" }
  }
  return classify(res)
}

/** Build and run in one: `{ kind, ... }`, or the `build` refusal or error. */
const runUnderAsan = (file, opts) => {
  fs.mkdirSync(asanDir, { recursive: true })
  // Named by the whole path: every tests/link/*/main.ts has the same basename.
  const tag = crypto.createHash("sha256").update(path.resolve(file)).digest("hex").slice(0, 8)
  const exe = opts.exe ?? path.join(asanDir, `${path.basename(file, ".ts")}-${tag}`)
  const built = build(file, exe, opts)
  if (built.exe === undefined) {
    return built
  }
  return runExe(built.exe, opts.timeoutMs)
}

/**
 * The self-test's programs. Each builds a 5- or 6-element array one way the
 * compiler allocates arrays and reads `a[i]` for `i <= a.length` when `past`
 * is set: one element past the end. The builders sit in a function of their
 * own so the array escapes into the arena whatever escape analysis decides.
 * Five 4-byte or 1-byte elements leave rounding slack the read lands in, which
 * only the poisoning sees.
 */
const SELF_TEST_ARRAYS = {
  push: {
    type: "number[]",
    make: "const a: number[] = []\n  for (let i = 0; i < 6; i++) {\n    a.push(i * 3)\n  }",
  },
  literal: { type: "number[]", builder: "(n: number): number[] => [1, 2, 3, n, 5]", arg: "4" },
  "new-array": { type: "number[]", builder: "(n: number): number[] => new Array<number>(n)", arg: "5" },
  f64: { type: "f64[]", builder: "(n: f64): f64[] => [1.5, 2.5, n, 4.5, 5.5]", arg: "3.5" },
  i32: { type: "i32[]", builder: "(n: i32): i32[] => [1, 2, 3, n, 5]", arg: "4" },
  u8: {
    type: "u8[]",
    builder: "(n: u8): u8[] => [1, 2, 3, n, 5]",
    arg: "toU8(4)",
    read: (e) => `toI32(${e})`,
  },
}

const selfTestSource = (shape, past) => {
  const spec = SELF_TEST_ARRAYS[shape]
  const read = spec.read ?? ((e) => e)
  const make = spec.make ?? `const a = make(${spec.arg})`
  const sum = spec.type === "f64[]" ? "let s: f64 = 0" : "let s: i32 = 0"
  return `${spec.builder ? `const make = ${spec.builder}\n` : ""}export const main = (): void => {
  ${make}
  ${sum}
  for (let i = 0; i ${past ? "<=" : "<"} a.length; i++) {
    s += ${read("a[i]")}
  }
  console.log(s)
}
`
}

/**
 * The runtime's own self-test: a C driver over `nish_array_grow`, since no Nish
 * program the checker accepts keeps a pointer into an array across a push. It
 * pushes an array to 10 elements, then either grows 200 other arrays or grows
 * 20 and releases the arena back to before them, then pushes on to `at` elements and
 * reads through a pointer taken before one more push. A normal build moves the
 * block at the 17th and the 33rd push, so a pointer kept across either must
 * read poison and one kept across the 16th or the 32nd must not. A grow that
 * lost what it knew of the array, as a table that evicts or a release that
 * forgets every entry did, moved it at the 11th, 21st and 41st instead.
 */
const GROW_DRIVER = `#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
typedef struct { uint64_t len, cap; char *data; } nish_array;
void nish_array_grow(nish_array *a, uint64_t elem_size);
uint64_t nish_arena_mark(void);
void nish_arena_release(uint64_t mark);
void *nish_alloc_struct(uint64_t size);
static void push(nish_array *a, int64_t v) {
  if (a->len == a->cap) nish_array_grow(a, 8);
  ((int64_t *)a->data)[a->len++] = v;
}
static nish_array others[200];
int main(int argc, char **argv) {
  if (argc != 3) return 2;
  int at = atoi(argv[2]);
  nish_array a = { 0, 0, 0 };
  while (a.len < 10) push(&a, 1);
  uint64_t mark = nish_arena_mark();
  for (int k = 0; k < (argv[1][0] == 'e' ? 200 : 20); k++) push(&others[k], k);
  if (argv[1][0] == 'r') nish_arena_release(mark);
  while ((int)a.len < at) push(&a, 1);
  volatile int64_t *kept = (int64_t *)a.data;
  push(&a, 2);
  printf("%lld\\n", (long long)kept[0]);
  return 0;
}
`

const growCases = (dir) => {
  const src = path.join(dir, "grow.c")
  const exe = path.join(dir, "grow")
  fs.writeFileSync(src, GROW_DRIVER)
  const rt = runtimeObjects(false)
  const linked =
    rt.error === undefined
      ? run("clang", [
          "-g",
          "-O1",
          "-fsanitize=address,undefined",
          src,
          ...rt.objects,
          "-lm",
          "-pthread",
          "-o",
          exe,
        ])
      : { status: 1, stderr: rt.error }
  return [
    ["evicted", "e", 15, "clean"],
    ["evicted", "e", 16, "asan"],
    ["released", "r", 31, "clean"],
    ["released", "r", 32, "asan"],
  ].map(([what, mode, at, want]) => ({
    name: `grow-${what}-kept-across-push-${at + 1}`,
    want,
    res: linked.status === 0 ? runExe(exe, 20000, [mode, String(at)]) : { error: linked.stderr },
  }))
}

const selfTest = (compiler) => {
  const dir = path.join(asanDir, `self-test-${process.pid}`)
  fs.mkdirSync(dir, { recursive: true })
  const cases = []
  for (const shape of Object.keys(SELF_TEST_ARRAYS)) {
    cases.push({ name: `${shape}-one-past`, shape, past: true, unchecked: true, want: "asan" })
    cases.push({ name: `${shape}-in-bounds`, shape, past: false, unchecked: true, want: "clean" })
  }
  cases.push({ name: "push-one-past-checked", shape: "push", past: true, unchecked: false, want: "panic" })
  let failed = 0
  const ran = cases.map((c) => {
    const file = path.join(dir, `${c.name}.ts`)
    fs.writeFileSync(file, selfTestSource(c.shape, c.past))
    return {
      ...c,
      res: runUnderAsan(file, { compiler, unchecked: c.unchecked, exe: path.join(dir, c.name) }),
    }
  })
  for (const c of [...ran, ...growCases(dir)]) {
    const res = c.res
    const got = res.kind ?? (res.rejected ? "rejected" : "error")
    const ok = got === c.want
    console.log(`  ${ok ? "ok  " : "FAIL"} ${c.name}: ${got}${res.detail ? ` (${res.detail.trim()})` : ""}`)
    if (!ok) {
      failed++
      if (res.error !== undefined || res.stderr !== undefined) {
        console.log(String(res.error ?? res.stderr).trim())
      }
    }
  }
  fs.rmSync(dir, { recursive: true, force: true })
  return failed
}

export { build, classify, hasAsanRuntime, instrument, runExe, runtimeObjects, runUnderAsan }

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2)
  let compilerSpec = null
  let file = null
  let self = false
  let unchecked = false
  let threads = false
  let exe
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--compiler") {
      compilerSpec = argv[++i]
    } else if (argv[i] === "--exe") {
      exe = path.resolve(argv[++i])
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
  if (!/^export const main\b/m.test(fs.readFileSync(file, "utf8"))) {
    console.log("skipped: no `export const main`")
    process.exit(0)
  }
  if (exe !== undefined) {
    fs.mkdirSync(path.dirname(exe), { recursive: true })
  }
  const res = runUnderAsan(path.resolve(file), { compiler, unchecked, threads, exe })
  if (res.rejected) {
    console.log(`rejected: ${String(res.stderr).trim().split("\n")[0]}`)
    process.exit(1)
  }
  if (res.kind === undefined) {
    console.error(res.error)
    process.exit(2)
  }
  console.log(`${res.kind}${res.detail ? `: ${res.detail.trim()}` : ""}`)
  process.exit(res.kind === "clean" ? 0 : 1)
}
