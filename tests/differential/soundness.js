#!/usr/bin/env node
/**
 * The soundness differential: every program compiled twice by the same
 * compiler, once as usual and once with `--no-elision` (`Options.noElision` in
 * `src/options.ts` lists what that turns off), both linked at `-O2` and run,
 * and the two runs compared. A proof the compiler acted on is one it was
 * allowed to act on only if the program means the same without it, so any
 * difference here -- stdout, the exit status, a signal, or a panic only one
 * side takes -- is a proof that does not hold.
 *
 *   node tests/differential/soundness.js --corpus tests/cases
 *   node tests/differential/soundness.js --seed 20261001 --count 40
 *   node tests/differential/soundness.js --corpus tests/differential/corpus --seed 1 --count 20 --budget 180
 *
 * Options:
 *   --corpus <dir>     a directory of programs (repeatable); see "Which programs run"
 *   --seed <n>         the first seed of `--count` programs from fuzz.js's generator
 *   --count <n>        how many generated programs (default 20 when --seed is given)
 *   --depth <n>        the generator's expression depth (default 3, as fuzz.js)
 *   --only <text>      run only the programs whose name contains it
 *   --sample <n>       at most n corpus programs, spread evenly over the sorted list
 *   --threads <n>      programs in flight at once (default: the CPU count, at most 8)
 *   --budget <s>       stop starting programs after this many seconds (default 600);
 *                      the ones not reached are reported, and the run still fails
 *                      only on a difference
 *   --compiler <nish>  the compiler (default build/nish; it has to know the flag,
 *                      so the seed in build/seed will not do)
 *   --run-timeout <s>  the bound on one run of a program (default 30)
 *
 * The link is the one `tests/run.js` gives a case: the module's IR, `clang -O2`,
 * against the runtime compiled once at `-O2`, and `tests/driver.c` (or the
 * case's own `.c`) for a case with no `main` of its own. Not `--link`, whose
 * speed profile is `-O3` with LTO: the reference build is defined at `-O2`.
 *
 * Which programs run. A program is compared when it can run on its own and has
 * one expected run, by this rule:
 *
 * - In `tests/cases`, a `<name>.ts` with a `<name>.out`: exactly the cases the
 *   suite already links and runs, with their `.argv`, `.env` and `.c`.
 *   Skipped, so: an `.err` case (it must not compile), a case with no `.out`
 *   (compile-only: it has no run to compare), and a case whose `.args` name a
 *   `--target` (not a native binary).
 * - In any other directory, a `<name>.ts`, or a `<name>/main.ts`, that exports
 *   `main`, with its `.argv` / `.env` (`argv` / `env` in a directory), as
 *   `tests/differential/run.js` reads them.
 * - Every generated program: each has its own `main` and reads nothing.
 *
 * Skipped everywhere: a program that reads `Arena.used()`. It prints where
 * the arena put its memory, and the reference build places memory differently
 * by design (no arena scopes, no stack allocation), so what it prints is not
 * the program's meaning.
 *
 * The reference compile drops `--deny-panics` and `--deny-retention` from a
 * program's `.args`. Neither changes a byte of the IR (`src/options.ts`), and
 * with every proof forgotten the reference has none left to satisfy them, so
 * it would refuse what the default build accepts.
 *
 * Every run gets an empty stdin and a working directory of its own (a stand-in
 * for the repository root, as `tests/differential/lib.js` gives each side), so
 * a program that reads its input from stdin sees end of file on both sides and
 * one that writes a file cannot see the other's. A difference is checked by
 * running each side a second time: a side that answers differently then is
 * nondeterministic -- a clock, a pid, a socket, or freed memory read -- and is
 * reported as that rather than as a difference.
 *
 * A failure saves its source, both IR directories and both runs under
 * `build/test/differential/soundness/<name>/` and prints that path.
 *
 * A program whose two builds fail to build alike is `broken`, which fails the
 * run: a corpus program that builds nowhere is the runner's mistake or the
 * compiler's. So does one that is `nondeterministic`, either side answering
 * differently on a second run: every corpus case has one expected run, and a
 * read of freed memory may show up that way rather than as a difference. A
 * build or run that outlives its bound on both sides is a `timeout`, counted
 * and listed, and fails nothing: the runner's limit, not a finding. On one
 * side only it is a difference -- a proof that turns a loop infinite, or a
 * check whose panic ends one -- so it fails the run like any other. The
 * summary line counts every verdict, and `elided`, the programs whose two
 * builds' IR differs: none at all means the flag changed nothing, and the run
 * answers 2, since every agreement compared a build with itself.
 *
 * Exit status: 0 when every compared program agreed, 1 on a difference, a
 * broken or nondeterministic program or a stale `KNOWN` entry, 2 when nothing
 * could be compared or no build differed from its reference.
 */
import { spawn, spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { generateProgram } from "./fuzz.js"
import { buildDir, hasClang, root } from "./lib.js"

/**
 * The differences this runner accepts, one per finding: `{ name, why }`, where
 * `name` is the program's name as the run prints it (`cases/<name>`,
 * `<dir>/<name>`, `fuzz/<seed>`) and `why` says what the finding is and where
 * it is tracked. A listed program is reported KNOWN and does not fail the run;
 * one that agrees again is reported STALE and does, so the entry goes when the
 * finding is fixed. A finding is fixed in the compiler, never listed to make a
 * run green.
 */
const KNOWN = []

const RUNTIME_C = [
  "runtime/runtime.c",
  "runtime/runtime-os.c",
  "runtime/runtime-parallel.c",
  "runtime/runtime-cross.c",
  "runtime/runtime-host.c",
  "runtime/runtime-net.c",
  "runtime/runtime-simd.c",
  "runtime/runtime-aes.c",
  "runtime/runtime-term.c",
  "runtime/runtime-bytes.c",
]
const DRIVER_C = path.join(root, "tests", "driver.c")

/** One run of a binary, killed if it outlives this; the suite's bound is 120 s. */
const RUN_TIMEOUT_MS = 30_000

/** The bound `execute` holds a run to: `RUN_TIMEOUT_MS`, or `--run-timeout`. */
let runTimeoutMs = RUN_TIMEOUT_MS

/**
 * One compile or link: the reference compile proves nothing, so it is slower.
 * A build that outlives this on both sides is a slow runner, not a finding; on
 * one side only, it is a difference.
 */
const BUILD_TIMEOUT_MS = 180_000

const work = path.join(buildDir, "soundness")

/** The `.args` flags only decide whether a build may happen; the reference build drops them. */
const GATES = ["--deny-panics", "--deny-retention"]

const readsArena = (file) => /\bArena\.used\(/.test(fs.readFileSync(file, "utf8"))

const hasMain = (file) =>
  /\bexport\s+(?:function\s+main\b|const\s+main\s*=)/.test(fs.readFileSync(file, "utf8"))

const words = (file) =>
  fs.existsSync(file) ? fs.readFileSync(file, "utf8").trim().split(/\s+/).filter(Boolean) : []

/** `NAME=value` per line layered over this environment, a bare `NAME` unset: lib.js's rule. */
const envFile = (file) => {
  const env = { ...process.env }
  if (!fs.existsSync(file)) {
    return env
  }
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const text = line.trim()
    if (text.length === 0 || text.startsWith("#")) {
      continue
    }
    const eq = text.indexOf("=")
    if (eq < 0) {
      delete env[text]
    } else if (eq > 0) {
      env[text.slice(0, eq)] = text.slice(eq + 1)
    }
  }
  return env
}

/**
 * The programs `dir` holds by the rule in the header: `{ programs, skipped }`,
 * where a program is `{ name, entry, args, argv, env, driver }` and a skip is
 * `{ name, why }`.
 */
const discover = (dir) => {
  const programs = []
  const skipped = []
  const label = path.relative(root, dir).replace(/^tests\//, "")
  const isCases = path.resolve(dir) === path.join(root, "tests", "cases")
  for (const file of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, file)
    if (isCases) {
      if (!file.endsWith(".ts")) {
        continue
      }
      const stem = full.slice(0, -3)
      const name = `${label}/${file.slice(0, -3)}`
      const side = (ext) => `${stem}.${ext}`
      if (fs.existsSync(side("err"))) {
        skipped.push({ name, why: "an .err case: it must not compile" })
        continue
      }
      if (!fs.existsSync(side("out"))) {
        continue // compile-only: no run to compare, and not worth a line each
      }
      const args = words(side("args"))
      if (args.includes("--target")) {
        skipped.push({
          name,
          why: "its .args name a --target: not a native binary",
        })
        continue
      }
      let driver = null
      if (!hasMain(full)) {
        driver = fs.existsSync(side("c")) ? side("c") : DRIVER_C
      }
      programs.push({
        name,
        entry: full,
        args,
        argv: words(side("argv")),
        env: envFile(side("env")),
        driver,
      })
    } else if (file.endsWith(".ts") && hasMain(full)) {
      const stem = full.slice(0, -3)
      programs.push({
        name: `${label}/${file.slice(0, -3)}`,
        entry: full,
        args: words(`${stem}.args`),
        argv: words(`${stem}.argv`),
        env: envFile(`${stem}.env`),
        driver: null,
      })
    } else if (fs.statSync(full).isDirectory() && fs.existsSync(path.join(full, "main.ts"))) {
      programs.push({
        name: `${label}/${file}`,
        entry: path.join(full, "main.ts"),
        args: words(path.join(full, "args")),
        argv: words(path.join(full, "argv")),
        env: envFile(path.join(full, "env")),
        driver: null,
      })
    }
  }
  return {
    programs: programs.filter((p) => !readsArena(p.entry)),
    skipped: [
      ...skipped,
      ...programs
        .filter((p) => readsArena(p.entry))
        .map((p) => ({ name: p.name, why: "it reads Arena.used()" })),
    ],
  }
}

/** Spawn without blocking: `{ status, signal, stdout, stderr, timedOut }`, the output as Buffers. */
const run = (cmd, args, opts = {}) =>
  new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
      ...opts,
    })
    const out = []
    const err = []
    let timedOut = false
    child.stdout.on("data", (d) => out.push(d))
    child.stderr.on("data", (d) => err.push(d))
    const timer = setTimeout(() => {
      timedOut = true
      child.kill("SIGKILL")
    }, opts.timeout ?? RUN_TIMEOUT_MS)
    const finish = (status, signal, extra = []) => {
      clearTimeout(timer)
      resolve({
        status,
        signal,
        stdout: Buffer.concat(out),
        stderr: Buffer.concat([...err, ...extra]),
        timedOut,
      })
    }
    child.on("close", (status, signal) => finish(status, signal))
    child.on("error", (e) => finish(null, null, [Buffer.from(String(e))]))
  })

/** The runtime at `-O2`, as objects, once per `defines`: `{ objects, error }`. */
const runtimeCache = new Map()
const runtimeObjects = (defines) => {
  const key = defines.join(" ")
  if (!runtimeCache.has(key)) {
    const dir = path.join(work, "runtime-obj", key.replace(/[^A-Za-z0-9]+/g, "_") || "default")
    fs.mkdirSync(dir, { recursive: true })
    const built = { objects: [], error: null }
    for (const src of [...RUNTIME_C, DRIVER_C]) {
      const obj = path.join(dir, path.basename(src).replace(/\.c$/, ".o"))
      const cc = spawnSync("clang", ["-O2", ...defines, "-c", src, "-o", obj], {
        cwd: root,
        encoding: "utf8",
      })
      if (cc.status !== 0) {
        built.error = `could not compile ${src}: ${cc.stderr}`
        break
      }
      built.objects.push(obj)
    }
    runtimeCache.set(key, built)
  }
  return runtimeCache.get(key)
}

/**
 * A working directory standing in for the repository root: everything but
 * `build/` is a symlink back, and `build/test/differential/` is empty, as
 * `scratchRoot` in lib.js makes one.
 */
const scratchRoot = (dir) => {
  fs.mkdirSync(path.join(dir, "build", "test", "differential"), {
    recursive: true,
  })
  for (const entry of fs.readdirSync(root)) {
    if (entry !== "build") {
      fs.symlinkSync(path.join(root, entry), path.join(dir, entry))
    }
  }
  return dir
}

/** What `build` answers when a compile or link outlived `BUILD_TIMEOUT_MS`. */
const TIMED_OUT = "timeout"

/**
 * Compile `prog`, as the reference when `reference` (a boolean), into `<dir>/ir/` and link it to `<dir>/app`:
 * `null`, or what went wrong.
 */
const build = async (compiler, prog, dir, reference) => {
  const ir = path.join(dir, "ir")
  fs.mkdirSync(ir, { recursive: true })
  const flags = reference ? [...prog.args.filter((a) => !GATES.includes(a)), "--no-elision"] : prog.args
  const cc = await run(compiler, [prog.entry, "-o", `${ir}${path.sep}`, ...flags], {
    timeout: BUILD_TIMEOUT_MS,
  })
  if (cc.timedOut) {
    return TIMED_OUT
  }
  if (cc.status !== 0) {
    return `compile: exit ${cc.status}\n${cc.stderr}`
  }
  const threads = prog.args.includes("--threads")
  const rt = runtimeObjects(threads ? ["-DNISH_THREADS=1"] : [])
  if (rt.error !== null) {
    return rt.error
  }
  const driverObject = rt.objects[rt.objects.length - 1]
  const runtime = rt.objects.slice(0, -1)
  const lls = fs
    .readdirSync(ir)
    .filter((f) => f.endsWith(".ll"))
    .map((f) => path.join(ir, f))
  const driver = prog.driver === null ? [] : [prog.driver === DRIVER_C ? driverObject : prog.driver]
  const link = await run(
    "clang",
    [
      "-Wno-override-module",
      "-O2",
      ...(threads ? ["-pthread"] : []),
      ...lls,
      ...driver,
      ...runtime,
      "-lm",
      "-o",
      path.join(dir, "app"),
    ],
    { timeout: BUILD_TIMEOUT_MS }
  )
  if (link.timedOut) {
    return TIMED_OUT
  }
  return link.status === 0 ? null : `link: exit ${link.status}\n${link.stderr}`
}

/** One side's run, in its own working directory. */
const execute = (prog, dir, tag) =>
  run(path.join(dir, "app"), prog.argv, {
    cwd: scratchRoot(path.join(dir, `cwd-${tag}`)),
    env: prog.env,
    timeout: runTimeoutMs,
  })

/** How a run ended, in a word: `exit 0`, `SIGSEGV`, `timeout`. */
const ending = (r) => {
  if (r.timedOut) {
    return "timeout"
  }
  return r.signal ?? `exit ${r.status}`
}

/**
 * The runtime's own panic lines (`runtime/runtime.c`): an index or slice out of
 * range, checked arithmetic, out of memory, and a foreign buffer's count
 * (`emitForeignBuffers` in `src/emit-strings.ts`).
 */
const RUNTIME_PANIC =
  /^(index out of range: |slice out of range: |attempt to |nish: out of memory$|`[^`]+`: argument \d+ \(.*\) counts more bytes than )/

/**
 * The panic line a run printed, or null: a runtime panic's line, else, for a
 * run that exited 1, the last line on stderr, which is where `panic(message)`
 * and `expect` write theirs.
 */
const panicOf = (r) => {
  const lines = String(r.stderr)
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  const runtime = lines.find((l) => RUNTIME_PANIC.test(l))
  if (runtime !== undefined) {
    return runtime
  }
  return r.status === 1 && lines.length > 0 ? lines[lines.length - 1] : null
}

/**
 * Two runs mean the same: stdout, stderr and how they ended. Every panic exits
 * 1, so stderr is what tells one panic from another, or from a clean `exit 1`.
 */
const same = (a, b) =>
  a.status === b.status &&
  a.signal === b.signal &&
  a.timedOut === b.timedOut &&
  a.stdout.equals(b.stdout) &&
  a.stderr.equals(b.stderr)

/** What differs between the default run `a` and the reference run `b`, a line each. */
const describe = (a, b) => {
  const lines = []
  if (ending(a) !== ending(b)) {
    lines.push(`ending: default ${ending(a)}, --no-elision ${ending(b)}`)
  }
  const pa = panicOf(a)
  const pb = panicOf(b)
  if (pa !== pb) {
    lines.push(`panic: default ${pa ?? "none"}, --no-elision ${pb ?? "none"}`)
  }
  if (!a.stdout.equals(b.stdout)) {
    const la = String(a.stdout).split("\n")
    const lb = String(b.stdout).split("\n")
    const i = la.findIndex((l, k) => l !== lb[k])
    const at = i < 0 ? la.length : i
    lines.push(
      `stdout line ${at + 1}: default ${JSON.stringify(la[at])}, --no-elision ${JSON.stringify(lb[at])}`
    )
  }
  if (!a.stderr.equals(b.stderr)) {
    const la = String(a.stderr).split("\n")
    const lb = String(b.stderr).split("\n")
    const at = la.findIndex((l, k) => l !== lb[k])
    lines.push(
      `stderr line ${at + 1}: default ${JSON.stringify(la[at])}, --no-elision ${JSON.stringify(lb[at])}`
    )
  }
  return lines.join("\n")
}

/** The IR of one side, every module in name order, for telling the two builds apart. */
const irText = (dir) => {
  const ir = path.join(dir, "ir")
  return fs
    .readdirSync(ir)
    .filter((f) => f.endsWith(".ll"))
    .sort()
    .map((f) => fs.readFileSync(path.join(ir, f), "utf8"))
    .join("\n")
}

/**
 * Build both sides of `prog`, run them, compare: `{ name, verdict, detail, dir,
 * elided }` with `verdict` one of agree | differ | nondeterministic | broken |
 * timeout, and `elided` whether the two builds' IR differs. A program that will
 * not build on one side only is a difference too: the flag is meant to change
 * nothing the checker accepts. A build or a run that outlives its bound on
 * both sides is a `timeout`, the runner's limit rather than a finding; on one
 * side only it is a `differ`, since a hang one build alone takes is a
 * difference in what the program does.
 */
const compare = async (compiler, prog) => {
  const dir = path.join(work, prog.name.replace(/[\\/]/g, "_"))
  fs.rmSync(dir, { recursive: true, force: true })
  const def = path.join(dir, "default")
  const ref = path.join(dir, "no-elision")
  const [defErr, refErr] = await Promise.all([
    build(compiler, prog, def, false),
    build(compiler, prog, ref, true),
  ])
  if (defErr === TIMED_OUT || refErr === TIMED_OUT) {
    const both = defErr === TIMED_OUT && refErr === TIMED_OUT
    const side = both ? "both builds" : `the ${defErr === TIMED_OUT ? "default" : "--no-elision"} build`
    return {
      name: prog.name,
      verdict: both ? "timeout" : "differ",
      detail: `${side} outlived ${BUILD_TIMEOUT_MS / 1000} s`,
      dir,
      elided: false,
    }
  }
  if (defErr !== null || refErr !== null) {
    const both = defErr !== null && refErr !== null
    return {
      name: prog.name,
      verdict: both ? "broken" : "differ",
      detail: both
        ? defErr
        : `builds only ${defErr === null ? "by default" : "with --no-elision"}: ${defErr ?? refErr}`,
      dir,
      elided: false,
    }
  }
  const elided = irText(def) !== irText(ref)
  const a = await execute(prog, def, "1")
  const b = await execute(prog, ref, "1")
  if (same(a, b)) {
    return { name: prog.name, verdict: "agree", detail: "", dir, elided }
  }
  // A hang on one side only falls through: `describe` names it in the
  // ending, and it fails the run unless the second runs say it is noise.
  if (a.timedOut && b.timedOut) {
    return {
      name: prog.name,
      verdict: "timeout",
      detail: `both runs outlived ${runTimeoutMs / 1000} s`,
      dir,
      elided,
    }
  }
  // Asked only of a difference, so an agreeing program costs two runs. Each
  // side runs again: a side that answers differently the second time is
  // nondeterministic, and its difference says nothing about a proof. A side
  // that outlives the bound both times is steady, whatever it printed before
  // it was killed: where the kill cuts the output is the clock's doing.
  const [againA, againB] = [await execute(prog, def, "2"), await execute(prog, ref, "2")]
  for (const [tag, first, again] of [
    ["default", a, againA],
    ["--no-elision", b, againB],
  ]) {
    if (!(first.timedOut && again.timedOut) && !same(first, again)) {
      return {
        name: prog.name,
        verdict: "nondeterministic",
        detail: `${tag} run twice: ${describe(first, again)}`,
        dir,
        elided,
      }
    }
  }
  for (const [tag, r] of [
    ["default", a],
    ["no-elision", b],
  ]) {
    fs.writeFileSync(path.join(dir, `${tag}.stdout`), r.stdout)
    fs.writeFileSync(path.join(dir, `${tag}.stderr`), r.stderr)
  }
  fs.copyFileSync(prog.entry, path.join(dir, path.basename(prog.entry)))
  return { name: prog.name, verdict: "differ", detail: describe(a, b), dir, elided }
}

/** Evenly spaced picks, `n` of `list`, first and order kept. */
const sample = (list, n) =>
  n >= list.length ? list : Array.from({ length: n }, (_, i) => list[Math.floor((i * list.length) / n)])

const parse = (argv) => {
  const o = {
    corpora: [],
    seed: null,
    count: null,
    depth: 3,
    only: null,
    sample: null,
    threads: Math.min(8, os.availableParallelism?.() ?? os.cpus().length),
    budget: 600,
    compiler: path.join(root, "build", "nish"),
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = () => {
      if (i + 1 >= argv.length) {
        throw new Error(`${a} wants a value`)
      }
      return argv[++i]
    }
    if (a === "--corpus") {
      o.corpora.push(path.resolve(next()))
    } else if (a === "--seed") {
      o.seed = Number(next()) >>> 0
    } else if (a === "--count") {
      o.count = Number(next())
    } else if (a === "--depth") {
      o.depth = Number(next())
    } else if (a === "--only") {
      o.only = next()
    } else if (a === "--sample") {
      o.sample = Number(next())
    } else if (a === "--threads") {
      o.threads = Math.max(1, Number(next()))
    } else if (a === "--budget") {
      o.budget = Number(next())
    } else if (a === "--compiler") {
      o.compiler = path.resolve(next())
    } else if (a === "--run-timeout") {
      const seconds = Number(next())
      if (!(seconds > 0)) {
        throw new Error(`--run-timeout takes a positive number of seconds, not ${seconds}`)
      }
      runTimeoutMs = seconds * 1000
    } else {
      throw new Error(`unknown option: ${a}`)
    }
  }
  if (o.count !== null && o.seed === null) {
    o.seed = (Date.now() ^ (process.pid << 8)) >>> 0
  }
  if (o.seed !== null && o.count === null) {
    o.count = 20
  }
  return o
}

const main = async () => {
  let o
  try {
    o = parse(process.argv.slice(2))
  } catch (e) {
    console.error(`soundness: ${e.message}`)
    return 2
  }
  if (o.corpora.length === 0 && o.seed === null) {
    console.error("soundness: nothing to run: pass --corpus <dir> and/or --seed <n> [--count <n>]")
    return 2
  }
  if (!hasClang()) {
    console.error("soundness: clang not installed")
    return 2
  }
  if (!fs.existsSync(o.compiler)) {
    console.error(`soundness: no compiler at ${o.compiler}: run \`npm run build\` or pass --compiler`)
    return 2
  }
  // The generated programs first: they are the ones no other job runs, so a
  // budget that runs out drops corpus cases, which the suite links anyway.
  const programs = []
  const skipped = []
  if (o.seed !== null) {
    const dir = path.join(work, "generated")
    fs.mkdirSync(dir, { recursive: true })
    for (let i = 0; i < o.count; i++) {
      const s = (o.seed + i) >>> 0
      const entry = path.join(dir, `fuzz-${s}.ts`)
      fs.writeFileSync(entry, generateProgram(s, { depth: o.depth }))
      programs.push({
        name: `fuzz/${s}`,
        entry,
        args: [],
        argv: [],
        env: process.env,
        driver: null,
      })
    }
  }
  for (const dir of o.corpora) {
    const found = discover(dir)
    programs.push(...(o.sample === null ? found.programs : sample(found.programs, o.sample)))
    skipped.push(...found.skipped)
  }
  const chosen = o.only === null ? programs : programs.filter((p) => p.name.includes(o.only))
  console.log(
    `soundness: ${chosen.length} programs, ${skipped.length} skipped by rule, ${o.threads} at a time, budget ${o.budget} s`
  )

  const started = Date.now()
  const results = []
  const unreached = []
  let next = 0
  const lane = async () => {
    while (next < chosen.length) {
      const prog = chosen[next++]
      if ((Date.now() - started) / 1000 > o.budget) {
        unreached.push(prog.name)
        continue
      }
      const r = await compare(o.compiler, prog)
      results.push(r)
      if (r.verdict !== "agree") {
        console.log(`${r.verdict.toUpperCase()}  ${r.name}  ${r.detail.replace(/\n/g, "\n    ")}`)
      }
    }
  }
  await Promise.all(Array.from({ length: o.threads }, lane))

  const known = new Map(KNOWN.map((k) => [k.name, k.why]))
  const count = (v) => results.filter((r) => r.verdict === v).length
  const elided = results.filter((r) => r.elided).length
  const differ = results.filter((r) => r.verdict === "differ")
  const failures = differ.filter((r) => !known.has(r.name))
  const stale = KNOWN.filter((k) => results.some((r) => r.name === k.name && r.verdict === "agree"))
  for (const r of differ) {
    const why = known.get(r.name)
    console.log(`  ${why === undefined ? "FAIL " : "KNOWN"} ${r.name}: ${why ?? "a proof does not hold"}`)
    console.log(`        reproducer: ${path.relative(root, r.dir)}/`)
    if (r.name.startsWith("fuzz/")) {
      console.log(
        `        reproduce: node tests/differential/soundness.js --seed ${r.name.slice(5)} --count 1`
      )
    }
  }
  for (const k of stale) {
    console.log(`  STALE ${k.name} agrees again: its KNOWN entry goes`)
  }
  const reasons = new Map()
  for (const s of skipped.filter((x) => o.only === null || x.name.includes(o.only))) {
    reasons.set(s.why, [...(reasons.get(s.why) ?? []), s.name])
  }
  for (const [why, names] of reasons) {
    console.log(
      `  skip  ${names.length} ${names.length === 1 ? "program" : "programs"}, ${why}: ${names.slice(0, 3).join(", ")}${names.length > 3 ? ", ..." : ""}`
    )
  }
  if (unreached.length > 0) {
    console.log(
      `  budget: ${unreached.length} programs not reached after ${o.budget} s, first ${unreached[0]}`
    )
  }
  console.log(
    `\nsoundness: agree=${count("agree")} elided=${elided} differ=${differ.length} ` +
      `known=${differ.length - failures.length} nondeterministic=${count("nondeterministic")} ` +
      `broken=${count("broken")} timeout=${count("timeout")} skipped=${skipped.length} ` +
      `unreached=${unreached.length} (${((Date.now() - started) / 1000).toFixed(1)} s)`
  )
  if (failures.length + stale.length + count("broken") + count("nondeterministic") > 0) {
    return 1
  }
  if (count("agree") === 0) {
    return 2
  }
  // Two builds that never differ compared the reference with itself: the
  // flag, or this runner's use of it, is broken, and every agree above is empty.
  if (elided === 0) {
    console.log("soundness: no program's two builds differed: the comparison compared nothing")
    return 2
  }
  return 0
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main()
}
