#!/usr/bin/env node
// Which of ci.yml's jobs a pull request needs (docs/wp10-ci.md, "Scoped
// lanes"). A lane is a job, or a pair of them, that reads a known set of
// paths: the side jobs, the `examples` job and the `test` shards; the `scope` job runs this script and writes one `<lane>=true|false`
// line per lane to $GITHUB_OUTPUT, and each lane's job skips its steps on
// `false`. The `ci-gate` job then fails unless every selected job succeeded.
//
// The rule is fail-closed: a lane is off only when *every* changed path is on
// that lane's allowlist of paths proven not read (`inert`) and on none of the
// paths it reads (`reads`, which win over `inert`). Anything this script cannot
// classify, cannot fetch or cannot parse turns every lane on.
//
//   node scripts/ci-scope.mjs                     # in the `scope` job (env below)
//   node scripts/ci-scope.mjs --files <file>      # a newline-separated path list
//   node scripts/ci-scope.mjs --backtest [<file>] # replay merged PRs
//
//   node scripts/ci-scope.mjs --gate              # in the `ci-gate` job (env below)
//
// The `scope` job's environment: GITHUB_EVENT_NAME, GITHUB_REPOSITORY,
// GITHUB_TOKEN, PR_NUMBER, PR_LABELS (a JSON array of names) and
// NISH_CI_SCOPE (the repository variable; `full` turns every lane on). The
// labels are read again from the API, so re-running a workflow after adding
// `ci:full` runs everything. Lane names are output names, so they use `_`.
//
// The `ci-gate` job's environment: NEEDS (`toJSON(needs)`) and EXPECT_SKIP (a
// JSON array of the job ids whose own `if:` is false on this run).

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

/**
 * Paths no lane reads. Each entry was checked against the lanes' entry points
 * and the files they import or open: read from the code for every command, and
 * for some also traced with `strace -f` on x86_64 Linux (docs/wp10-ci.md
 * "Scoped lanes" lists which). A lane's own `reads` carve paths back out.
 */
const INERT = [
  "docs/**",
  "web/**",
  "skills/**",
  "rfcs/**",
  "specs/**",
  ".claude/**",
  "AGENTS.md",
  "CLAUDE.md",
  "README.md",
  "SECURITY.md",
  "THIRD_PARTY_NOTICES.md",
  "llms.txt",
  "scalar.config.json",
  "biome.json",
  "biome-plugins/**",
  "knip.json",
  "tests/ci-scope/**",
  // The `test` job's spec section and `npm run lint` read these; no lane does.
  "contracts/**",
  "test/spec/**",
  ".vector-version",
  ".refcache/**",
]

/** The corpus `tests/self/corpus.js` walks, and what nish-cmp's checks open. */
const CORPUS = [
  "tests/cases/**",
  "examples/**",
  "docs/cookbook/**",
  "bench/**",
  "tests/parser/**",
  "tests/differential/**",
  "tests/link/**",
  "tests/self/**",
  "tests/allow-panics.js",
  "tests/nish-cmp.js",
  "tests/pool.js",
  "tests/driver.c",
  "CHANGELOG.md",
  "changelog/**",
]

/**
 * What a lane whose job runs `tests/run.js` reads: all of tests/, because a
 * section can open any fixture there and the lists picked file by file missed
 * one (`runtime_sanitize` compiles tests/runtime/range-test.c). Only
 * tests/ci-scope, which no lane's job opens, is taken back out (`unread`).
 */
const RUN_JS = ["tests/**"]

/** What a `tests/run.js` lane provably skips inside its read set. */
const RUN_JS_UNREAD = ["tests/ci-scope/**"]

/**
 * What the `test` job provably skips. It runs all of `npm test` (tests/run.js,
 * which spawns scripts/, bench/, .claude/hooks/*.test.mjs, npm pack over the
 * shipped files, and the guide, security records and design notes it checks
 * prose against), so its read set is everything and this list is the only way
 * a change skips it. No file the job runs opens an entry: tests/, scripts/,
 * bench/, bin/, src/, std/, runtime/ and .claude/hooks/ name them only in
 * comments, and nothing walks the tree into them (docs/wp10-ci.md, "Scoped
 * lanes").
 */
const TEST_UNREAD = [
  ".claude/*.md",
  ".claude/plans/**",
  "AGENTS.md",
  "CLAUDE.md",
  "SECURITY.md",
  "rfcs/**",
  "specs/**",
]

/** What every lane that builds a compiler from `src/` reads. */
const COMPILER = ["src/**", "std/**", "runtime/**", "scripts/**", "bin/**", "nish-capabilities.lock.json"]

/**
 * The lanes. `jobs` are ci.yml job ids and `names` their `name:` templates,
 * verbatim (tests/run.js pins both against ci.yml), and `formerNames` (optional)
 * the templates the job carried before, so the backtest still charges a
 * recorded failure under an old name to its lane; `minutes` is the runner time
 * the lane's rows took on run 45273242342 (the saving a skip buys); `reads` is
 * the lane's read set, which wins over `inert`; `unread` (optional) is what the
 * lane provably skips inside `reads`, and wins over both.
 */
export const LANES = [
  {
    name: "nish_cmp",
    jobs: ["nish-cmp"],
    // biome-ignore lint/suspicious/noTemplateCurlyInString: a GitHub Actions expression, matched verbatim
    names: ["nish-cmp (${{ matrix.seed.asset }})"],
    minutes: 13.6,
    // tests/nish-cmp.js, then fuzz.js --stage1 and --emit-ts over the corpus.
    reads: [...COMPILER, ...CORPUS],
    inert: [...INERT, "tests/**"],
  },
  {
    name: "elision",
    jobs: ["nish-cmp-elision"],
    // biome-ignore lint/suspicious/noTemplateCurlyInString: a GitHub Actions expression, matched verbatim
    names: ["nish-cmp elision (${{ matrix.seed.asset }})"],
    minutes: 7.2,
    // tests/differential/soundness.js over tests/cases and the differential corpus.
    reads: [...COMPILER, ...CORPUS],
    inert: [...INERT, "tests/**"],
  },
  {
    name: "bootstrap",
    jobs: ["bootstrap"],
    // biome-ignore lint/suspicious/noTemplateCurlyInString: a GitHub Actions expression, matched verbatim
    names: ["bootstrap (${{ matrix.seed.asset }})"],
    minutes: 6.9,
    // scripts/bootstrap.sh --verify, scripts/check-hardening.mjs and the
    // tests/nish/cli.ts contract, whose built binary compiles fixtures from
    // tests/cases and tests/link. The `test` job's fixed point is delegated
    // here, so this set holds what that check reads (tests/run.js pins it).
    // tests/allow-panics.js is what tests/self/seed.js hands every seed build through.
    reads: [
      ...COMPILER,
      "tests/nish/**",
      "tests/self/**",
      "tests/allow-panics.js",
      "tests/cases/**",
      "tests/link/**",
    ],
    inert: [...INERT, "tests/**", "examples/**", "bench/**", "CHANGELOG.md", "changelog/**"],
  },
  {
    name: "simd",
    jobs: ["simd-arm64"],
    names: ["the NEON path agrees (aarch64-linux)"],
    minutes: 5.3,
    // tests/run.js's simd, float-corpus and kernel sections, bench/*.mjs and build/test/simd/*.
    // The `crc32 kernel` section's std_compress_gzip_files gzips docs/LANGUAGE.md.
    reads: [...COMPILER, ...RUN_JS, "bench/**", "examples/**", "docs/LANGUAGE.md"],
    unread: RUN_JS_UNREAD,
    inert: [...INERT, "CHANGELOG.md", "changelog/**"],
  },
  {
    name: "sha256_macos",
    jobs: ["sha256-macos"],
    names: ["SHA-256 on Apple silicon (macos-latest)"],
    minutes: 3.1,
    // tests/simd/sha256*.c, tests/run.js sha256_hw and bench/sha256/run.mjs.
    reads: [...COMPILER, ...RUN_JS, "bench/**", "examples/**"],
    unread: RUN_JS_UNREAD,
    inert: [...INERT, "CHANGELOG.md", "changelog/**"],
  },
  {
    name: "fuzz",
    jobs: ["fuzz-smoke"],
    names: ["fuzz-smoke"],
    minutes: 4.0,
    // scripts/fuzz.sh --smoke (tests/fuzz/**) and tests/run.js runtime_sanitize,
    // which the `test` job delegates here (tests/run.js pins it).
    reads: [...COMPILER, ...RUN_JS, "bench/**", "examples/**"],
    unread: RUN_JS_UNREAD,
    inert: [...INERT, "CHANGELOG.md", "changelog/**"],
  },
  {
    name: "postgres",
    jobs: ["postgres-live"],
    names: ["postgres-live"],
    minutes: 2.0,
    // .github/actions/compiler-cache (tests/self/compiler-cache.js and
    // seed.js), tests/postgres/live/run.mjs, tls-certs.sh and the
    // bench/techempower servers.
    reads: [
      ...COMPILER,
      "tests/self/**",
      "tests/allow-panics.js",
      "tests/postgres/**",
      "bench/techempower/**",
    ],
    inert: [...INERT, "tests/**", "examples/**", "bench/**", "CHANGELOG.md", "changelog/**"],
  },
  {
    name: "test",
    jobs: ["test"],
    // biome-ignore lint/suspicious/noTemplateCurlyInString: a GitHub Actions expression, matched verbatim
    names: ["test (${{ matrix.os }}, shard ${{ matrix.shard }}/9)"],
    // biome-ignore lint/suspicious/noTemplateCurlyInString: a GitHub Actions expression, matched verbatim
    formerNames: ["test (${{ matrix.os }}, shard ${{ matrix.shard }}/8)"],
    minutes: 82.2,
    // `npm test` and the shard 1 and 2 steps after it read the whole tree but
    // TEST_UNREAD: a guide page, a security record or a design note is checked
    // by some section, so a docs-only change still runs the shards.
    reads: ["**"],
    unread: TEST_UNREAD,
    inert: [],
  },
  {
    name: "examples",
    jobs: ["examples"],
    names: ["examples"],
    minutes: 1.7,
    // .github/actions/compiler-cache, scripts/smoke.sh (examples/ and their
    // tests/smoke pins), docs/cookbook/regen.sh --check, and the size report
    // (examples/add.ts, examples/main.c, scripts/size-report.sh and the
    // ceilings in tests/runtime-budgets.js).
    reads: [
      ...COMPILER,
      "examples/**",
      "tests/smoke/**",
      "tests/self/**",
      "tests/allow-panics.js",
      "tests/runtime-budgets.js",
      "docs/cookbook/**",
      "docs/IR_COOKBOOK.md",
    ],
    inert: [...INERT, "tests/**", "bench/**", "CHANGELOG.md", "changelog/**"],
  },
]

/** The runner-minutes every job of run 45273242342 took together: what a skip is a share of. */
const RUN_MINUTES = 127

/** A changed path matching one of these turns every lane on. */
const FULL = [
  ".github/**",
  "**/package.json",
  "**/package-lock.json",
  "package*.json",
  "scripts/ci-scope.mjs",
]

/** Events that always run everything: only a pull_request may be scoped. */
const SCOPED_EVENTS = new Set(["pull_request"])

const globCache = new Map()

/**
 * Turns a glob (`**` any depth, `*` within one segment) into a regex.
 *
 * @param {string} glob the pattern
 * @returns {RegExp} an anchored regex
 */
const globRe = (glob) => {
  let re = globCache.get(glob)
  if (!re) {
    const body = glob
      .split("**/")
      .map((part) =>
        part
          .split("**")
          .map((p) => p.replace(/[.+^${}()|[\]\\?]/g, "\\$&").replace(/\*/g, "[^/]*"))
          .join(".*")
      )
      .join("(?:.*/)?")
    re = new RegExp(`^${body}$`)
    globCache.set(glob, re)
  }
  return re
}

/**
 * Whether a path matches any of the globs.
 *
 * @param {string} file a repository-relative path
 * @param {string[]} globs the patterns
 * @returns {boolean} true on a match
 */
export const matches = (file, globs) => globs.some((g) => globRe(g).test(file))

/**
 * A workflow's `on.pull_request.paths`, the globs GitHub runs it for on a pull
 * request: interop.yml is scoped by these rather than by a lane, so
 * tests/run.js checks what its jobs open against them with `matches`.
 *
 * @param {string} text the workflow's YAML
 * @returns {string[] | null} the globs in order, or null when the workflow has no such list
 */
export const workflowPaths = (text) => {
  const lines = text.split("\n")
  const on = lines.indexOf("on:")
  const pr = lines.indexOf("  pull_request:", on)
  const paths = lines.indexOf("    paths:", pr)
  if (on < 0 || pr < 0 || paths < 0 || lines.slice(on + 1, paths).some((l) => /^\S/.test(l))) {
    return null
  }
  const globs = []
  for (const line of lines.slice(paths + 1)) {
    const m = /^ {6}- "([^"]+)"$/.exec(line)
    if (m) {
      globs.push(m[1])
    } else if (!/^ {6}#/.test(line)) {
      break
    }
  }
  return globs.length > 0 ? globs : null
}

/**
 * Whether a lane can skip a change to this path: on its `unread` list, or on
 * its allowlist and off its read set.
 *
 * @param {(typeof LANES)[number]} lane the lane
 * @param {string} file a repository-relative path
 * @returns {boolean} true when the lane provably does not read it
 */
export const inertFor = (lane, file) =>
  matches(file, lane.unread ?? []) || (matches(file, lane.inert) && !matches(file, lane.reads))

/**
 * Decides every lane for one change.
 *
 * @param {object} change what the pull request is
 * @param {string} change.event the GitHub event name
 * @param {string[]} [change.labels] the pull request's label names
 * @param {string} [change.mode] the NISH_CI_SCOPE variable
 * @param {{path: string, status?: string, previous?: string}[] | null} change.files the changed files, or null when unknown
 * @param {boolean} [change.truncated] the file list hit the API's cap
 * @returns {{full: string | null, lanes: Record<string, boolean>}} `full` is why everything runs, or null
 */
export const decide = ({ event, labels = [], mode = "", files, truncated = false }) => {
  const all = (why) => ({ full: why, lanes: Object.fromEntries(LANES.map((l) => [l.name, true])) })
  if (!SCOPED_EVENTS.has(event)) {
    return all(`a ${event || "unknown"} event runs every lane`)
  }
  if (mode.trim().toLowerCase() === "full") {
    return all("the NISH_CI_SCOPE variable is `full`")
  }
  if (labels.some((l) => typeof l === "string" && l.trim().toLowerCase() === "ci:full")) {
    return all("the pull request has the `ci:full` label")
  }
  if (!Array.isArray(files) || files.length === 0) {
    return all("the changed-file list is empty or unknown")
  }
  if (truncated) {
    return all("the changed-file list was truncated")
  }
  for (const f of files) {
    if (typeof f?.path !== "string" || f.path === "") {
      return all("a changed file has no path")
    }
    if (f.status === "removed") {
      return all(`a file is deleted (${f.path})`)
    }
    if (f.status && !["added", "modified", "changed", "renamed", "copied"].includes(f.status)) {
      return all(`a file has status ${f.status} (${f.path})`)
    }
    for (const p of [f.path, f.previous].filter(Boolean)) {
      if (matches(p, FULL)) {
        return all(`${p} changes what CI runs`)
      }
    }
    if (f.status === "renamed" || f.previous) {
      if (typeof f.previous !== "string") {
        return all(`a rename of ${f.path} has no old path`)
      }
      for (const lane of LANES) {
        if (inertFor(lane, f.path) !== inertFor(lane, f.previous)) {
          return all(`${f.previous} → ${f.path} moves a file into or out of ${lane.name}'s read set`)
        }
      }
    }
  }
  const paths = files.flatMap((f) => [f.path, f.previous].filter(Boolean))
  return {
    full: null,
    lanes: Object.fromEntries(LANES.map((l) => [l.name, !paths.every((p) => inertFor(l, p))])),
  }
}

/**
 * Reads a pull request's changed files from the REST API, every page.
 *
 * @param {string} repo `owner/name`
 * @param {string} pr the pull request number
 * @param {string} token a token that can read the repository
 * @param {typeof fetch} [get] the fetch to use (tests pass a fake)
 * @returns {Promise<{files: {path: string, status: string, previous?: string}[], truncated: boolean}>} the files
 */
export const fetchFiles = async (repo, pr, token, get = fetch) => {
  const files = []
  // The endpoint lists at most 3000 files, 100 per page.
  for (let page = 1; page <= 30; page++) {
    const res = await get(
      `https://api.github.com/repos/${repo}/pulls/${pr}/files?per_page=100&page=${page}`,
      {
        headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json" },
        signal: AbortSignal.timeout(20000),
      }
    )
    if (!res.ok) {
      throw new Error(`GET pulls/${pr}/files page ${page}: ${res.status}`)
    }
    const batch = await res.json()
    if (!Array.isArray(batch)) {
      throw new Error("the files response is not a list")
    }
    for (const f of batch) {
      files.push({ path: f.filename, status: f.status, previous: f.previous_filename })
    }
    if (batch.length < 100) {
      return { files, truncated: false }
    }
  }
  return { files, truncated: true }
}

/**
 * Reads a pull request's labels as they are now, not as the event saw them.
 * It reads one page of 100; a full page may hide a `ci:full` on the next,
 * so it then adds `ci:full` itself and every lane runs (fails closed).
 *
 * @param {string} repo `owner/name`
 * @param {string} pr the pull request number
 * @param {string} token a token that can read the repository
 * @returns {Promise<string[]>} the label names
 */
const fetchLabels = async (repo, pr, token) => {
  const res = await fetch(`https://api.github.com/repos/${repo}/issues/${pr}/labels?per_page=100`, {
    headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json" },
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) {
    throw new Error(`GET issues/${pr}/labels: ${res.status}`)
  }
  const list = await res.json()
  if (!Array.isArray(list)) {
    throw new Error("the labels response is not a list")
  }
  const names = list.map((l) => l?.name)
  return list.length >= 100 ? [...names, "ci:full"] : names
}

/**
 * The `ci-gate` verdict: every job it needs succeeded, or was skipped by its
 * own `if:` on this run. A lane that was not selected still *succeeds*, since
 * only its steps are skipped, so a skipped lane job is a failure here.
 *
 * @param {Record<string, {result: string}>} needs `toJSON(needs)`
 * @param {string[]} expectSkip the job ids whose own `if:` is false on this run
 * @returns {string[]} one line per job that fails the gate; empty when it passes
 */
export const gate = (needs, expectSkip) => {
  const bad = []
  if (!needs || typeof needs !== "object" || Object.keys(needs).length === 0) {
    return ["no job results"]
  }
  for (const [job, v] of Object.entries(needs)) {
    const result = v?.result
    if (result === "success") {
      continue
    }
    if (result === "skipped" && expectSkip.includes(job)) {
      continue
    }
    bad.push(`${job}: ${result ?? "no result"}`)
  }
  return bad
}

/**
 * The lane a job's display name (as the API lists a run's jobs) belongs to,
 * matched exactly against each lane's `names` and `formerNames`, a `${{ ... }}`
 * standing for one matrix value; null for a job no lane holds.
 *
 * @param {string} display the job's display name, e.g. `nish-cmp elision (x86_64-linux)`
 * @returns {(typeof LANES)[number] | null} the lane, or null
 */
export const laneOf = (display) =>
  LANES.find((lane) =>
    [...lane.names, ...(lane.formerNames ?? [])].some((name) => {
      const re = name
        .split(/\$\{\{.*?\}\}/)
        .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("[^()]+")
      return new RegExp(`^${re}$`).test(display)
    })
  ) ?? null

/**
 * Replays recorded merged pull requests through `decide`.
 *
 * @param {string} file the backtest data (tests/ci-scope/backtest-prs.json)
 * @returns {number} the exit status: 1 on a miss or too few pull requests
 */
const backtest = (file) => {
  const data = JSON.parse(fs.readFileSync(file, "utf8"))
  const prs = data.prs
  const skipped = Object.fromEntries(LANES.map((l) => [l.name, 0]))
  const misses = []
  const excused = []
  let saved = 0
  for (const pr of prs) {
    const { lanes } = decide({
      event: "pull_request",
      labels: pr.labels ?? [],
      files: pr.files,
      truncated: pr.truncated === true,
    })
    for (const lane of LANES) {
      if (lanes[lane.name]) {
        continue
      }
      skipped[lane.name]++
      saved += lane.minutes
      // A miss: a job of a lane this would have skipped failed on one of the
      // PR's runs. A failure the data records as a flake (`flakes`, keyed by
      // job, with the log line that shows the cause) is excused and printed.
      for (const run of pr.runs ?? []) {
        for (const job of run.failed ?? []) {
          if (laneOf(job) !== lane) {
            continue
          }
          const line = `#${pr.number} ${job} (run ${run.id})`
          const flake = run.flakes?.[job]
          if (flake) {
            excused.push(`${line}: ${flake}`)
          } else {
            misses.push(line)
          }
        }
      }
    }
  }
  const total = LANES.reduce((n, l) => n + l.minutes, 0)
  console.log(`backtest: ${prs.length} merged pull requests from ${file}`)
  for (const lane of LANES) {
    const pct = ((100 * skipped[lane.name]) / prs.length).toFixed(1)
    console.log(
      `  ${lane.name.padEnd(13)} skips ${String(skipped[lane.name]).padStart(3)}/${prs.length} (${pct}%)`
    )
  }
  const per = saved / prs.length
  console.log(
    `saved: ${per.toFixed(2)} runner-minutes per pull request run, of ${total.toFixed(1)} in the lanes ` +
      `(${((100 * per) / RUN_MINUTES).toFixed(1)}% of a ~${RUN_MINUTES}-minute run)`
  )
  console.log(`misses: ${misses.length}`)
  for (const m of misses) {
    console.log(`  MISS ${m}`)
  }
  for (const e of excused) {
    console.log(`  excused flake ${e}`)
  }
  if (prs.length < 40) {
    console.log(`backtest: needs at least 40 pull requests, has ${prs.length}`)
    return 1
  }
  return misses.length === 0 ? 0 : 1
}

/**
 * Writes the decision for the `scope` job, or prints it.
 *
 * @param {ReturnType<typeof decide>} result the decision
 * @returns {void}
 */
const emit = ({ full, lanes }) => {
  const off = Object.keys(lanes).filter((k) => !lanes[k])
  const why =
    full ??
    (off.length > 0
      ? `lanes off: ${off.join(", ")}; every changed path of each is on its allowlist of paths it does not read`
      : "every lane reads a changed path")
  const lines = [...Object.entries(lanes).map(([k, v]) => `${k}=${v}`), `why=${why.replace(/[\r\n]+/g, " ")}`]
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join("\n")}\n`)
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    const rows = Object.entries(lanes).map(([k, v]) => `| ${k} | ${v ? "runs" : "skipped"} |`)
    fs.appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `### CI scope\n\n${why}\n\n| Lane | |\n| --- | --- |\n${rows.join("\n")}\n`
    )
  }
  console.log(lines.join("\n"))
}

const main = async () => {
  const args = process.argv.slice(2)
  if (args[0] === "--backtest") {
    process.exitCode = backtest(args[1] ?? path.join(root, "tests", "ci-scope", "backtest-prs.json"))
    return
  }
  const env = process.env
  if (args[0] === "--gate") {
    let bad
    try {
      bad = gate(JSON.parse(env.NEEDS ?? ""), JSON.parse(env.EXPECT_SKIP || "[]"))
    } catch (err) {
      bad = [`unreadable job results: ${err.message}`]
    }
    for (const line of bad) {
      console.log(`ci-gate: ${line}`)
    }
    console.log(
      bad.length === 0 ? "ci-gate: every job succeeded or was skipped by its own if:" : "ci-gate: FAILED"
    )
    process.exitCode = bad.length === 0 ? 0 : 1
    return
  }
  let labels = []
  try {
    labels = JSON.parse(env.PR_LABELS || "[]")
  } catch {
    labels = ["ci:full"] // unparseable labels: run everything
  }
  const base = { event: env.GITHUB_EVENT_NAME ?? "", labels, mode: env.NISH_CI_SCOPE ?? "" }
  if (args[0] === "--files") {
    const files = fs
      .readFileSync(args[1], "utf8")
      .split("\n")
      .filter(Boolean)
      .map((p) => ({ path: p, status: "modified" }))
    emit(decide({ ...base, event: base.event || "pull_request", files }))
    return
  }
  let fetched = { files: null, truncated: false }
  if (SCOPED_EVENTS.has(base.event)) {
    try {
      const repo = env.GITHUB_REPOSITORY ?? ""
      const pr = env.PR_NUMBER ?? ""
      const token = env.GITHUB_TOKEN ?? ""
      base.labels = [...base.labels, ...(await fetchLabels(repo, pr, token))]
      fetched = await fetchFiles(repo, pr, token)
    } catch (err) {
      fetched = { files: null, truncated: false }
      console.error(`ci-scope: ${err.message}; every lane runs`)
    }
  }
  emit(decide({ ...base, ...fetched }))
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    // Unreachable unless emit itself fails; say so and let the job go red.
    console.error(err)
    process.exitCode = 1
  })
}
