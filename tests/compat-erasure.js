#!/usr/bin/env node
/**
 * The erasure invariant of `--compat` (WP28 S3, restated by C0): a program the
 * strict dialect has an answer for gets the same answer under the
 * compatibility dialect.
 *
 * The dialect moves two things in a build, and only two. It marks every module
 * it writes (`!nish.compat`, and the `compat` line `--emit-checked` opens
 * with), and it makes a bare `number` the double unless the build names a
 * `--number-mode` itself. So every program in `tests/cases/` is compared twice
 * by the same compiler, byte for byte once the mark is taken out:
 *
 *  - **the dialect alone**: the flags its `.args` names, against the same with
 *    `--compat --number-mode <the case's own>` after them. Naming the 32-bit
 *    integer beside the dialect is priced by one performance note (NL9018),
 *    which is taken out with the mark, and out of the count a report of
 *    several warnings closes with;
 *  - **the dialect's number**: `--number-mode f64` against a bare `--compat`,
 *    for a case whose `.args` name no number mode. Most of the corpus is
 *    refused there (it was written for the 32-bit integer), and is refused
 *    alike.
 *
 * What is compared:
 *
 *  - a positive case (no `.err`): the exit status, stdout, stderr and every
 *    file the compile wrote -- the `.ll`, and the header, typings, shim or
 *    TypeScript its `.args` asks for;
 *  - a reject case (a `.err`): the same, and both again under `--json`, which
 *    is where a diagnostic carries its code beside its words;
 *  - a positive case with a `.portability`, `.caps.json`, `.panics`, `.arena`
 *    or `.memory` golden: the same again under the flag that golden is for.
 *
 * A module written under the dialect that does not carry the mark is a
 * difference too: the mark is how a reader of the IR knows what it is reading.
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

/** The flag that says what a bare `number` is; it takes `i32` or `f64`. */
const NUMBER_MODE = "--number-mode"

/** The head of an extra flag's value that stands for the case's own directory. */
const WORK = "WORK/"

/** The dialect's mark in a module: a named metadata line, and the node it names. */
const MARK = /^!nish\.compat = !\{(!\d+)\}$/

/** The line `--emit-checked` opens with under the dialect. */
const CHECKED_LINE = /^compat number=\S+ features=\[[^\]]*\]$/

/** The words of NL9018, the note on `--number-mode i32` beside the dialect. */
const PRICED_NOTE = "`--number-mode i32` beside the compatibility dialect: "

/** The line a report of performance warnings closes with. */
const WARNING_COUNT = /^(\d+) performance warnings$/

/** A line of the source excerpt under a diagnostic: the quoted line, or its caret. */
const EXCERPT = /^ +\d* \| /

/**
 * The flag a golden beside a positive case is for: the case is compared under
 * it as well, since it is a second answer the strict dialect has for it.
 */
const GOLDEN_FLAGS = [
  [".portability", ["--warn-portability", "--json"]],
  [".caps.json", ["--emit-capabilities", `${WORK}capabilities.json`]],
  [".panics", ["--emit-panics", `${WORK}panics.txt`]],
  [".arena", ["--emit-arena", `${WORK}arena.txt`]],
  [".memory", ["--explain-memory"]],
]

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
 * The flags a case's `.args` names, without the dialect: a case written for
 * `--compat` is compared like any other, against itself in the strict dialect.
 */
const caseArgs = (name) => {
  const argsFile = path.join(casesDir, `${name}.args`)
  const args = fs.existsSync(argsFile)
    ? fs.readFileSync(argsFile, "utf8").trim().split(/\s+/).filter(Boolean)
    : []
  return args.filter((arg) => arg !== FLAG && !arg.startsWith(`${FLAG}=`))
}

/** What a bare `number` is in a case: the mode its `.args` names, or the 32-bit integer. */
const numberModeOf = (args) => {
  const at = args.lastIndexOf(NUMBER_MODE)
  return at >= 0 ? args[at + 1] : "i32"
}

/**
 * One compile of a case into a directory of its own, emptied first, so what is
 * read back is what this compile wrote. Every compile of a case writes to the
 * same paths, one after the other: a path the compiler prints (`wrote ...`) or
 * bakes into a file is then the same text in each answer, and nothing has to
 * be normalised away before the comparison.
 *
 * A file the case's `.args` send to `build/test/` goes to that directory
 * instead: this runner shares a build tree with `tests/run.js`, and writes
 * nothing another section reads. `WORK` at the head of an extra flag's value
 * is that directory too.
 */
const compile = async (name, extra) => {
  const work = path.join(outDir, name)
  fs.rmSync(work, { recursive: true, force: true })
  fs.mkdirSync(work, { recursive: true })
  const args = caseArgs(name).map((arg) => {
    if (!arg.startsWith(SHARED_OUTPUT)) {
      return arg
    }
    const moved = path.join(work, arg.slice(SHARED_OUTPUT.length))
    fs.mkdirSync(path.dirname(moved), { recursive: true })
    return moved
  })
  const placed = extra.map((arg) => (arg.startsWith(WORK) ? path.join(work, arg.slice(WORK.length)) : arg))
  const source = path.join("tests", "cases", `${name}.ts`)
  const r = await run(compiler, [source, "-o", path.join(work, `${name}.ll`), ...args, ...placed], {
    cwd: root,
  })
  return { status: r.status, signal: r.signal, stdout: r.stdout, stderr: r.stderr, files: filesUnder(work) }
}

/** `text` without the lines `from` to `to` (exclusive), each with its newline. */
const withoutLines = (lines, from, to) => [...lines.slice(0, from), ...lines.slice(to)]

/**
 * A module's IR without the dialect's mark: the `!nish.compat` line, and the
 * node it names when nothing else in the module names that node (a node is
 * written once however many things point at it). `null` for a module that
 * carries no mark.
 */
const unmarkedModule = (bytes) => {
  const lines = bytes.toString("latin1").split("\n")
  const at = lines.findIndex((line) => MARK.test(line))
  if (at < 0) {
    return null
  }
  const node = MARK.exec(lines[at])[1]
  const rest = withoutLines(lines, at, at + 1)
  const defined = rest.findIndex((line) => line.startsWith(`${node} = `))
  const named = rest.some((line, i) => i !== defined && new RegExp(`${node}(?!\\d)`).test(line))
  const left = named ? rest : withoutLines(rest, defined, defined + 1)
  // A module with no other metadata gained the blank line its metadata opens with.
  const alone = left[at - 1] === "" && left[at] === ""
  return Buffer.from((alone ? withoutLines(left, at, at + 1) : left).join("\n"), "latin1")
}

/**
 * A stream without what the dialect says about itself on it: the line
 * `--emit-checked` opens with, and the note that prices `--number-mode i32`
 * beside the dialect -- one JSON line under `--json`, and otherwise the message
 * with the source line and the caret under it.
 */
const unmarkedStream = (bytes) => {
  let lines = bytes.toString("latin1").split("\n")
  if (CHECKED_LINE.test(lines[0])) {
    lines = lines.slice(1)
  }
  const at = lines.findIndex((line) => line.includes(PRICED_NOTE))
  if (at >= 0) {
    let end = at + 1
    while (!lines[at].startsWith("{") && end < at + 3 && end < lines.length && EXCERPT.test(lines[end])) {
      end++
    }
    lines = withoutLines(lines, at, end)
    // A report of two or more closes by counting them.
    const count = lines.findIndex((line, i) => i >= at && WARNING_COUNT.test(line))
    if (count >= 0) {
      const left = Number(WARNING_COUNT.exec(lines[count])[1]) - 1
      lines =
        left === 1 ? withoutLines(lines, count, count + 1) : lines.with(count, `${left} performance warnings`)
    }
  }
  return Buffer.from(lines.join("\n"), "latin1")
}

/**
 * An answer given under the dialect with the dialect's mark taken out of it,
 * and the first module that carried none (`unmarked`, null when each did). A
 * compile that failed wrote no module to mark.
 */
const unmarked = (answer) => {
  let missing = null
  const files = answer.files.map((file) => {
    if (!file.name.endsWith(".ll")) {
      return file
    }
    const bytes = unmarkedModule(file.bytes)
    missing = missing ?? (bytes === null ? file.name : null)
    return bytes === null ? file : { name: file.name, bytes }
  })
  return {
    answer: {
      ...answer,
      stdout: unmarkedStream(answer.stdout),
      stderr: unmarkedStream(answer.stderr),
      files,
    },
    missing,
  }
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
 * One case under each set of flags it is compared under, in each of the two
 * comparisons. A case that fails differs (`difference`) or was never a fair
 * comparison (`broken`): a positive case that does not compile, or a reject
 * case that does, has no answer for `--compat` to keep.
 */
const erase = async (name) => {
  if (stopped) {
    return null
  }
  const reject = fs.existsSync(path.join(casesDir, `${name}.err`))
  const result = { name, reject, files: 0, diagnostics: 0, numbered: 0, broken: "", difference: null }
  const differs = (flags, claim, difference) => {
    result.difference = { flags, claim, difference }
    stopped = true
    return result
  }
  /** `base` against `dialect`, the second with its mark taken out; true when they differ. */
  const compare = async (flags, base, dialect, claim) => {
    const marked = await compile(name, [...flags, ...dialect])
    const { answer, missing } = unmarked(marked)
    if (marked.status === 0 && missing !== null) {
      const file = marked.files.find((f) => f.name === missing)
      differs(flags, `${FLAG} left the module ${missing} without its \`!nish.compat\` mark`, [
        "",
        Buffer.from("(a `!nish.compat = !{...}` line)"),
        file.bytes,
      ])
      return true
    }
    const difference = firstDifference(base, answer)
    if (difference !== null) {
      differs(flags, `${claim} ${difference[0]}`, difference)
    }
    return difference !== null
  }
  const mode = numberModeOf(caseArgs(name))
  const pinned = caseArgs(name).includes(NUMBER_MODE)
  const golden = reject
    ? [["--json"]]
    : GOLDEN_FLAGS.filter(([suffix]) => fs.existsSync(path.join(casesDir, `${name}${suffix}`))).map(
        ([, f]) => f
      )
  for (const flags of [[], ...golden]) {
    const without = await compile(name, flags)
    if (reject ? without.status !== 1 : without.status !== 0) {
      result.broken =
        `${name}: ${reject ? "has a .err but is not rejected with exit 1" : "has no .err but does not compile"}` +
        ` (exit ${without.status}${without.signal === null ? "" : `, ${without.signal}`}) before ${FLAG} is passed\n` +
        without.stderr.toString("utf8")
      stopped = true
      return result
    }
    if (await compare(flags, without, [FLAG, NUMBER_MODE, mode], `${FLAG} changed`)) {
      return result
    }
    result.files += without.files.length
    result.diagnostics += flags.includes("--json") ? codedDiagnostics(without.stdout) : 0
    if (pinned) {
      continue
    }
    const double = await compile(name, [...flags, NUMBER_MODE, "f64"])
    if (await compare(flags, double, [FLAG], `${FLAG} is not \`${NUMBER_MODE} f64\` in`)) {
      return result
    }
    result.numbered += flags.length === 0 ? 1 : 0
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
  const { flags, claim, difference } = broken.difference
  const [, without, withFlag] = difference
  const at = firstDifferingLine(without, withFlag)
  // Both answers in full, beside the tree the last compile left behind.
  const kept = (side) => path.join(outDir, `${broken.name}.${side}.txt`)
  fs.writeFileSync(kept("without"), without)
  fs.writeFileSync(kept("with"), withFlag)
  console.error(
    `compat-erasure: ${broken.name}${flags.length > 0 ? ` (${flags.join(" ")})` : ""}: ${claim}, ` +
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
    `${sum(results, "numbered")} cases the same under ${FLAG} as under \`${NUMBER_MODE} f64\`, ` +
    `${cases.length - results.length} skipped`
)
