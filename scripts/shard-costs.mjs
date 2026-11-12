#!/usr/bin/env node
/**
 * Rewrite `tests/shard-costs.json` from the logs of green CI runs.
 *
 *   node scripts/shard-costs.mjs <run-dir> <run-dir> <run-dir> ...      print the table
 *   node scripts/shard-costs.mjs --write <run-dir> ...                   and write it
 *
 * A `<run-dir>` is a `ci.yml` run's log archive, unzipped: the "Download log
 * archive" button on the run's page, or
 * `gh api repos/<owner>/<repo>/actions/runs/<id>/logs > run.zip && unzip -d <dir> run.zip`.
 * Only its `<n>_test (<os>, shard <i>_<n>).txt` files are read, and every one
 * of a run's shards must be there.
 *
 * Why this exists. `tests/run.js` deals its link programs and its
 * `DEALT_SECTIONS` across the `test` job's shards by the seconds this table
 * gives them, and the deal is only as even as the table is true. Written by
 * hand from one run, it drifted: the sections that moved into shard 8 cost
 * about 330 s there against the 220 s the table gave them, and shard 8 became
 * the longest job of every run. One run is also not a measurement, since a
 * GitHub-hosted runner varies by minutes on the same shard; so this takes the
 * median of each piece over every run it is given (`docs/wp10-ci.md`,
 * "Regenerating the shard costs").
 *
 * **What a piece's seconds are.** Each is read from the timestamps GitHub puts
 * on every log line, as the gap between two printed lines, the same way
 * `scripts/ci-profile.mjs` reads a local run:
 *
 * - a link program is the gap from the last line of the program printed before
 *   it to its own last line. The pool reports programs in order, so a program
 *   that finished behind a slower one reads near 0; `linkFloor` in
 *   `tests/run.js` is what keeps that from dealing it as free.
 * - a section is found in the one shard that ran it (every other shard's log
 *   delegates it by name) by the name of a check it prints (`RECOGNIZERS`). A
 *   section before the link programs is the gap from the line before its first
 *   check to its last one; one after them runs until the next section that
 *   shard ran starts, or its summary.
 * - `shardOne` is what only shard 1 runs: from its first check after the
 *   dealt sections to its summary, plus its job's steps after the suite. A
 *   `pinned` section likewise takes its shard's steps after the suite, since
 *   they are there to read it.
 *
 * Anything it cannot find is an error, never a guess: a section with no
 * recognizer, a recognizer that matches nothing in the shard that ran the
 * section, or a shard whose link programs do not number what shard 1 says it
 * dealt it. A renamed check fails this script rather than writing a 0.
 *
 *   node scripts/shard-costs.mjs --check-runner <nish-runner> <slices> <parts>
 *
 * checks the deal the Nish runner (`tests/nish/run.ts`) makes from the same
 * table's `link` costs, through its `--list`: that the `<slices>` slices
 * cover the whole list once, that each slice's `<parts>` parts (what `--jobs`
 * runs as separate processes) cover that slice once, and that no slice or
 * part carries more link cost than the mean of its siblings plus the dearest
 * program among them, which a cost deal guarantees and the position deal it
 * replaced broke (504 s against a mean of 418 s on the last of three slices).
 */
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const argv = process.argv.slice(2)

/**
 * The `--check-runner` mode; see the header. It answers before the
 * log-reading part of this file asks for run directories.
 */
const checkRunner = (runner, slices, parts) => {
  if (!runner || !(slices >= 1) || !(parts >= 1)) {
    console.error("usage: node scripts/shard-costs.mjs --check-runner <nish-runner> <slices> <parts>")
    process.exit(2)
  }
  const list = (...flags) => {
    const r = spawnSync(runner, ["--list", ...flags], { cwd: root, encoding: "utf8" })
    if (r.status !== 0) {
      console.error(`${runner} --list ${flags.join(" ")} exited ${r.status}: ${r.stderr}`)
      process.exit(1)
    }
    return r.stdout.split("\n").filter((l) => l.length > 0)
  }
  const costs = JSON.parse(fs.readFileSync(path.join(root, "tests", "shard-costs.json"), "utf8")).link
  // tests/run.js's `linkFloor`, which the runner's `dealByCost` copies.
  const cost = (line) => {
    const name = line.slice("link ".length)
    const floor = fs.existsSync(path.join(root, "tests", "link", name, "expected.err")) ? 0.05 : 0.5
    return Math.max(costs[name] ?? 0, floor)
  }
  const problems = []
  // `pieces` must hold exactly `all`'s lines, and none more link cost than the mean plus its dearest program.
  const covers = (what, all, pieces) => {
    const joined = pieces.flat().sort()
    const sorted = [...all].sort()
    if (joined.length !== sorted.length || joined.some((l, i) => l !== sorted[i])) {
      problems.push(
        `${what}: its ${pieces.length} pieces list ${joined.length} items, not the ${sorted.length} it has once each`
      )
    }
    const links = pieces.map((p) => p.filter((l) => l.startsWith("link ")))
    const loads = links.map((p) => p.reduce((sum, l) => sum + cost(l), 0))
    const mean = loads.reduce((a, b) => a + b, 0) / loads.length
    const dearest = Math.max(0, ...links.flat().map(cost))
    loads.forEach((load, i) => {
      if (load > mean + dearest + 1e-6) {
        problems.push(
          `${what}: piece ${i + 1} carries ${load.toFixed(1)} s of link programs, over the mean ${mean.toFixed(1)} s plus the dearest ${dearest} s`
        )
      }
    })
    return loads
  }
  const whole = list()
  const shards = []
  for (let i = 1; i <= slices; i++) {
    shards.push(list("--shard", `${i}/${slices}`))
  }
  const loads = covers("the whole list", whole, shards)
  shards.forEach((shard, i) => {
    const pieces = []
    for (let k = 1; k <= parts; k++) {
      pieces.push(list("--shard", `${i + 1}/${slices}`, "--part", `${k}/${parts}`))
    }
    covers(`slice ${i + 1}/${slices}`, shard, pieces)
  })
  if (problems.length > 0) {
    for (const p of problems) {
      console.error(p)
    }
    process.exit(1)
  }
  console.log(
    `the runner's ${slices} slices of ${whole.length} items carry ${loads.map((l) => l.toFixed(1)).join(", ")} s of link programs, each in ${parts} parts that cover it once`
  )
}

if (argv[0] === "--check-runner") {
  checkRunner(argv[1], Number(argv[2]), Number(argv[3]))
  process.exit(0)
}
const write = argv.includes("--write")
const runs = argv.filter((a) => a !== "--write")
// A median of fewer than three runs is one runner's luck, not a measurement;
// and a flag this does not know (`--help`, a typo) is not a run directory.
if (runs.length < 3 || runs.some((a) => a.startsWith("-"))) {
  console.error(
    "usage: node scripts/shard-costs.mjs [--write] <unzipped run log dir>... (at least three green runs)"
  )
  process.exit(2)
}

/**
 * The first check each dealt section prints, by its key in `DEALT_SECTIONS`.
 * A check's name is the text after `PASS  `, `SKIP  ` or `FAIL  `.
 */
const RECOGNIZERS = {
  termIo: /^term-io: /,
  emitTs: /^emit-ts: /,
  selfHosting: /^src\/ has at least one module/,
  cryptoBench: /^crypto-bench:/,
  sanitizers: /^runtime_sanitize:/,
  nishRunner: /^tests\/nish\/run\.ts /,
  bench: /^bench: /,
  runtimeCache: /^runtime cache:/,
  sqliteLink: /^sqlite-link:/,
  fileServer: /^file-server:/,
  differential: /^differential: native and Node/,
  p256Seams: /^p256/,
  netStartup: /^net_\w+: /,
  threadWasi: /^(skipped: )?link\/thread_mutex_counter: (the `--profile wasi` build|no WASI sysroot)/,
  cryptoChecks: /^nish:secret: (the wipe survives|no opt)/,
  arrayChecks: /^arr_range_call/,
  runtimeChecks: /^async: /,
  simd: /^simd: /,
  cliChecks: /^tests\/nish\/cli\.ts /,
  releaseChecks: /^runtime\/nish\.d\.ts type-checks/,
  cSymbols: /^c-symbols:/,
  runCache: /^module cache:/,
}
/** Shard 1's first check after every dealt section: where `shardOne` starts. */
const SHARD_ONE_STARTS = /^every program LINK_READ_LATER keeps in shard 1/

const fail = (message) => {
  console.error(`shard-costs: ${message}`)
  process.exit(1)
}

/**
 * `DEALT_SECTIONS` as `tests/run.js` declares it: each key, the name a shard
 * that does not run it delegates it by, whether it is `pinned`, and whether it
 * runs before the link programs. Read from the source so the table this writes
 * has exactly the keys the deal reads.
 */
const sections = (() => {
  const source = fs.readFileSync(path.join(root, "tests", "run.js"), "utf8")
  const start = source.indexOf("const DEALT_SECTIONS = {")
  const end = source.indexOf("\n}\n", start)
  const pool = source.indexOf("await pool(linkSelected")
  if (start < 0 || end < 0 || pool < 0) {
    fail("tests/run.js no longer declares DEALT_SECTIONS or runs the link pool where this looks")
  }
  const out = []
  for (const m of source.slice(start, end).matchAll(/\n {2}(\w+): \{\s*name:\s*"([^"]+)",([^}]*)\}/g)) {
    const at = source.indexOf(`dealtHere("${m[1]}")`)
    if (at < 0) {
      fail(`DEALT_SECTIONS.${m[1]} has no dealtHere("${m[1]}") block`)
    }
    if (RECOGNIZERS[m[1]] === undefined) {
      fail(`DEALT_SECTIONS.${m[1]} has no recognizer: add the first check it prints to RECOGNIZERS`)
    }
    out.push({
      key: m[1],
      name: m[2],
      pinned: /pinned:/.test(m[3]),
      tail: /tail:/.test(m[3]),
      at,
      beforeLink: at < pool,
    })
  }
  return out.sort((a, b) => a.at - b.at)
})()

/** One log line: its time in seconds and, for a check, its name. */
const parse = (log) =>
  log.split("\n").map((line) => {
    const m = /^\uFEFF?(\d{4}-\d\d-\d\dT[\d:.]+Z) (.*)$/.exec(line)
    const t = m ? Date.parse(m[1]) / 1000 : Number.NaN
    const check = m ? /^(?:PASS|SKIP|FAIL) {2}(.*)$/.exec(m[2]) : null
    return { t, body: m ? m[2] : line, check: check ? check[1] : null }
  })

const LINK = /^link\/([^:]+)[: ]/

/** The pieces one shard's log measures, keyed as the table keys them. */
const measureShard = (lines, shard, shards, linkCount) => {
  const summary = lines.findIndex((l) => /^\d+ passed, \d+ failed/.test(l.body))
  if (summary < 0) {
    fail(`shard ${shard}/${shards} has no summary line; was the run green?`)
  }
  // A failed check can stop a section early, so a red run's seconds are not its cost.
  const failed = Number(/^\d+ passed, (\d+) failed/.exec(lines[summary].body)[1])
  if (failed !== 0) {
    fail(`shard ${shard}/${shards} reports ${failed} failed; measure green runs only`)
  }
  const delegated = new Set(
    lines.map((l) => /^DELEGATED {2}(.*) -- proved by /.exec(l.body)?.[1]).filter((n) => n !== undefined)
  )
  const owned = sections.filter((s) => !delegated.has(s.name))
  const find = (re, start, to) => {
    for (let i = start; i < to; i++) {
      if (lines[i].check !== null && re.test(lines[i].check)) {
        return i
      }
    }
    return -1
  }
  const before = (i) => {
    let j = i - 1
    while (j > 0 && Number.isNaN(lines[j].t)) {
      j--
    }
    return lines[j].t
  }
  const out = {}
  const after = owned.filter((s) => !s.beforeLink)
  // Each section after the link programs, in the order they run: where it starts.
  const starts = []
  let from = 0
  for (const s of after) {
    const i = find(RECOGNIZERS[s.key], from, summary)
    if (i < 0) {
      fail(
        `shard ${shard}/${shards} ran ${s.key} (it does not delegate it) but prints nothing ${RECOGNIZERS[s.key]} matches`
      )
    }
    starts.push(i)
    from = i + 1
  }
  if (shard === 1) {
    const i = find(SHARD_ONE_STARTS, from, summary)
    if (i < 0) {
      fail(`shard 1/${shards} prints no check ${SHARD_ONE_STARTS} matches`)
    }
    starts.push(i)
  }
  // The link programs end where the first section after them starts, or where
  // the shard stops; they are the run of `link/` checks just before that, with
  // whatever else prints between them (a delegation, a failure's detail).
  const linkEnd = starts.length > 0 ? starts[0] : summary
  let linkStart = linkEnd
  for (let i = linkEnd - 1; i > 0; i--) {
    if (lines[i].check !== null) {
      if (!LINK.test(lines[i].check)) {
        break
      }
      linkStart = i
    }
  }
  const programs = []
  for (let i = linkStart; i < linkEnd; i++) {
    if (lines[i].check === null) {
      continue
    }
    const name = LINK.exec(lines[i].check)[1]
    const last = programs.at(-1)
    if (last && last.name === name) {
      last.end = i
    } else {
      programs.push({ name, end: i })
    }
  }
  const names = new Set(programs.map((p) => p.name))
  if (linkCount !== undefined && names.size !== linkCount) {
    fail(
      `shard ${shard}/${shards} prints ${names.size} link programs where shard 1 says it dealt it ${linkCount}`
    )
  }
  out.link = {}
  let prev = before(linkStart)
  for (const p of programs) {
    out.link[p.name] = (out.link[p.name] ?? 0) + Math.max(0, lines[p.end].t - prev)
    prev = lines[p.end].t
  }
  for (const s of owned.filter((o) => o.beforeLink)) {
    const first = find(RECOGNIZERS[s.key], 0, linkStart)
    if (first < 0) {
      fail(
        `shard ${shard}/${shards} ran ${s.key} but prints nothing ${RECOGNIZERS[s.key]} matches before its link programs`
      )
    }
    let last = first
    for (let i = first; i < linkStart; i++) {
      if (lines[i].check !== null && RECOGNIZERS[s.key].test(lines[i].check)) {
        last = i
      }
    }
    out[s.key] = lines[last].t - before(first)
  }
  const jobEnd = lines.findLast((l) => !Number.isNaN(l.t)).t
  const afterSuite = jobEnd - lines[summary].t
  after.forEach((s, k) => {
    const end = k + 1 < starts.length ? before(starts[k + 1]) : lines[summary].t
    out[s.key] = end - before(starts[k]) + (s.pinned ? afterSuite : 0)
  })
  if (shard === 1) {
    out.shardOne = lines[summary].t - before(starts.at(-1)) + afterSuite
  }
  const total = (lines[summary].t - lines.find((l) => !Number.isNaN(l.t)).t) / 60
  const toLink = (before(linkStart) - lines.find((l) => !Number.isNaN(l.t)).t) / 60
  console.error(
    `  shard ${shard}/${shards}: ${total.toFixed(1)} min to its summary, ${toLink.toFixed(1)} min before its ` +
      `${names.size} link programs; ran ${owned.map((s) => s.key).join(", ") || "no dealt section"}`
  )
  return out
}

/** The pieces one run measures: every shard's, merged. */
const measureRun = (dir) => {
  const files = fs
    .readdirSync(dir)
    .map((f) => ({ f, m: /^\d+_test \(.*shard (\d+)_(\d+)\)\.txt$/.exec(f) }))
    .filter((x) => x.m !== null)
    .map((x) => ({ file: path.join(dir, x.f), shard: Number(x.m[1]), shards: Number(x.m[2]) }))
    .sort((a, b) => a.shard - b.shard)
  const shards = files[0]?.shards
  if (files.length === 0 || files.length !== shards || files.some((x, i) => x.shard !== i + 1)) {
    fail(
      `${dir}: wants one test (…, shard i_n).txt for each i of n, found ${files.map((x) => x.shard).join(", ") || "none"}`
    )
  }
  console.error(`${dir}:`)
  const logs = files.map((x) => parse(fs.readFileSync(x.file, "utf8")))
  // Shard 1 names how many link programs it dealt each other shard.
  const counts = new Map()
  for (const l of logs[0]) {
    const m = /^DELEGATED {2}(\d+) tests\/link program\(s\) -- proved by shard (\d+)\//.exec(l.body)
    if (m) {
      counts.set(Number(m[2]), Number(m[1]))
    }
  }
  const run = { link: {} }
  logs.forEach((lines, i) => {
    const got = measureShard(lines, i + 1, shards, i === 0 ? undefined : (counts.get(i + 1) ?? 0))
    Object.assign(run.link, got.link)
    for (const [key, value] of Object.entries(got)) {
      if (key !== "link") {
        if (run[key] !== undefined) {
          fail(`${dir}: two shards ran ${key}`)
        }
        run[key] = value
      }
    }
  })
  for (const s of sections) {
    if (run[s.key] === undefined) {
      fail(`${dir}: no shard ran ${s.key}`)
    }
  }
  return run
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length % 2 === 1 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
}

const measured = runs.map(measureRun)
const table = { shardOne: Math.round(median(measured.map((r) => r.shardOne))) }
for (const s of sections.filter((x) => !x.tail)) {
  table[s.key] = Math.round(median(measured.map((r) => r[s.key])))
}
// A program a run did not have (added since) is left out of that run's median.
const programs = [...new Set(measured.flatMap((r) => Object.keys(r.link)))].sort()
table.link = Object.fromEntries(
  programs.map((name) => {
    const seen = measured.map((r) => r.link[name]).filter((v) => v !== undefined)
    return [name, Math.round(median(seen) * 10) / 10]
  })
)
for (const s of sections.filter((x) => x.tail)) {
  table[s.key] = Math.round(median(measured.map((r) => r[s.key])))
}

const text = `${JSON.stringify(table, null, 2)}\n`
if (write) {
  fs.writeFileSync(path.join(root, "tests", "shard-costs.json"), text)
  console.error(`wrote tests/shard-costs.json from ${runs.length} run(s)`)
} else {
  process.stdout.write(text)
}
