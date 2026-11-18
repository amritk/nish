#!/usr/bin/env node
// Which of ci.yml's side jobs a pull request needs (docs/wp10-ci.md, "Scoped
// lanes"). A lane is a side job, or a pair of them, that reads a known set of
// paths; the `scope` job runs this script and writes one `<lane>=true|false`
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
// The `scope` job's environment: GITHUB_EVENT_NAME, GITHUB_REPOSITORY,
// GITHUB_TOKEN, PR_NUMBER, PR_LABELS (a JSON array of names) and
// NISH_CI_SCOPE (the repository variable; `full` turns every lane on).

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

/**
 * Paths no lane reads. Each entry was checked against the lanes' entry points
 * and the files they import or open (an `strace -f` of every lane command's
 * opens: tests/ci-scope/README.md). A lane's own `reads` carve paths back out.
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
  "tests/nish-cmp.js",
  "tests/pool.js",
  "tests/driver.c",
  "CHANGELOG.md",
  "changelog/**",
]

/** What every lane that builds a compiler from `src/` reads. */
const COMPILER = ["src/**", "std/**", "runtime/**", "scripts/**", "bin/**", "nish-capabilities.lock.json"]

/**
 * The lanes. `jobs` are ci.yml job ids; `minutes` is the runner time the
 * lane's rows took on run 44273081341 (the saving a skip buys); `reads` is
 * the lane's read set, which wins over `inert`.
 */
export const LANES = [
  {
    name: "nish-cmp",
    jobs: ["nish-cmp"],
    minutes: 14.2,
    // tests/nish-cmp.js, then fuzz.js --stage1 and --emit-ts over the corpus.
    reads: [...COMPILER, ...CORPUS],
    inert: [...INERT, "tests/**"],
  },
  {
    name: "elision",
    jobs: ["nish-cmp-elision"],
    minutes: 7.1,
    // tests/differential/soundness.js over tests/cases and the differential corpus.
    reads: [...COMPILER, ...CORPUS],
    inert: [...INERT, "tests/**"],
  },
  {
    name: "bootstrap",
    jobs: ["bootstrap"],
    minutes: 6.4,
    // scripts/bootstrap.sh --verify, scripts/check-hardening.mjs and the
    // tests/nish/cli.ts contract. The `test` job's fixed point is delegated
    // here, so this set holds what that check reads (tests/run.js pins it).
    reads: [...COMPILER, "tests/nish/**", "tests/self/**"],
    inert: [...INERT, "tests/**", "examples/**", "bench/**", "CHANGELOG.md", "changelog/**"],
  },
  {
    name: "simd",
    jobs: ["simd-arm64"],
    minutes: 5.5,
    // tests/run.js's simd, float-corpus and kernel sections, bench/*.mjs and build/test/simd/*.
    reads: [...COMPILER, "tests/**", "bench/**", "examples/**"],
    inert: [...INERT, "CHANGELOG.md", "changelog/**"],
  },
  {
    name: "sha256-macos",
    jobs: ["sha256-macos"],
    minutes: 2.1,
    // tests/simd/sha256*.c, tests/run.js sha256_hw and bench/sha256/run.mjs.
    reads: [...COMPILER, "tests/**", "bench/**", "examples/**"],
    inert: [...INERT, "CHANGELOG.md", "changelog/**"],
  },
  {
    name: "fuzz",
    jobs: ["fuzz-smoke"],
    minutes: 4.5,
    // scripts/fuzz.sh --smoke (tests/fuzz/**) and tests/run.js runtime_sanitize,
    // which the `test` job delegates here (tests/run.js pins it).
    reads: [...COMPILER, "tests/**", "bench/**", "examples/**"],
    inert: [...INERT, "CHANGELOG.md", "changelog/**"],
  },
  {
    name: "postgres",
    jobs: ["postgres-live"],
    minutes: 1.8,
    // tests/postgres/live/run.mjs, tls-certs.sh and the bench/techempower servers.
    reads: [...COMPILER, "tests/postgres/**", "bench/techempower/**"],
    inert: [...INERT, "tests/**", "examples/**", "bench/**", "CHANGELOG.md", "changelog/**"],
  },
]

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
 * Whether a lane can skip a change to this path: on its allowlist, off its read set.
 *
 * @param {(typeof LANES)[number]} lane the lane
 * @param {string} file a repository-relative path
 * @returns {boolean} true when the lane provably does not read it
 */
export const inertFor = (lane, file) => matches(file, lane.inert) && !matches(file, lane.reads)

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
  if (!SCOPED_EVENTS.has(event)) return all(`a ${event || "unknown"} event runs every lane`)
  if (mode.trim() === "full") return all("the NISH_CI_SCOPE variable is `full`")
  if (labels.includes("ci:full")) return all("the pull request has the `ci:full` label")
  if (!Array.isArray(files) || files.length === 0) return all("the changed-file list is empty or unknown")
  if (truncated) return all("the changed-file list was truncated")
  for (const f of files) {
    if (typeof f?.path !== "string" || f.path === "") return all("a changed file has no path")
    if (f.status === "removed") return all(`a file is deleted (${f.path})`)
    if (f.status && !["added", "modified", "changed", "renamed", "copied"].includes(f.status)) {
      return all(`a file has status ${f.status} (${f.path})`)
    }
    for (const p of [f.path, f.previous].filter(Boolean)) {
      if (matches(p, FULL)) return all(`${p} changes what CI runs`)
    }
    if (f.status === "renamed" || f.previous) {
      if (typeof f.previous !== "string") return all(`a rename of ${f.path} has no old path`)
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
 * @returns {Promise<{files: {path: string, status: string, previous?: string}[], truncated: boolean}>} the files
 */
const fetchFiles = async (repo, pr, token) => {
  const files = []
  // The endpoint lists at most 3000 files, 100 per page.
  for (let page = 1; page <= 30; page++) {
    const res = await fetch(
      `https://api.github.com/repos/${repo}/pulls/${pr}/files?per_page=100&page=${page}`,
      {
        headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json" },
        signal: AbortSignal.timeout(20000),
      }
    )
    if (!res.ok) throw new Error(`GET pulls/${pr}/files page ${page}: ${res.status}`)
    const batch = await res.json()
    if (!Array.isArray(batch)) throw new Error("the files response is not a list")
    for (const f of batch) files.push({ path: f.filename, status: f.status, previous: f.previous_filename })
    if (batch.length < 100) return { files, truncated: false }
  }
  return { files, truncated: true }
}

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
  let saved = 0
  for (const pr of prs) {
    const { lanes } = decide({
      event: "pull_request",
      labels: pr.labels ?? [],
      files: pr.files,
      truncated: pr.truncated === true,
    })
    for (const lane of LANES) {
      if (lanes[lane.name]) continue
      skipped[lane.name]++
      saved += lane.minutes
      // A miss: a job of a lane this would have skipped failed on one of the PR's runs.
      for (const run of pr.runs ?? []) {
        for (const job of run.failed ?? []) {
          if (lane.jobs.includes(job.split(/[ (]/)[0])) misses.push(`#${pr.number} ${job} (run ${run.id})`)
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
      `(${((100 * per) / 119).toFixed(1)}% of a ~119-minute run)`
  )
  console.log(`misses: ${misses.length}`)
  for (const m of misses) console.log(`  MISS ${m}`)
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
  const why = full ?? "every changed path of a skipped lane is on its allowlist of paths it does not read"
  const lines = [...Object.entries(lanes).map(([k, v]) => `${k}=${v}`), `why=${why.replace(/\n/g, " ")}`]
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join("\n")}\n`)
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
      fetched = await fetchFiles(env.GITHUB_REPOSITORY ?? "", env.PR_NUMBER ?? "", env.GITHUB_TOKEN ?? "")
    } catch (err) {
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
