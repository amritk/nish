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
// Some lanes are deferred instead (`pullRequests: false`): the jobs that run
// one platform's code no other job runs (NEON and the ARMv8 kernels, Apple's
// detection and the Metal link) and a live server. A pull request runs one
// only when it changes a path of the lane's `pullRequestPaths`, the code that
// platform path or that server exchange is in, and otherwise leaves it, with
// the other platforms' `bootstrap` and `nish-cmp-elision` rows
// (`rows=native`), to the push to main, the merge queue, the Release PR's
// dispatched run and the release, which run every lane. `ci:full`,
// NISH_CI_SCOPE=full, a change to CI itself and a file list this script
// cannot read run them on a pull request too.
//
//   node scripts/ci-scope.mjs                     # in the `scope` job (env below)
//   node scripts/ci-scope.mjs --files <file>      # a newline-separated path list
//   node scripts/ci-scope.mjs --backtest [<file>] # replay merged PRs
//
//   node scripts/ci-scope.mjs --gate              # in the `ci-gate` job (env below)
//   node scripts/ci-scope.mjs --suite [--files <file>]  # first step of `test` and `examples`
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

/** What every lane that builds a compiler from `src/` reads. */
const COMPILER = ["src/**", "std/**", "runtime/**", "scripts/**", "bin/**", "nish-capabilities.lock.json"]

/**
 * The lanes. `jobs` are ci.yml job ids and `names` their `name:` templates,
 * verbatim (tests/run.js pins both against ci.yml); `minutes` is the runner time the
 * lane's rows took on run 44273081341 (the saving a skip buys); `reads` is
 * the lane's read set, which wins over `inert`; `unread` (optional) is what the
 * lane provably skips inside `reads`, and wins over both.
 */
export const LANES = [
  {
    name: "nish_cmp",
    jobs: ["nish-cmp"],
    // biome-ignore lint/suspicious/noTemplateCurlyInString: a GitHub Actions expression, matched verbatim
    names: ["nish-cmp (${{ matrix.seed.asset }})"],
    minutes: 14.2,
    // tests/nish-cmp.js, then fuzz.js --stage1 and --emit-ts over the corpus.
    reads: [...COMPILER, ...CORPUS],
    inert: [...INERT, "tests/**"],
  },
  {
    name: "elision",
    jobs: ["nish-cmp-elision"],
    // biome-ignore lint/suspicious/noTemplateCurlyInString: a GitHub Actions expression, matched verbatim
    names: ["nish-cmp elision (${{ matrix.seed.asset }})"],
    minutes: 7.1,
    // tests/differential/soundness.js over tests/cases and the differential corpus.
    reads: [...COMPILER, ...CORPUS],
    inert: [...INERT, "tests/**"],
  },
  {
    name: "bootstrap",
    jobs: ["bootstrap"],
    // biome-ignore lint/suspicious/noTemplateCurlyInString: a GitHub Actions expression, matched verbatim
    names: ["bootstrap (${{ matrix.seed.asset }})"],
    minutes: 6.4,
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
    minutes: 5.5,
    // The one job that runs the NEON, ARMv8 AES/PMULL, SHA-256 and CRC32
    // paths (no x86_64 job can), so a pull request that changes those kernels,
    // their lowerings or the link recipe still runs it.
    pullRequests: false,
    pullRequestPaths: [
      "runtime/runtime-simd.c",
      "runtime/runtime-bytes.c",
      "runtime/runtime-aes.c",
      "runtime/runtime-sha256.c",
      "runtime/runtime-chacha20.c",
      "runtime/runtime-checksum.c",
      "runtime/*.h",
      "src/kernels.ts",
      "src/target.ts",
      "std/crypto/aes.ts",
      "std/crypto/sha256.ts",
      "std/crypto/chacha20poly1305.ts",
      "std/compress/checksum.ts",
      "tests/simd/**",
      "bench/sha256/**",
      "bench/crc32.mjs",
      "bench/adler32.mjs",
      "bench/chacha20.mjs",
      "scripts/build.sh",
    ],
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
    minutes: 2.1,
    // The one job that runs runtime-sha256.c's Apple detection, so a pull
    // request that changes the kernel, its lowering or the link recipe still runs it.
    pullRequests: false,
    pullRequestPaths: [
      "runtime/runtime-sha256.c",
      "runtime/*.h",
      "src/kernels.ts",
      "std/crypto/sha256.ts",
      "tests/simd/sha256*",
      "bench/sha256/**",
      "scripts/build.sh",
    ],
    // tests/simd/sha256*.c, tests/run.js sha256_hw and bench/sha256/run.mjs.
    reads: [...COMPILER, ...RUN_JS, "bench/**", "examples/**"],
    unread: RUN_JS_UNREAD,
    inert: [...INERT, "CHANGELOG.md", "changelog/**"],
  },
  {
    name: "fuzz",
    jobs: ["fuzz-smoke"],
    names: ["fuzz-smoke"],
    minutes: 4.5,
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
    minutes: 1.8,
    // A live server, which a recorded exchange can disagree with, so a pull
    // request that changes the client, its tests or the servers still runs it.
    pullRequests: false,
    pullRequestPaths: ["std/postgres.ts", "std/postgres-*.ts", "tests/postgres/**", "bench/techempower/**"],
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
    name: "gfx",
    jobs: ["gfx"],
    names: ["gfx (ubuntu-latest, lavapipe)"],
    // Not on run 44273081341, which predates the jobs: run 45857452100's
    // row, 3.2 minutes.
    minutes: 3.2,
    // .github/actions/compiler-cache, scripts/fetch-gfx.sh and tests/run.js
    // gfx (tests/gfx.js: scripts/build.sh, runtime/gfx/, tests/gfx/triangle.c).
    // tests/run.js imports bench/*.mjs before any section runs.
    reads: [...COMPILER, ...RUN_JS, "bench/**", "examples/**"],
    unread: RUN_JS_UNREAD,
    inert: [...INERT, "CHANGELOG.md", "changelog/**"],
  },
  {
    name: "gfx_macos",
    jobs: ["gfx-macos"],
    names: ["gfx (macos-latest, Metal)"],
    // Run 45857452100's row, 4.5 minutes.
    minutes: 4.5,
    // The one job that links SDL's Cocoa driver and wgpu-native's Metal
    // backend, so a pull request that changes the gfx runtime or the link
    // recipe still runs it.
    pullRequests: false,
    pullRequestPaths: [
      "runtime/gfx/**",
      "scripts/build.sh",
      "scripts/fetch-gfx.sh",
      "tests/gfx/**",
      "tests/gfx.js",
      "src/c-symbols.ts",
      "src/run-cache.ts",
    ],
    reads: [...COMPILER, ...RUN_JS, "bench/**", "examples/**"],
    unread: RUN_JS_UNREAD,
    inert: [...INERT, "CHANGELOG.md", "changelog/**"],
  },
]

/** Why a pull request turns a `pullRequests: false` lane off. */
export const DEFERRED =
  "this pull request changes none of their own paths, so they are left to the push to main, the merge queue, the Release PR and the release (add ci:full to run them here)"

/**
 * Paths the whole suite never reads: no file of tests/, scripts/, bench/,
 * src/, std/ or .github/ names them (`node tests/run.js ci-scope` greps for
 * it). A pull request every one of whose changed paths is here skips every
 * step of the `test` shards and `examples` after the first (`--suite`, which
 * each runs itself rather than waiting on the `scope` job: a job that needs
 * another is created only once that one ends, and on a full queue that wait
 * was every pull request's); `lint` still runs, since docs/check-links.mjs
 * reads every Markdown file.
 */
export const SUITE_UNREAD = [".claude/plans/**"]

/** The lanes a pull request leaves to the push to main and the release. */
export const deferredLanes = () => LANES.filter((l) => l.pullRequests === false).map((l) => l.name)

/**
 * The matrix jobs whose other platforms' rows a pull request leaves to main
 * under `rows=native`: the seed rows of `bootstrap` and `nish-cmp-elision`,
 * of which only x86_64-linux's runs. `nish-cmp` keeps every row: its
 * aarch64-linux row failed alone on two of the recorded pull requests
 * (#1658, #1714), a difference that pull request had to declare.
 */
export const NATIVE_ROW_JOBS = ["bootstrap", "nish-cmp-elision"]

/** The one seed asset a `rows=native` run keeps. */
export const NATIVE_ASSET = "x86_64-linux"

/**
 * Whether a job, by its display name, is a row `rows=native` leaves out.
 *
 * @param {string} display the job's display name, e.g. `bootstrap (aarch64-linux)`
 * @returns {boolean} true for a non-x86_64-linux row of a `NATIVE_ROW_JOBS` job
 */
export const otherPlatformRow = (display) => {
  const m = /^(bootstrap|nish-cmp elision) \(([^()]+)\)$/.exec(display)
  return m !== null && m[2] !== NATIVE_ASSET
}

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
 * Decides every lane for one change by its read set alone, before a pull
 * request defers anything: the rule `decide` applies, and what tests/run.js
 * holds each lane's listed reads against.
 *
 * @param {Parameters<typeof decide>[0]} change what the pull request is
 * @returns {{full: string | null, lanes: Record<string, boolean>, everything: boolean}} `full` is
 *   why every lane runs, or null; `everything` is true when nothing is deferred either (another
 *   event, `ci:full`, NISH_CI_SCOPE=full, or a change to CI itself)
 */
export const byReadSet = ({ event, labels = [], mode = "", files, truncated = false }) => {
  const all = (why, everything = false) => ({
    full: why,
    lanes: Object.fromEntries(LANES.map((l) => [l.name, true])),
    everything,
  })
  if (!SCOPED_EVENTS.has(event)) {
    return all(`a ${event || "unknown"} event runs every lane`, true)
  }
  if (mode.trim().toLowerCase() === "full") {
    return all("the NISH_CI_SCOPE variable is `full`", true)
  }
  if (labels.some((l) => typeof l === "string" && l.trim().toLowerCase() === "ci:full")) {
    return all("the pull request has the `ci:full` label", true)
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
        // A change to CI itself may break a deferred job, so it runs them too.
        return all(`${p} changes what CI runs`, true)
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
    everything: false,
  }
}

/**
 * Decides every lane for one change: `byReadSet`, then, on a pull request
 * whose file list it read and that does not run everything, each deferred
 * lane off unless a changed path is one of its `pullRequestPaths`, and only
 * the x86_64-linux rows of `NATIVE_ROW_JOBS`.
 *
 * @param {object} change what the pull request is
 * @param {string} change.event the GitHub event name
 * @param {string[]} [change.labels] the pull request's label names
 * @param {string} [change.mode] the NISH_CI_SCOPE variable
 * @param {{path: string, status?: string, previous?: string}[] | null} change.files the changed files, or null when unknown
 * @param {boolean} [change.truncated] the file list hit the API's cap
 * @returns {{full: string | null, lanes: Record<string, boolean>, rows: "all" | "native", deferred: string[], suite: boolean}}
 *   `full` is why every lane its read set selects runs, or null; `rows` is whether the matrix jobs
 *   take every seed's row or only x86_64-linux's; `deferred` names the lanes its read set ran
 *   and the deferral turned off; `suite` is whether the `test` shards and `examples` run
 */
export const decide = (change) => {
  const { full, lanes, everything } = byReadSet(change)
  // A file list it cannot read defers nothing: whether a pull request
  // changes a deferred lane's own paths is a fact about that list.
  if (everything || full !== null) {
    return { full, lanes, rows: "all", deferred: [], suite: true }
  }
  const paths = change.files.flatMap((f) => [f.path, f.previous].filter(Boolean))
  const suite = !paths.every((p) => matches(p, SUITE_UNREAD))
  const deferred = []
  for (const lane of LANES.filter((l) => l.pullRequests === false)) {
    if (lanes[lane.name] && !paths.some((p) => matches(p, lane.pullRequestPaths ?? []))) {
      lanes[lane.name] = false
      deferred.push(lane.name)
    }
  }
  return { full, lanes, rows: "native", deferred, suite }
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
 * matched exactly against each lane's `names`, a `${{ ... }}` standing for
 * one matrix value; null for a job no lane holds.
 *
 * @param {string} display the job's display name, e.g. `nish-cmp elision (x86_64-linux)`
 * @returns {(typeof LANES)[number] | null} the lane, or null
 */
export const laneOf = (display) =>
  LANES.find((lane) =>
    lane.names.some((name) => {
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
  // A deferred lane's failure, or a left-out row's, where the read set ran
  // it, is not a miss of the read-set rule: it is what the push to main
  // would have found instead. One the read set skipped is still a miss.
  const deferred = []
  let saved = 0
  for (const pr of prs) {
    const decision = decide({
      event: "pull_request",
      labels: pr.labels ?? [],
      files: pr.files,
      truncated: pr.truncated === true,
    })
    const { lanes } = decision
    if (decision.rows === "native") {
      for (const run of pr.runs ?? []) {
        for (const job of (run.failed ?? []).filter((j) => otherPlatformRow(j) && lanes[laneOf(j)?.name])) {
          deferred.push(`#${pr.number} ${job} (run ${run.id})`)
        }
      }
    }
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
          if (decision.deferred.includes(lane.name)) {
            deferred.push(line)
          } else if (flake) {
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
      `(${((100 * per) / 119).toFixed(1)}% of a ~119-minute run)`
  )
  console.log(`deferred to main (a deferred lane or a left-out row failed): ${deferred.length}`)
  for (const d of deferred) {
    console.log(`  DEFERRED ${d}`)
  }
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
const emit = ({ full, lanes, rows, deferred: deferredOff = [], suite = true }) => {
  const off = Object.keys(lanes).filter((k) => !lanes[k] && !deferredOff.includes(k))
  const parts = []
  if (off.length > 0) {
    parts.push(
      `lanes off: ${off.join(", ")}; every changed path of each is on its allowlist of paths it does not read`
    )
  }
  if (deferredOff.length > 0 || rows === "native") {
    parts.push(
      `deferred: ${[...deferredOff, ...(rows === "native" ? ["the other platforms' bootstrap and nish-cmp elision rows"] : [])].join(", ")}; ${DEFERRED}`
    )
  }
  if (!suite) {
    parts.push(
      `the test shards and examples skip: every changed path is one the suite never reads (${SUITE_UNREAD.join(", ")})`
    )
  }
  // `full` alone is the reason when every lane runs; on a pull request that
  // still defers, the deferral is said too.
  let why = parts.length > 0 ? parts.join("; ") : "every lane reads a changed path"
  if (full !== null) {
    why = parts.length === 0 ? full : `${full}; ${parts.join("; ")}`
  }
  const lines = [
    ...Object.entries(lanes).map(([k, v]) => `${k}=${v}`),
    `rows=${rows}`,
    `suite=${suite}`,
    `why=${why.replace(/[\r\n]+/g, " ")}`,
  ]
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join("\n")}\n`)
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    const table = Object.entries(lanes).map(([k, v]) => `| ${k} | ${v ? "runs" : "skipped"} |`)
    fs.appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `### CI scope\n\n${why}\n\n| Lane | |\n| --- | --- |\n${table.join("\n")}\n\nSeed rows: ${rows}\n`
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
  // `--suite`: write `suite=` alone, for the first step of a job that runs
  // the suite, and say in its summary why it skips when it does.
  const suiteOnly = args[0] === "--suite"
  const out = suiteOnly ? emitSuite : emit
  const rest = suiteOnly ? args.slice(1) : args
  const base = { event: env.GITHUB_EVENT_NAME ?? "", labels, mode: env.NISH_CI_SCOPE ?? "" }
  if (rest[0] === "--files") {
    const files = fs
      .readFileSync(rest[1], "utf8")
      .split("\n")
      .filter(Boolean)
      .map((p) => ({ path: p, status: "modified" }))
    out(decide({ ...base, event: base.event || "pull_request", files }))
    return
  }
  let fetched = { files: null, truncated: false }
  if (SCOPED_EVENTS.has(base.event)) {
    try {
      const repo = env.GITHUB_REPOSITORY ?? ""
      const pr = env.PR_NUMBER || payloadPr(env.GITHUB_EVENT_PATH)
      const token = env.GITHUB_TOKEN ?? ""
      base.labels = [...base.labels, ...(await fetchLabels(repo, pr, token))]
      fetched = await fetchFiles(repo, pr, token)
    } catch (err) {
      fetched = { files: null, truncated: false }
      console.error(`ci-scope: ${err.message}; every lane runs`)
    }
  }
  out(decide({ ...base, ...fetched }))
}

/**
 * The pull request's number from the event payload the runner wrote, so a
 * step needs no `${{ github.event... }}` of its own; empty when there is none.
 *
 * @param {string | undefined} file GITHUB_EVENT_PATH
 * @returns {string} the number, or ""
 */
const payloadPr = (file) => {
  try {
    return String(JSON.parse(fs.readFileSync(file ?? "", "utf8"))?.pull_request?.number ?? "")
  } catch {
    return ""
  }
}

/**
 * Writes `suite=` alone, for `--suite`, and one summary line when it is false.
 *
 * @param {ReturnType<typeof decide>} result the decision
 * @returns {void}
 */
const emitSuite = ({ suite }) => {
  const line = `suite=${suite}`
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `${line}\n`)
  }
  if (!suite && process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `### Not run: the suite\n\nEvery changed path is one the suite never reads (${SUITE_UNREAD.join(", ")}), so every step after this one was skipped. Add the ci:full label and use Re-run all jobs to run it.\n`
    )
  }
  console.log(line)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    // Unreachable unless emit itself fails; say so and let the job go red.
    console.error(err)
    process.exitCode = 1
  })
}
