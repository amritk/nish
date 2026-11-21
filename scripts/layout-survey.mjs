#!/usr/bin/env node
// The WP48 stage-5 survey: the `--link --explain-layout` report over the
// compiler (`src/compile.ts`) and over every nish-cmp corpus program with a
// `main`, written to `docs/wp48-layout-survey.txt`.
//
//   node scripts/layout-survey.mjs                 rewrite the survey with build/nish
//   node scripts/layout-survey.mjs --nish <bin>    ...with another compiler
//   node scripts/layout-survey.mjs -j <n>          programs compiled at once (default: cores)
//
// The corpus is nish-cmp's (`tests/self/corpus.js`: `programs()` and the
// `tests/link/` programs), each built with the flags its own directory gives
// it (`extraArgs`). A program whose entry module exports no `main` is named in
// the survey's last section and not built: a closed `--link` build of one is
// a script, which the stage-5 question is not about. A build the compiler
// refuses before the report is named with its exit status and its first
// error, or its last line when it names none.
//
// Each report is copied verbatim: its `layout:` lines and its summary line,
// with nothing else the build writes to stderr. The report is printed before
// code generation, so the build is stopped once the summary line arrives: the
// survey reads analysis, not binaries.
import { spawn } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { withAllowPanics } from "../tests/allow-panics.js"
import { extraArgs, linkPrograms, programs, root } from "../tests/self/corpus.js"

const args = process.argv.slice(2)
const option = (name, fallback) => {
  const at = args.indexOf(name)
  return at >= 0 ? args[at + 1] : fallback
}
const nish = path.resolve(root, option("--nish", "build/nish"))
const jobs = Number(option("-j", String(os.availableParallelism())))
const out = path.join(root, "docs", "wp48-layout-survey.txt")

if (!fs.existsSync(nish)) {
  console.error(`layout-survey: no compiler at ${path.relative(root, nish)}; run npm run build`)
  process.exit(2)
}

const hasMain = (file) =>
  /^export\s+(?:async\s+)?(?:const|let|function)\s+main\b/m.test(fs.readFileSync(file, "utf8"))

const corpus = [...programs(), ...linkPrograms().map((program) => program.main)]
const surveyed = [path.join(root, "src", "compile.ts")]
const noMain = []
for (const file of corpus) {
  if (path.relative(root, file) === "src/compile.ts") {
    continue
  }
  if (hasMain(file)) {
    surveyed.push(file)
  } else {
    noMain.push(file)
  }
}

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "nish-layout-survey-"))
const SUMMARY = /^explain-layout: \d+ of \d+ classes compact$/

// The flags a program's directory gives it that the survey passes on: the
// checker's and the code generator's own, with their values. Any other flag
// names an output or a target, which would move test 1's answer away from
// the closed native build the survey asks about, so it is dropped.
const KEPT = new Map([
  ["--number-mode", 1],
  ["--deny", 1],
  ["--allow", 1],
  ["--profile", 1],
  ["--deny-panics", 0],
  ["--deny-retention", 0],
  ["--threads", 0],
  ["--deterministic", 0],
  ["--no-strict-exports", 0],
  ["--strict-exports", 0],
  ["-g", 0],
])
const keptFlags = (flags) => {
  const kept = []
  for (let i = 0; i < flags.length; i++) {
    const values = KEPT.get(flags[i])
    if (values !== undefined) {
      kept.push(...flags.slice(i, i + 1 + values))
      i += values
    }
  }
  return kept
}

/** One build's report lines, or its refusal, as `{ lines, status, reason }`. */
const survey = (file, index) =>
  new Promise((resolve) => {
    const binary = path.join(scratch, `p${index}`)
    const flags = keptFlags(extraArgs(file))
    // The corpus and src/ panic on purpose: `--allow-panics` when the compiler lists it.
    const argv = withAllowPanics(nish, [
      path.relative(root, file),
      ...flags,
      "--link",
      binary,
      "--explain-layout",
    ])
    const child = spawn(nish, argv, {
      cwd: root,
      stdio: ["ignore", "ignore", "pipe"],
    })
    let text = ""
    let done = false
    child.stderr.setEncoding("utf8")
    child.stderr.on("data", (chunk) => {
      text += chunk
      if (!done && text.split("\n").some((line) => SUMMARY.test(line))) {
        done = true
        child.kill("SIGKILL")
      }
    })
    child.on("close", (status) => {
      const lines = text.split("\n").filter((line) => line.includes(": layout: ") || SUMMARY.test(line))
      // A refused build's reason: its first error, else its last line.
      const said = text.split("\n").filter((line) => line.trim().length > 0)
      const reason = said.find((line) => /\berror\b|^--[a-z-]+: /.test(line)) ?? said.at(-1) ?? ""
      resolve({ lines, status: done ? 0 : status, reason: reason.replaceAll(root + path.sep, "") })
    })
  })

const results = new Array(surveyed.length)
let next = 0
const worker = async () => {
  while (next < surveyed.length) {
    const index = next
    next += 1
    results[index] = await survey(surveyed[index], index)
  }
}
await Promise.all(Array.from({ length: Math.max(1, jobs) }, worker))
fs.rmSync(scratch, { recursive: true, force: true })

const rel = (file) => path.relative(root, file)
const body = []
const refused = []
let classes = 0
let compact = 0
surveyed.forEach((file, index) => {
  const { lines, status, reason } = results[index]
  const summary = lines.find((line) => SUMMARY.test(line))
  if (summary === undefined) {
    refused.push(`${rel(file)}: exit ${status}: ${reason}`)
    return
  }
  const [, picked, of] = /(\d+) of (\d+)/.exec(summary)
  compact += Number(picked)
  classes += Number(of)
  body.push(`== ${rel(file)}`, ...lines, "")
})

const text = [
  "# WP48 stage-5 survey: `nish <program> --link <out> --explain-layout`",
  "#",
  "# Generated by `node scripts/layout-survey.mjs`; do not edit by hand.",
  "# The compiler (src/compile.ts) and every nish-cmp corpus program with a",
  "# `main` (tests/self/corpus.js), each followed by its report verbatim.",
  `# ${surveyed.length - refused.length} programs reported, ${compact} of ${classes} class lines compact`,
  "# (a std class is counted once per program that reports it).",
  "",
  ...body,
  `== refused before the report (${refused.length})`,
  ...refused,
  "",
  `== left out: no \`main\` (${noMain.length})`,
  ...noMain.map(rel),
  "",
].join("\n")
fs.writeFileSync(out, text)
console.error(
  `wrote ${rel(out)}: ${surveyed.length} programs, ${refused.length} refused, ${noMain.length} without main`
)
