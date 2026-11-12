#!/usr/bin/env node
// WP28 spike S2: is application TypeScript `async` by contagion or by need?
// Reproduces every figure in README.md.
//
//   node bench/wp28-s2/run.mjs [--sample 48] [--only <name>] [--json <file>]
//
// For each application pinned in corpus.json it runs `npm pack` into a fresh
// directory under os.tmpdir(), refuses a tarball whose integrity is not the
// pinned one, unpacks it, and hands every TypeScript source file that is not a
// declaration or a test to census.mjs. Nothing fetched is written inside the
// repository, and the directory is removed on the way out.
//
// It prints the class table, the leaf kinds, the reasons behind the unknown
// column, and the shapes strict `async` is read against. `--sample N` then
// prints N `async` functions with their class and every source the census
// found, drawn by a seeded order so a rerun draws the same ones: the hand
// audit in README.md is of that list. Last, if build/nish is there, it
// compiles each reduced example in strict/ and prints the exit code and the
// diagnostic, which is what README.md's "What strict already does" records.
//
// The counts are exact for a pinned tarball: there is no noise band, and a
// rerun prints the same table. Needs network access to the npm registry.
import { execFileSync, spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { CLASSES, census } from "./census.mjs"

const here = import.meta.dirname
const args = process.argv.slice(2)
const option = (name) => {
  const at = args.indexOf(name)
  return at >= 0 ? args[at + 1] : null
}
const sampleSize = Number(option("--sample") ?? "0")
const only = option("--only")
const jsonOut = option("--json")
const SAMPLE_SEED = "wp28-s2"

const corpus = JSON.parse(readFileSync(join(here, "corpus.json"), "utf8"))
const applications = corpus.applications.filter((app) => only === null || app.name === only)

const TEST_PATH = /(^|\/)(node_modules|tests?|__tests__|__mocks__|__fixtures__|fixtures|e2e|specs?)\//
const TEST_FILE = /\.(test|spec|e2e|bench)\.tsx?$/
const isSource = (path) =>
  /\.tsx?$/.test(path) && !/\.d\.[cm]?ts$/.test(path) && !TEST_PATH.test(path) && !TEST_FILE.test(path)

const fetched = (app, into) => {
  const spec = `${app.name}@${app.version}`
  const packed = JSON.parse(
    execFileSync("npm", ["pack", spec, "--json", "--pack-destination", into, "--registry", corpus.registry], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
  )[0]
  if (packed.integrity !== app.integrity) {
    throw new Error(
      `${spec}: the registry's tarball is ${packed.integrity}, corpus.json pins ${app.integrity}`
    )
  }
  const tarball = readdirSync(into).find((f) => f.endsWith(".tgz"))
  execFileSync("tar", ["-xzf", join(into, tarball), "-C", into])
  const root = join(into, "package")
  return { root, files: readdirSync(root, { recursive: true }).filter(isSource).sort() }
}

const percent = (n, of) => (of === 0 ? "-" : `${((100 * n) / of).toFixed(1)}%`)
const table = (head, rows) => {
  console.log(`| ${head.join(" | ")} |`)
  console.log(`| ${head.map((_, i) => (i === 0 ? "---" : "---:")).join(" | ")} |`)
  for (const row of rows) {
    console.log(`| ${row.join(" | ")} |`)
  }
  console.log("")
}

/** The two readings of one application's counts, each with unknown as its error bar. */
const readings = (c) => {
  const total = CLASSES.reduce((sum, cls) => sum + c[cls], 0)
  const need = c.leaf + c.mixed
  const contagion = c["contagion-blocks"] + c["contagion-unknown"] + c["contagion-never"] + c["no-wait"]
  const never = c["contagion-never"] + c["no-wait"]
  return {
    total,
    direct: { low: contagion, high: contagion + c.unknown },
    transitive: { low: never, high: never + c["contagion-unknown"] + c.unknown },
    need,
  }
}

const work = mkdtempSync(join(tmpdir(), "nish-wp28-s2-"))
const results = []
try {
  for (const app of applications) {
    const into = mkdtempSync(join(work, "app-"))
    const { root, files } = fetched(app, into)
    results.push({ app, result: census(root, files) })
    rmSync(into, { recursive: true, force: true })
  }
} finally {
  rmSync(work, { recursive: true, force: true })
}

const sum = (pick) => results.reduce((n, r) => n + pick(r.result), 0)
const totalCounts = Object.fromEntries(CLASSES.map((cls) => [cls, sum((r) => r.counts[cls])]))

console.log("## The corpus\n")
table(
  ["application", "version", "source files", "functions", "`async`"],
  results.map(({ app, result }) => [app.name, app.version, result.files, result.functions, result.async])
)

console.log("## `async` functions by class\n")
const classRow = (name, c) => [
  name,
  CLASSES.reduce((n, cls) => n + c[cls], 0),
  ...CLASSES.map((cls) => c[cls]),
]
table(
  ["application", "`async`", ...CLASSES],
  [...results.map(({ app, result }) => classRow(app.name, result.counts)), classRow("all", totalCounts)]
)

console.log("## By contagion, as a share of `async` functions (low to high: the unknown column is the gap)\n")
const readingRow = (name, c) => {
  const r = readings(c)
  return [
    name,
    percent(r.need, r.total),
    `${percent(r.direct.low, r.total)} to ${percent(r.direct.high, r.total)}`,
    `${percent(r.transitive.low, r.total)} to ${percent(r.transitive.high, r.total)}`,
  ]
}
table(
  ["application", "waits outside itself", "waits only on the program", "reaches nothing outside"],
  [...results.map(({ app, result }) => readingRow(app.name, result.counts)), readingRow("all", totalCounts)]
)

const merged = (pick) => {
  const all = new Map()
  for (const { result } of results) {
    for (const [key, n] of pick(result)) {
      all.set(key, (all.get(key) ?? 0) + n)
    }
  }
  return [...all].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
}
const asyncTotal = sum((r) => r.async)

console.log("## What the leaf and mixed functions wait on (a function counts once per kind)\n")
table(
  ["kind", ...results.map(({ app }) => app.name), "all"],
  merged((r) => r.leafKinds).map(([kind, n]) => [
    kind,
    ...results.map(({ result }) => new Map(result.leafKinds).get(kind) ?? 0),
    n,
  ])
)
console.log("Most common, all applications:\n")
table(["waited on", "functions"], merged((r) => r.leafDetails).slice(0, 15))

console.log("## Why a function is in the unknown column (a function counts once per reason)\n")
table(
  ["reason", "functions"],
  merged((r) => r.unknownWhys)
)

console.log("## The shapes, against strict `async`\n")
const shapeTable = (title, key, of) => {
  const rows = merged((r) => Object.entries(r.shapes[key]))
  const total = of ?? rows.reduce((n, [, count]) => n + count, 0)
  table(
    [title, "count", "share"],
    rows.map(([shape, n]) => [shape, n, percent(n, total)])
  )
}
shapeTable("how an `async` function is declared", "declaration", asyncTotal)
shapeTable("its return type", "returnType", asyncTotal)
shapeTable("what an `await` is applied to", "awaitOperand")
shapeTable("where the `await` stands", "awaitPosition")
shapeTable("a call to one of the program's `async` functions is", "asyncCall")
table(
  ["other", "count"],
  [
    ["`for await` loops", sum((r) => r.shapes.forAwait)],
    ["`async` functions on a cycle of awaits", sum((r) => r.shapes.recursive)],
  ]
)

if (sampleSize > 0) {
  const order = (app, row) =>
    createHash("sha256").update(`${SAMPLE_SEED}:${app}:${row.file}:${row.line}`).digest("hex")
  const drawn = results
    .flatMap(({ app, result }) =>
      result.rows.map((row) => ({ app: app.name, row, key: order(app.name, row) }))
    )
    .sort((a, b) => (a.key < b.key ? -1 : 1))
    .slice(0, sampleSize)
  console.log(`## The audit sample: ${drawn.length} of ${asyncTotal}, seed "${SAMPLE_SEED}"\n`)
  drawn.forEach(({ app, row }, i) => {
    console.log(`${i + 1}. [${row.class}] ${app} ${row.file}:${row.line} ${row.name}`)
    for (const source of row.sources) {
      console.log(`     ${source}`)
    }
  })
  console.log("")
}

if (jsonOut !== null) {
  writeFileSync(
    jsonOut,
    JSON.stringify(
      results.map(({ app, result }) => ({ app: app.name, version: app.version, ...result })),
      null,
      2
    )
  )
}

// ---- what strict `async` does with one reduced example of each shape ----

const compiler = join(here, "..", "..", "build", "nish")
console.log("## Strict `async` on a reduced example of each shape\n")
if (existsSync(compiler)) {
  const out = mkdtempSync(join(tmpdir(), "nish-wp28-s2-strict-"))
  const rows = readdirSync(join(here, "strict"))
    .filter((f) => f.endsWith(".ts"))
    .sort()
    .map((file) => {
      const run = spawnSync(compiler, [join(here, "strict", file), "-o", join(out, "out.ll")], {
        encoding: "utf8",
      })
      const code = /\bNL\d{4}\b/.exec(`${run.stderr}${run.stdout}`)
      return [file, run.status, code === null ? "accepted" : code[0]]
    })
  rmSync(out, { recursive: true, force: true })
  table(["example", "exit", "diagnostic"], rows)
} else {
  console.log("skipped: build/nish is not built (`npm run build`)\n")
}
