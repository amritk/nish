#!/usr/bin/env node
/**
 * The `--emit-ts` differential (WP33 R4): every whole program the WP13 harness
 * discovers is
 *
 *   1. compiled and linked natively, run, stdout, stderr and exit status
 *      captured;
 *   2. written out with `nish --emit-ts <dir>` by the same compiler, and the
 *      `entry.ts` it writes run under `node --experimental-strip-types`; the
 *      output lies inside this package, so `nish/runtime` resolves to this
 *      checkout's `runtime/` through the package's own exports;
 *   3. compared byte for byte.
 *
 * Unlike `run.js`, nothing here is frozen: the TypeScript is written by the
 * compiler under test on every run, which is the point. The rows that rewrite
 * what Node runs differently arrive a stage at a time, so most programs do not
 * agree yet, and `emit-ts-known.txt` lists each one that does not under the
 * ledger row whose stage will fix it (`ROWS`), with the evidence in a comment.
 * The row is read off the evidence by `rowOf`, a heuristic, so a program may
 * move rows as earlier ones land. The list is generated, never edited:
 *
 * ```
 * node tests/differential/emit-ts.js                 # compare, fail on news
 * node tests/differential/emit-ts.js --update        # rewrite the known list
 * node tests/differential/emit-ts.js --only arr_ --verbose
 * ```
 *
 * The run fails when a program outside the list does not agree, when a listed
 * one now does, when a listed one's row has moved and when a listed name is
 * gone: a stage that fixes a program removes it with `--update`, so the list
 * only ever says what is true today. A failed native build or emit, and a
 * native run that times out, are never listed, so they always fail the run
 * (save a native build of a program refused for its C functions, NL4010); a
 * run that times out under Node alone is a disagreement like any other, listed
 * under the row its evidence names.
 *
 * Both halves use `--compiler`, default `build/nish`. The seed cannot stand in
 * for it, as it does for `run.js`, because a released compiler that predates
 * `--emit-ts` has no TypeScript to write.
 */
import { spawn } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { pool } from "../pool.js"
import { buildDir, discoverPrograms } from "./lib.js"

const root = path.resolve(import.meta.dirname, "..", "..")
const KNOWN = path.join(import.meta.dirname, "emit-ts-known.txt")
const WORK = path.join(path.dirname(buildDir), "emit-ts-differential")
const RUN_TIMEOUT_MS = 30_000

/**
 * The flags `node` needs to run the output. `using` is in the language and
 * Node before 24 parses it only behind a V8 flag; type stripping is on by
 * default from 23.6 and the flag is accepted after.
 */
export const NODE_FLAGS = [
  "--experimental-strip-types",
  "--no-warnings",
  ...(Number(process.versions.node.split(".")[0]) < 24 ? ["--js-explicit-resource-management"] : []),
]

/**
 * Spawn, capture both streams as Buffers, and kill the child at the timeout,
 * which `timedOut` records: two runs killed alike would otherwise compare as
 * agreeing.
 */
const run = (cmd, args, opts = {}) =>
  new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: root, stdio: ["ignore", "pipe", "pipe"], ...opts })
    const out = []
    const err = []
    child.stdout.on("data", (d) => out.push(d))
    child.stderr.on("data", (d) => err.push(d))
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      child.kill("SIGKILL")
    }, RUN_TIMEOUT_MS)
    child.on("close", (status, signal) => {
      clearTimeout(timer)
      resolve({ status, signal, timedOut, stdout: Buffer.concat(out), stderr: Buffer.concat(err) })
    })
    child.on("error", (e) => {
      clearTimeout(timer)
      resolve({
        status: null,
        signal: null,
        timedOut,
        stdout: Buffer.concat(out),
        stderr: Buffer.from(String(e)),
      })
    })
  })

/**
 * A working directory standing in for the repository root, one per side of
 * each program, for the reason `cwdFor` in `lib.js` gives: programs write by
 * relative path and the runs are parallel.
 */
const scratchRoot = (work, side) => {
  const dir = path.join(work, `${side}-cwd`)
  fs.mkdirSync(path.join(dir, "build", "test", "differential"), { recursive: true })
  for (const entry of fs.readdirSync(root)) {
    if (entry !== "build") {
      fs.symlinkSync(path.join(root, entry), path.join(dir, entry))
    }
  }
  return dir
}

/**
 * The rows of the wp33 §3 ledger a disagreement is filed under, in the order
 * their stages land: R4b's numbers, R4c's strings, R4d's records, R4e's
 * control flow; `libm` is the 1-ulp row that stays; `ffi` a program whose C
 * functions cannot be written (NL4010); `refused` one `--emit-ts` refuses for
 * now (NL4011, NL4012).
 */
const ROWS = ["numbers", "strings", "records", "control", "libm", "ffi", "refused"]

/**
 * The evidence, as a regular expression over Node's stderr, the native
 * stderr and the first lines that differ, for each row a failure is filed
 * under, first match wins. The names are the runtime's and the core's
 * helpers the later rows import, and the panics native prints for them.
 */
const EVIDENCE = [
  ["control", /\benum\b|orReturn|Symbol\.dispose|\busing\b|\bArena\b|\barena\b|\bscope\b/],
  ["numbers", /\bto[IUF](8|16|32|64)\b|BigInt|wrapping[A-Z]|overflow|division by zero|\bidiv\b|\birem\b/],
  ["strings", /fromBytes|fromCharCode|parseInt|parseFloat|\bslice\b|\bsubstring\b|charCodeAt/],
  [
    "records",
    /unchecked[A-Z]|newArray|arraySet|\.set is not|\.push is not|out of bounds|\bindex\b|undefined|\bNaN\b/,
  ],
]

/** The compiler's dump flags, which take no value and `--emit-ts` refuses alongside it. */
const DUMPS = ["--emit-ast", "--emit-checked"]

/** Two lines that print the same floats but for their last digits: the libm row. */
const ulpApart = (a, b) => {
  const fa = (a ?? "").match(/-?\d+\.\d+(e[-+]?\d+)?/g)
  const fb = (b ?? "").match(/-?\d+\.\d+(e[-+]?\d+)?/g)
  if (fa === null || fb === null || fa.length !== fb.length) {
    return false
  }
  return fa.every((x, i) => x === fb[i] || Math.abs(Number(x) - Number(fb[i])) <= Math.abs(Number(x)) * 1e-12)
}

/** The first line at which two outputs part, as `[index, native line, node line]`. */
const firstDifference = (a, b) => {
  const x = String(a).split("\n")
  const y = String(b).split("\n")
  let i = 0
  while (i < x.length && x[i] === y[i]) {
    i += 1
  }
  return [i, x[i], y[i]]
}

/** The ledger row a disagreement is filed under (`ROWS`), from what the two runs said. */
const rowOf = (native, node) => {
  const [, ours, theirs] = firstDifference(native.stdout, node.stdout)
  const evidence = `${node.stderr}\n${native.stderr}\n${ours ?? ""}\n${theirs ?? ""}`
  for (const [row, pattern] of EVIDENCE) {
    if (pattern.test(evidence)) {
      return row
    }
  }
  if (ulpApart(ours, theirs)) {
    return "libm"
  }
  // UTF-8 bytes against UTF-16 units shows up first wherever a line holds
  // something past ASCII; anything else is an integer the TypeScript reading
  // let grow past its width, the commonest disagreement there is.
  return /[\u0080-\uffff]/.test(`${ours ?? ""}${theirs ?? ""}`) ? "strings" : "numbers"
}

/** The first line of a compiler's stderr that says why, for the known list. */
const firstLine = (buffer) => {
  const text = String(buffer).trim()
  const coded = text.split("\n").find((l) => /\bNL\d{4}\b/.test(l) || l.includes("error"))
  return (coded ?? text.split("\n")[0] ?? "").trim()
}

/**
 * One program, both halves. Answers `{ name, verdict, reason }`, where the
 * verdict is `agree`, `native-error` (the program does not build natively, so
 * nothing is compared), `refused` (`--emit-ts` reported a diagnostic),
 * `emit-error` (it failed otherwise) or `differ`.
 */
const compare = async (prog, compiler) => {
  const work = path.join(WORK, prog.name.replace(/[\\/]/g, "_"))
  fs.rmSync(work, { recursive: true, force: true })
  fs.mkdirSync(work, { recursive: true })
  const exe = path.join(work, "app")
  const built = await run(compiler, [
    prog.entry,
    "-o",
    `${path.join(work, "ir")}${path.sep}`,
    "--link",
    exe,
    ...prog.args,
  ])
  const out = path.join(work, "ts")
  // `--json`, so a refusal names its code, which is the row it is filed under.
  // A dump flag a case passes for its own test is dropped: it prints the
  // checked program and changes nothing the build does, and `--emit-ts`
  // refuses it as a usage error.
  const emitArgs = prog.args.filter((arg) => !DUMPS.includes(arg))
  const emitted = await run(compiler, [prog.entry, "--json", "--emit-ts", out, ...emitArgs])
  const coded = emitted.status === 0 ? null : String(emitted.stdout).match(/"code":"(NL40(10|11|12))"/)
  // The native build is read first, so a program that is both refused and
  // broken natively is an error rather than a listed refusal. The exception is
  // an NL4010 refusal: a module that declares C functions may need C this
  // harness does not link (`map_fingerprint_miss` links its own under
  // `run.js`), and the refusal is the verdict whether or not it builds.
  if (built.status !== 0 && (coded === null || coded[1] !== "NL4010")) {
    return { name: prog.name, verdict: "native-error", row: "", reason: firstLine(built.stderr) }
  }
  if (emitted.status !== 0) {
    if (coded !== null) {
      const row = coded[1] === "NL4010" ? "ffi" : "refused"
      return { name: prog.name, verdict: "refused", row, reason: `${coded[1]} under --emit-ts` }
    }
    return { name: prog.name, verdict: "emit-error", row: "", reason: firstLine(emitted.stdout) }
  }
  const native = await run(exe, prog.argv, { cwd: scratchRoot(work, "native"), env: prog.env })
  const node = await run("node", [...NODE_FLAGS, path.join(out, "entry.ts"), ...prog.argv], {
    cwd: scratchRoot(work, "node"),
    env: prog.env,
  })
  // A native run that never finishes says nothing about the TypeScript, so it
  // is an error like a failed build; Node's run timing out alone is a
  // difference like any other.
  if (native.timedOut) {
    return {
      name: prog.name,
      verdict: "timeout",
      row: "",
      reason: `the native run passed ${RUN_TIMEOUT_MS} ms`,
    }
  }
  if (node.timedOut) {
    return {
      name: prog.name,
      verdict: "differ",
      row: rowOf(native, node),
      reason: `node passed ${RUN_TIMEOUT_MS} ms`,
    }
  }
  const same =
    native.status === node.status &&
    native.signal === node.signal &&
    native.stdout.equals(node.stdout) &&
    native.stderr.equals(node.stderr)
  if (same) {
    return { name: prog.name, verdict: "agree", row: "", reason: "" }
  }
  return { name: prog.name, verdict: "differ", row: rowOf(native, node), reason: describe(native, node) }
}

/** Why two runs differ, in one line: the exit, else the first stdout line apart, else stderr. */
const describe = (native, node) => {
  if (native.status !== node.status || native.signal !== node.signal) {
    const said = String(node.stderr)
      .trim()
      .split("\n")
      .find((l) => /Error|error:/.test(l))
    const exits = `exit ${native.signal ?? native.status} vs ${node.signal ?? node.status}`
    return said === undefined ? exits : `${exits}: ${said.trim()}`
  }
  if (!native.stdout.equals(node.stdout)) {
    return `stdout line ${firstDifference(native.stdout, node.stdout)[0] + 1} differs`
  }
  return `stderr line ${firstDifference(native.stderr, node.stderr)[0] + 1} differs`
}

/**
 * The verdicts that are the harness's or the native build's failure, not a
 * row's: never listed, so always reported, and `--update` refuses to write a
 * list while one stands.
 */
const ERRORS = ["emit-error", "native-error", "timeout"]

/** The known list: program name -> the row recorded for it. */
const readKnown = () => {
  const known = new Map()
  if (!fs.existsSync(KNOWN)) {
    return known
  }
  for (const line of fs.readFileSync(KNOWN, "utf8").split("\n")) {
    const text = line.trim()
    if (text.length === 0 || text.startsWith("#")) {
      continue
    }
    const [name, row] = text.split("#")[0].trim().split(/\s+/)
    if (!ROWS.includes(row)) {
      throw new Error(
        `${KNOWN}: ${name} is filed under "${row ?? ""}", which is not a row (${ROWS.join(", ")})`
      )
    }
    known.set(name, row)
  }
  return known
}

const HEADER = `# Generated by \`node tests/differential/emit-ts.js --update\`; never edit by hand.
#
# Every program the --emit-ts differential does not yet see agree with its
# native build, one "<program> <row>" line each, where the row is the wp33 §3
# ledger row whose stage fixes it (numbers, strings, records, control, libm,
# ffi, refused); the comment is the evidence. A stage that fixes a program
# regenerates this list, and the program leaves it.
#
# The run fails on a program that does not agree and is not listed, on a
# listed one that agrees, on one whose row has moved, and on a listed name
# the corpus no longer has. A build, emit or timeout failure is never listed.
`

const writeKnown = (results) => {
  const rows = results
    .filter((r) => r.verdict !== "agree")
    .sort((a, b) => (a.name < b.name ? -1 : 1))
    .map((r) => `${r.name} ${r.row}  # ${r.verdict}: ${r.reason.replace(/\s+/g, " ").slice(0, 160)}`)
  fs.writeFileSync(KNOWN, `${HEADER}\n${rows.join("\n")}\n`)
}

const main = async (argv) => {
  let only
  let update = false
  let verbose = false
  let compiler = path.join(root, "build", "nish")
  let jobs = Math.min(8, os.cpus().length || 2)
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (["--only", "--compiler", "--jobs"].includes(a) && i + 1 >= argv.length) {
      console.error(`emit-ts.js: ${a} needs a value`)
      return 2
    }
    if (a === "--only") {
      only = argv[++i]
    } else if (a === "--update") {
      update = true
    } else if (a === "--verbose") {
      verbose = true
    } else if (a === "--compiler") {
      compiler = path.resolve(argv[++i])
    } else if (a === "--jobs") {
      jobs = Number(argv[++i])
    } else {
      console.error(`emit-ts.js: unknown argument ${a}`)
      return 2
    }
  }
  if (update && only !== undefined) {
    console.error("emit-ts.js: --update rewrites the whole list, so it takes no --only")
    return 2
  }
  if (!fs.existsSync(compiler)) {
    console.error(`emit-ts.js: no compiler at ${compiler}; run \`npm run build\` or pass --compiler`)
    return 2
  }
  const programs = discoverPrograms().filter((p) => only === undefined || p.name.includes(only))
  if (programs.length === 0) {
    console.error(`emit-ts.js: no program matches --only ${only}`)
    return 2
  }
  const results = await pool(programs, jobs, (prog) => compare(prog, compiler))
  const errors = results.filter((r) => ERRORS.includes(r.verdict))
  if (update && errors.length === 0) {
    writeKnown(results)
  }
  const known = readKnown()
  const agree = results.filter((r) => r.verdict === "agree").length
  const unexpected = results.filter(
    (r) => r.verdict !== "agree" && (!known.has(r.name) || errors.includes(r))
  )
  const xpass = results.filter((r) => r.verdict === "agree" && known.has(r.name))
  const moved = results.filter(
    (r) => !errors.includes(r) && known.has(r.name) && r.row !== "" && known.get(r.name) !== r.row
  )
  const names = new Set(results.map((r) => r.name))
  const stale = only === undefined ? [...known.keys()].filter((name) => !names.has(name)) : []
  for (const r of moved) {
    console.log(`${"MOVED".padEnd(12)} ${r.name}: listed under ${known.get(r.name)}, now ${r.row}`)
  }
  for (const name of stale) {
    console.log(`${"STALE".padEnd(12)} ${name}: listed, but the corpus has no such program`)
  }
  if (update && errors.length > 0) {
    console.log(
      `emit-ts.js: ${errors.length} program(s) failed to build, emit or finish; the list was not rewritten`
    )
  }
  for (const r of results) {
    if (verbose || unexpected.includes(r) || xpass.includes(r)) {
      let tag = r.verdict.toUpperCase()
      if (r.verdict === "agree") {
        tag = known.has(r.name) ? "XPASS" : "AGREE"
      }
      console.log(`${tag.padEnd(12)} ${r.name}${r.reason ? `: ${r.reason}` : ""}`)
    }
  }
  console.log(
    `${agree}/${results.length} programs agree under --emit-ts (${results.length - agree} known` +
      `${unexpected.length > 0 ? `, ${unexpected.length} unexpected` : ""}` +
      `${xpass.length > 0 ? `, ${xpass.length} now agree and are still listed` : ""}` +
      `${moved.length > 0 ? `, ${moved.length} moved row` : ""}` +
      `${stale.length > 0 ? `, ${stale.length} stale` : ""})`
  )
  if (xpass.length > 0 || moved.length > 0 || stale.length > 0) {
    console.log("emit-ts.js: `node tests/differential/emit-ts.js --update` brings the list up to date")
  }
  return unexpected.length === 0 && xpass.length === 0 && moved.length === 0 && stale.length === 0 ? 0 : 1
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2))
}
