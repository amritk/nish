#!/usr/bin/env node
/**
 * Rewrite `tests/shard-costs.json` from the logs of green CI runs.
 *
 *   node scripts/shard-costs.mjs <run-dir> <run-dir> <run-dir> ...      print the table
 *   node scripts/shard-costs.mjs --write <run-dir> ...                   and write it
 *   node scripts/shard-costs.mjs --drop <regex> ... <run-dir> ...         without a removed cost
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
 *   check to its last one, looked for after the golden cases' checks (from
 *   `PRE_LINK_STARTS`); one after them runs until the next section that
 *   shard ran starts, or its summary.
 * - `shardOne` is what only shard 1 runs: each stretch of its own checks
 *   after the link programs (`SHARD_ONE_STARTS`) until the next section or
 *   stretch starts, plus its job's steps after the suite less the ones that
 *   moved to the `examples` job (`MOVED_STEPS`). A `pinned` section likewise
 *   takes its shard's steps after the suite, since they are there to read it.
 *   Measured by stretch, a run from before a `tail` group was dealt, when
 *   shard 1 ran it between blocks of its own, gives the same pieces as one
 *   after.
 *
 * **`--drop <regex>`** (repeatable) measures the runs as though every check
 * whose name the regex matches had taken no time: the gap before each such
 * line is cut from the log's clock, so whichever piece held it shrinks by it.
 * It is for a cost a change has removed that the runs being measured still
 * paid, such as the core dumps the `debug arena` checks wrote before they ran
 * under `prlimit --core=1:1`. The gap is all the time since the previous
 * check, so it also takes whatever that check's code did before printing it:
 * a `staleBuild` check compiles its program, then runs it, then prints one
 * line, and dropping it cuts the compile too. A regex that matches no check in
 * any run is an error, so a stale one does not linger in a command.
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
const drops = []
const runs = []
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--write") {
    continue
  }
  if (argv[i] === "--drop" && i + 1 < argv.length) {
    drops.push({ re: new RegExp(argv[++i]), hits: 0 })
    continue
  }
  runs.push(argv[i])
}
// A median of fewer than three runs is one runner's luck, not a measurement;
// and a flag this does not know (`--help`, a typo) is not a run directory.
if (runs.length < 3 || runs.some((a) => a.startsWith("-"))) {
  console.error(
    "usage: node scripts/shard-costs.mjs [--write] [--drop <regex>]... <unzipped run log dir>... (at least three green runs)"
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
  // Under `--delegate-sanitizers` the `runtime_sanitize` rows are delegations,
  // and the section's first check is the `fuzz:` one that reads scripts/fuzz.sh.
  sanitizers: /^(runtime_sanitize|fuzz):/,
  nishRunner: /^tests\/nish\/run\.ts /,
  bench: /^bench: /,
  runtimeCache: /^runtime cache:/,
  sqliteLink: /^sqlite-link:/,
  fileServer: /^file-server:/,
  differential: /^differential: native and Node/,
  p256Seams: /^p256/,
  // Its own first check, not any `net_` one: the `net_tcp_connect` and
  // `net_udp_echo` checks print before the link programs, and a match there
  // ends the link programs before they begin.
  netStartup: /^net_http1_server: startup\.ts links$/,
  threadWasi: /^(skipped: )?link\/thread_mutex_counter: (the `--profile wasi` build|no WASI sysroot)/,
  cryptoChecks: /^nish:secret: (the wipe survives|no opt)/,
  arrayChecks: /^arr_range_call/,
  runtimeChecks: /^async: /,
  simd: /^simd: /,
  cliChecks: /^tests\/nish\/cli\.ts /,
  releaseChecks: /^runtime\/nish\.d\.ts type-checks/,
  cSymbols: /^c-symbols:/,
  runCache: /^module cache:/,
  netLimits: /^thread_stack: /,
  sandboxGrants: /^sandbox dependency grants: /,
  // Not thread_mutex_counter's line, which is `threadWasi`'s.
  wasiLinks: /^(skipped: )?link\/(?!thread_mutex_counter:)\w+: (the `--profile wasi` build|no WASI sysroot)/,
  wasmHost: /^(wasm-host: |wasm-ld not installed)/,
  stdPanics: /^std-panics: /,
  persist: /^persist: /,
  wasmPages: /^page-frame: /,
  sizeBudgets: /^wasm-size: /,
  pgo: /^pgo: /,
  licences: /^third-party-licence: /,
  osHost: /^(os_[a-z_]+|waitPid): /,
  term: /^(term_(calls|import|pty|restore)|caps_tty): (?!(under )?the `--profile wasi`)/,
  termWasi: /^(term_\w+: (under )?the `--profile wasi`|skipped: term_[\w, ]+: no WASI sysroot)/,
  netTcp: /^net_tcp(_echo|_calls)?: /,
  netUnix: /^net_unix: /,
  netMss: /^net_mss: /,
  fileWasi: /^((file_\w+|mem_file_stream_flat): the `--profile wasi`|skipped: file_: no WASI sysroot)/,
  fnref: /^fnref/,
  netTlsTcp: /^net_tls_tcp: /,
  http2: /^net_http2_cleartext: /,
  tlsClient: /^net_tls_client_tcp: /,
  tlsRsa: /^net_tls_rsa_server: /,
  diagnostics: /^(diagnostics|codes|union_scale|security-scope|dbg_locals|-g|objdump)[: ]/,
  performance: /^(performance|mem_loop_scope|perf_bounds_toi32_user)[: ]/,
  memAwfy: /^mem_awfy: /,
  fix: /^fix /,
  h1Between: /^http1_between: /,
  unboundedPass: /^nl9018: /,
  breakWeb: /^break-web: /,
}
/**
 * The check after the golden cases' own: a section before the link programs
 * is looked for from here on, since the cases' checks carry the same names
 * as some sections' (`os_now_i32: IR matches golden` against `os_host`'s).
 */
const PRE_LINK_STARTS = /^native run limit: /
/**
 * Where each stretch of what only shard 1 runs starts: its first check after
 * the stop, and, for a run from before the `tail` groups from `netLimits` to
 * `licences` were dealt, the first check of each stretch of shard 1's own
 * code those groups' blocks sat between (run 44481754425). In a run after
 * that every one of these prints after the first, so the stretches simply sum.
 */
const SHARD_ONE_STARTS = [
  /^every program LINK_READ_LATER keeps in shard 1/,
  /^sandbox: /,
  /^unsafe_get_set: /,
  /^kernels: /,
  /^cpu level: /,
  /^hardening: /,
  /^WP22 arrow-corpus: /,
]
/**
 * The steps after the suite that the `test` job's shard 1 ran until they moved
 * to the `examples` job: the smoke script, the cookbook check and the size
 * report. A run from before the move paid them in shard 1, and they are no
 * longer its cost.
 */
const MOVED_STEPS =
  /^##\[group\]Run (bash scripts\/smoke\.sh|bash docs\/cookbook\/regen\.sh --check|build\/nish examples\/add\.ts -o build\/add\.ll)/
/** What a shard that stops prints for every section after the link programs it does not run. */
const STOPPED = "every section after the tests/link programs that is not dealt"

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

/**
 * One log line: its time in seconds and, for a check, its name. The time is
 * the log's clock less every gap `--drop` cut before it.
 */
const parse = (log) => {
  let cut = 0
  let last = Number.NaN
  return log.split("\n").map((line) => {
    const m = /^\uFEFF?(\d{4}-\d\d-\d\dT[\d:.]+Z) (.*)$/.exec(line)
    const raw = m ? Date.parse(m[1]) / 1000 : Number.NaN
    const check = m ? /^(?:PASS|SKIP|FAIL) {2}(.*)$/.exec(m[2]) : null
    const drop = check ? drops.find((d) => d.re.test(check[1])) : undefined
    if (drop !== undefined && !Number.isNaN(last)) {
      drop.hits++
      cut += raw - last
    }
    if (!Number.isNaN(raw)) {
      last = raw
    }
    return { t: raw - cut, body: m ? m[2] : line, check: check ? check[1] : null }
  })
}

const LINK = /^link\/([^:]+)[: ]/

/** The pieces one shard's log measures, keyed as the table keys them. */
const measureShard = (lines, shard, shards, linkCount) => {
  const summary = lines.findIndex((l) => /^\d+ passed, \d+ failed/.test(l.body))
  if (summary < 0) {
    fail(`shard ${shard}/${shards} has no summary line; was the run green?`)
  }
  // A replayed program (tests/link-results.js) printed its checks without
  // building anything, so its gap is not what it costs. A pull request's run
  // can replay; the push to main's never does, so measure those.
  const replayed = lines.filter((l) => /^REPLAY link\//.test(l.body)).length
  if (replayed > 0) {
    fail(
      `shard ${shard}/${shards} replayed ${replayed} link program(s) from --link-results, so their seconds are not their cost; ` +
        "measure runs of a push to main, which build every program"
    )
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
  // Each section after the link programs, in the order they run: where it
  // starts. A shard that stopped and ran a `tail` group under no name of its
  // own is from a run before that group was dealt, when shard 1 ran it.
  const stopped = delegated.has(STOPPED)
  const after = []
  const starts = []
  // The golden cases print first, under their own names, and a case's name
  // can match a section's recognizer (`arr_range_call_generic: IR matches
  // golden` against `arrayChecks`), so no section is looked for before them.
  let from = Math.max(0, find(PRE_LINK_STARTS, 0, summary))
  for (const s of owned.filter((o) => !o.beforeLink)) {
    const i = find(RECOGNIZERS[s.key], from, summary)
    if (i < 0 && s.tail && stopped && shard > 1) {
      continue
    }
    if (i < 0) {
      fail(
        `shard ${shard}/${shards} ran ${s.key} (it does not delegate it) but prints nothing ${RECOGNIZERS[s.key]} matches`
      )
    }
    after.push(s)
    starts.push(i)
    from = i + 1
  }
  // Shard 1's own stretches: the first prints once, after its link programs,
  // and the rest are looked for from there.
  const pieces = []
  if (shard === 1) {
    const first = find(SHARD_ONE_STARTS[0], 0, summary)
    for (const re of SHARD_ONE_STARTS) {
      const i = find(re, first, summary)
      if (i < 0) {
        fail(`shard 1/${shards} prints no check ${re} matches after its link programs`)
      }
      pieces.push(i)
    }
  }
  // Every start, sorted: each piece runs until the next one starts, or the summary.
  const bounds = [...starts, ...pieces].sort((a, b) => a - b)
  const until = (i) => {
    const next = bounds.find((b) => b > i)
    return next === undefined ? lines[summary].t : before(next)
  }
  // The link programs end where the first section after them starts, or where
  // the shard stops; they are the run of `link/` checks just before that, with
  // whatever else prints between them (a delegation, a failure's detail).
  const linkEnd = bounds.length > 0 ? bounds[0] : summary
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
  const preLink = find(PRE_LINK_STARTS, 0, linkStart)
  if (preLink < 0) {
    fail(`shard ${shard}/${shards} prints nothing ${PRE_LINK_STARTS} matches before its link programs`)
  }
  for (const s of owned.filter((o) => o.beforeLink)) {
    const first = find(RECOGNIZERS[s.key], preLink, linkStart)
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
  // Each moved step lasts until the next step's group, or the job's cleanup.
  let moved = 0
  for (let i = summary; i < lines.length; i++) {
    if (MOVED_STEPS.test(lines[i].body)) {
      const next = lines.findIndex((l, j) => j > i && /^(##\[group\]Run |Post job cleanup\.)/.test(l.body))
      moved += (next < 0 ? jobEnd : lines[next].t) - lines[i].t
    }
  }
  const afterSuite = jobEnd - lines[summary].t - moved
  after.forEach((s, k) => {
    out[s.key] = until(starts[k]) - before(starts[k]) + (s.pinned ? afterSuite : 0)
  })
  if (shard === 1) {
    out.shardOne = pieces.reduce((sum, i) => sum + until(i) - before(i), 0) + afterSuite
  }
  const total = (lines[summary].t - lines.find((l) => !Number.isNaN(l.t)).t) / 60
  const toLink = (before(linkStart) - lines.find((l) => !Number.isNaN(l.t)).t) / 60
  console.error(
    `  shard ${shard}/${shards}: ${total.toFixed(1)} min to its summary, ${toLink.toFixed(1)} min before its ` +
      `${names.size} link programs; ran ${[...owned.filter((o) => o.beforeLink), ...after].map((s) => s.key).join(", ") || "no dealt section"}`
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
for (const d of drops) {
  if (d.hits === 0) {
    fail(`--drop ${d.re} matches no check in any run`)
  }
}
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
