#!/usr/bin/env node
/**
 * The erasure invariant of `--compat` (WP28 S3): a program the strict dialect
 * has an answer for gets the same answer under the compatibility dialect.
 *
 * Every program in `tests/cases/` is compiled twice by the same compiler, with
 * the flags its `.args` names and then with `--compat` after them, and the two
 * answers are compared byte for byte:
 *
 *  - a positive case (no `.err`): the exit status, stdout, stderr and every
 *    file the compile wrote -- the `.ll`, and the header, typings, shim or
 *    TypeScript its `.args` asks for;
 *  - a reject case (a `.err`): the same, and both again under `--json`, which
 *    is where a diagnostic carries its code beside its words.
 *
 * The dialect is allowed to accept *more* programs as it grows; it is never
 * allowed to change one that already compiles or reword a refusal it still
 * makes. A feature that needs a different lowering for a strict program is a
 * different flag, and this is the test that says so.
 *
 * The first case that differs, in corpus order, fails the run with both
 * answers; nothing is skipped, and the summary line says so.
 *
 *   node tests/compat-erasure.js [--compiler build/nish] [--jobs N]
 *                                [--out build/test/compat-erasure] [filter]
 *
 * `filter` keeps the cases whose name contains it. Exit 0 when every case
 * agrees, 1 on a difference, 2 on a usage error or a case that does not do
 * what its `.err` (or the lack of one) says before `--compat` is ever passed.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { jobsFrom, pool, run } from "./pool.js"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const casesDir = path.join(root, "tests", "cases")

/** The flag under test. */
const FLAG = "--compat"

/** Where a case's `.args` put the files they name: `tests/run.js`'s build directory. */
const SHARED_OUTPUT = "build/test/"

/** The options that take a value, and so are not the filter. */
const VALUED = ["--compiler", "--jobs", "--out"]

const argv = process.argv.slice(2)
const optionValue = (flag, fallback) => {
  const at = argv.indexOf(flag)
  return at >= 0 && argv[at + 1] !== undefined ? argv[at + 1] : fallback
}
const compiler = path.resolve(optionValue("--compiler", path.join(root, "build", "nish")))
const outDir = path.resolve(optionValue("--out", path.join(root, "build", "test", "compat-erasure")))
const jobs = jobsFrom(argv)
const filter = argv.find((arg, i) => !arg.startsWith("--") && !VALUED.includes(argv[i - 1])) ?? ""

if (!fs.existsSync(compiler)) {
  console.error(
    `compat-erasure: no compiler at ${compiler}; run \`npm run build\`, or name one with --compiler`
  )
  process.exit(2)
}

const cases = fs
  .readdirSync(casesDir)
  .filter((f) => f.endsWith(".ts") && f.includes(filter))
  .map((f) => f.slice(0, -3))
  .sort()
if (cases.length === 0) {
  console.error(`compat-erasure: no case in tests/cases matches \`${filter}\``)
  process.exit(2)
}

/** Every file under `dir`, as its path from `dir` and its bytes, in name order. */
const filesUnder = (dir) =>
  fs
    .readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath, entry.name))
    .sort()
    .map((file) => ({ name: path.relative(dir, file), bytes: fs.readFileSync(file) }))

/**
 * One compile of a case into a directory of its own, emptied first, so what is
 * read back is what this compile wrote. Both compiles of a case write to the
 * same paths, one after the other: a path the compiler prints (`wrote ...`) or
 * bakes into a file is then the same text in both answers, and nothing has to
 * be normalised away before the comparison.
 *
 * A file the case's `.args` send to `build/test/` goes to that directory
 * instead: this runner shares a build tree with `tests/run.js`, and writes
 * nothing another section reads.
 */
const compile = async (name, extra) => {
  const work = path.join(outDir, name)
  fs.rmSync(work, { recursive: true, force: true })
  fs.mkdirSync(work, { recursive: true })
  const argsFile = path.join(casesDir, `${name}.args`)
  const args = (
    fs.existsSync(argsFile) ? fs.readFileSync(argsFile, "utf8").trim().split(/\s+/).filter(Boolean) : []
  ).map((arg) => {
    if (!arg.startsWith(SHARED_OUTPUT)) {
      return arg
    }
    const moved = path.join(work, arg.slice(SHARED_OUTPUT.length))
    fs.mkdirSync(path.dirname(moved), { recursive: true })
    return moved
  })
  const source = path.join("tests", "cases", `${name}.ts`)
  const r = await run(compiler, [source, "-o", path.join(work, `${name}.ll`), ...args, ...extra], {
    cwd: root,
  })
  return { status: r.status, signal: r.signal, stdout: r.stdout, stderr: r.stderr, files: filesUnder(work) }
}

/** `[what, without, with]` for the first part of two answers that differs, or null. */
const firstDifference = (without, withFlag) => {
  if (without.status !== withFlag.status || without.signal !== withFlag.signal) {
    const exit = (r) => Buffer.from(r.signal === null ? `exit ${r.status}` : `killed by ${r.signal}`)
    return ["the exit status", exit(without), exit(withFlag)]
  }
  for (const stream of ["stdout", "stderr"]) {
    if (!without[stream].equals(withFlag[stream])) {
      return [stream, without[stream], withFlag[stream]]
    }
  }
  const names = [...new Set([...without.files, ...withFlag.files].map((file) => file.name))].sort()
  for (const name of names) {
    const a = without.files.find((file) => file.name === name)
    const b = withFlag.files.find((file) => file.name === name)
    if (a === undefined || b === undefined || !a.bytes.equals(b.bytes)) {
      const absent = Buffer.from("(not written)")
      return [`the file ${name}`, a?.bytes ?? absent, b?.bytes ?? absent]
    }
  }
  return null
}

/** How many `--json` diagnostics on a stdout carry a code. */
const codedDiagnostics = (stdout) =>
  stdout
    .toString("utf8")
    .split("\n")
    .filter((line) => /^\{.*"code":"NL\d+"/.test(line)).length

/** Set once a case differs: no new case is started, and the ones in flight finish. */
let stopped = false

/**
 * One case under each set of flags it is compared under. A case that fails
 * differs (`difference`) or was never a fair comparison (`broken`): a positive
 * case that does not compile, or a reject case that does, has no answer for
 * `--compat` to keep.
 */
const erase = async (name) => {
  if (stopped) {
    return null
  }
  const reject = fs.existsSync(path.join(casesDir, `${name}.err`))
  const result = { name, reject, files: 0, diagnostics: 0, broken: "", difference: null }
  for (const flags of reject ? [[], ["--json"]] : [[]]) {
    const without = await compile(name, flags)
    if (reject ? without.status !== 1 : without.status !== 0) {
      result.broken =
        `${name}: ${reject ? "has a .err but is not rejected with exit 1" : "has no .err but does not compile"}` +
        ` (exit ${without.status}${without.signal === null ? "" : `, ${without.signal}`}) before ${FLAG} is passed\n` +
        without.stderr.toString("utf8")
      stopped = true
      return result
    }
    const withFlag = await compile(name, [...flags, FLAG])
    const difference = firstDifference(without, withFlag)
    if (difference !== null) {
      result.difference = { flags, difference }
      stopped = true
      return result
    }
    result.files += without.files.length
    result.diagnostics += flags.includes("--json") ? codedDiagnostics(without.stdout) : 0
  }
  return result
}

/** The line two texts first part ways on, 1-based, and that line of each. */
const firstDifferingLine = (a, b) => {
  const [left, right] = [a.toString("utf8").split("\n"), b.toString("utf8").split("\n")]
  let at = 0
  while (at < left.length && at < right.length && left[at] === right[at]) {
    at++
  }
  return { line: at + 1, without: left[at] ?? "(end of text)", with: right[at] ?? "(end of text)" }
}

const results = (await pool(cases, jobs, erase)).filter((result) => result !== null)

const broken = results.find((result) => result.broken.length > 0 || result.difference !== null)
if (broken !== undefined && broken.broken.length > 0) {
  console.error(`compat-erasure: ${broken.broken}`)
  process.exit(2)
}
if (broken !== undefined) {
  const { flags, difference } = broken.difference
  const [what, without, withFlag] = difference
  const at = firstDifferingLine(without, withFlag)
  // Both answers in full, beside the tree the second compile left behind.
  const kept = (side) => path.join(outDir, `${broken.name}.${side}.txt`)
  fs.writeFileSync(kept("without"), without)
  fs.writeFileSync(kept("with"), withFlag)
  console.error(
    `compat-erasure: ${broken.name}${flags.length > 0 ? ` (${flags.join(" ")})` : ""}: ${FLAG} changed ${what}, ` +
      `first at line ${at.line}\n` +
      `  without: ${at.without}\n` +
      `  with:    ${at.with}\n` +
      `  both in full: ${path.relative(root, kept("without"))}\n` +
      `                ${path.relative(root, kept("with"))}`
  )
  process.exit(1)
}

const positive = results.filter((result) => !result.reject)
const rejected = results.filter((result) => result.reject)
const sum = (list, key) => list.reduce((total, result) => total + result[key], 0)
console.log(
  `compat-erasure: ${positive.length} positive cases byte-identical under ${FLAG} (${sum(positive, "files")} files), ` +
    `${rejected.length} reject cases rejected alike (${sum(rejected, "diagnostics")} coded diagnostics), ` +
    `${cases.length - results.length} skipped`
)
