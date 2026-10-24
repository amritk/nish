// What `nish/sqlite` adds to a call of SQLite, on the twelve-dollar server
// challenge's schema and queries: the same loop through the module (main.ts)
// and through SQLite's own C API (twin.c), on the same database, and how much
// of a difference this machine can see at all.
//
//   npm run build && node bench/sqlite/run.mjs [--validate] [--rounds N] [--compiler <nish>]
//     --validate  one run of each side at small counts: rows, checksums and
//                 failures must agree, nothing is timed
//     --rounds N  timed rounds, rounded up to a multiple of 3 (default 12),
//                 after one uncounted warm-up round
//
// main.ts is built with `--link` (the speed profile) and copied byte for byte;
// twin.c is compiled against the same runtime/sqlite/sqlite3.c with the flags
// scripts/build.sh compiles SQLite with for that link (the speed profile's
// optimisation flags and the SQLite options, THREADSAFE=0 among them),
// sqlite3.c as a native object of its own as the link has it, and linked with
// the link's flags on Linux. NISH_SQLITE_CFLAGS, which changes how the build
// compiles SQLite, is refused: the twin would not have it. Both open the
// database with the same flags and PRAGMAs and prepare each statement once.
//
// The database is the challenge's schema.sql filled by `twin seed`: 50,000
// users, 500,000 posts and 2,000,000 likes from one fixed generator, in WAL
// mode, made once in build/bench/sqlite/ and made again only when schema.sql,
// twin.c, sqlite3.c or the flags change. Nothing is downloaded.
//
// Each round runs every workload on the build, its copy and the C twin, in an
// order that rotates by round, so over a multiple of 3 rounds each goes first
// equally often. A run times
// its own loop and prints a checksum of every value it read; every run of a
// workload must print the same rows and checksum. The report is ns per call,
// min, median and interquartile range over the rounds; the cost of the module
// (and of the adapter's checks) is the build less the twin, and the noise band
// is the build against its byte-identical copy: a difference inside it is one
// this machine cannot see.
import { createHash } from "node:crypto"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

import { compilerFrom } from "../compiler.mjs"

const root = path.resolve(import.meta.dirname, "..", "..")
const here = path.join(root, "bench", "sqlite")
const sqliteDir = path.join(root, "runtime", "sqlite")
const outDir = path.join(root, "build", "bench", "sqlite")
const nishc = compilerFrom(process.argv)

const fail = (msg) => {
  console.error(`bench/sqlite/run.mjs: ${msg}`)
  process.exit(2)
}

let rounds = 12
let validate = false
const argv = nishc.rest
for (let i = 2; i < argv.length; i++) {
  if (argv[i] === "--rounds") {
    rounds = Number(argv[++i])
  } else if (argv[i] === "--validate") {
    validate = true
  } else {
    fail(`unknown option ${argv[i]}`)
  }
}
if (!(rounds >= 2)) {
  fail("--rounds needs at least 2")
}

// Calls a run: each timed run is a fraction of a second on a 2020s core.
const WORKLOADS = [
  { name: "lookup", count: validate ? 2000 : 200000 },
  { name: "feed", count: validate ? 50 : 10000 },
  { name: "insert", count: validate ? 500 : 20000 },
  { name: "insert-txn", count: validate ? 2000 : 100000 },
]

// scripts/build.sh: the speed profile's `optimise` less -flto (sqlite3.c is
// native there, and twin.c calls nothing it could inline), `elf`, and the
// SQLite options for a program built without --threads.
const CFLAGS = [
  "-O3",
  "-DNDEBUG",
  "-ffunction-sections",
  "-fdata-sections",
  "-fomit-frame-pointer",
  "-fno-asynchronous-unwind-tables",
  "-fno-unwind-tables",
  "-fno-plt",
]
const SQLITE_DEFS = [
  "-DSQLITE_DQS=0",
  "-DSQLITE_DEFAULT_MEMSTATUS=0",
  "-DSQLITE_DEFAULT_WAL_SYNCHRONOUS=1",
  "-DSQLITE_LIKE_DOESNT_MATCH_BLOBS",
  "-DSQLITE_MAX_EXPR_DEPTH=0",
  "-DSQLITE_OMIT_DEPRECATED",
  "-DSQLITE_OMIT_PROGRESS_CALLBACK",
  "-DSQLITE_OMIT_SHARED_CACHE",
  "-DSQLITE_USE_ALLOCA",
  "-DSQLITE_OMIT_LOAD_EXTENSION",
  "-DSQLITE_THREADSAFE=0",
]
const cc = process.env.CC ?? "clang"
if ((process.env.NISH_SQLITE_CFLAGS ?? "").trim() !== "") {
  fail("NISH_SQLITE_CFLAGS is set: the build would compile SQLite with it and the twin would not; unset it")
}
// scripts/build.sh's ELF link: gc, lld when there is one, stripped.
const LDFLAGS =
  process.platform === "linux"
    ? [
        "-Wl,--gc-sections",
        "-Wl,--as-needed",
        "-Wl,-O2",
        "-Wl,--build-id=none",
        "-s",
        ...(spawnSync("ld.lld", ["--version"]).status === 0 ? ["-fuse-ld=lld"] : []),
      ]
    : []

const run = (cmd, args, what) => {
  const r = spawnSync(cmd, args, { cwd: root, encoding: "utf8", maxBuffer: 1 << 26 })
  if (r.status !== 0) {
    fail(`${what} failed (exit ${r.status})\n${r.stdout}${r.stderr}`)
  }
  return r.stdout
}

fs.mkdirSync(outDir, { recursive: true })
const exe = path.join(outDir, "nish")
const copy = path.join(outDir, "nish-copy")
const twin = path.join(outDir, "twin")
for (const f of [exe, copy, twin]) {
  fs.rmSync(f, { force: true })
}
fs.rmSync(path.join(outDir, "nish.ir"), { recursive: true, force: true })
run(
  nishc.cmd,
  [
    ...nishc.prefix,
    path.join(here, "main.ts"),
    "-o",
    `${path.join(outDir, "nish.ir")}${path.sep}`,
    "--link",
    exe,
  ],
  "the Nish build"
)
fs.copyFileSync(exe, copy)
if (!fs.readFileSync(exe).equals(fs.readFileSync(copy))) {
  fail("the copy is not byte-identical to the build")
}
const objects = []
for (const unit of ["sqlite3.c", "twin.c"]) {
  const src = unit === "twin.c" ? path.join(here, unit) : path.join(sqliteDir, unit)
  const obj = path.join(outDir, unit.replace(/\.c$/, ".o"))
  run(cc, [...CFLAGS, ...SQLITE_DEFS, "-I", sqliteDir, "-c", src, "-o", obj], `${cc} ${unit}`)
  objects.push(obj)
}
run(cc, [...CFLAGS, ...LDFLAGS, ...objects, "-lm", "-o", twin], `${cc} twin`)

// The seed, made again when what makes it changes.
const db = path.join(outDir, "feed.db")
const stamp = path.join(outDir, "feed.db.stamp")
const schema = path.join(here, "schema.sql")
const hash = createHash("sha256")
for (const f of [schema, path.join(here, "twin.c"), path.join(sqliteDir, "sqlite3.c")]) {
  hash.update(fs.readFileSync(f))
}
hash.update([cc, ...CFLAGS, ...SQLITE_DEFS].join(" "))
const want = hash.digest("hex")
if (!fs.existsSync(db) || !fs.existsSync(stamp) || fs.readFileSync(stamp, "utf8") !== want) {
  for (const f of [db, `${db}-wal`, `${db}-shm`, stamp]) {
    fs.rmSync(f, { force: true })
  }
  process.stdout.write(run(twin, ["seed", db, schema], "the seed"))
  fs.writeFileSync(stamp, want)
}

const LINE = /^rows (\d+) checksum (\d+) failed (-?\d+) count (\d+) ns (\d+)$/

/** One run of `bin` on workload `w`: what it read, and its ns per call. */
const runOnce = (bin, w) => {
  const out = run(bin, [w.name, db, String(w.count)], `${path.basename(bin)} ${w.name}`)
  const m = LINE.exec(out.trim())
  if (m === null || m[3] !== "0" || Number(m[1]) === 0) {
    fail(`${bin} ${w.name} printed ${JSON.stringify(out)}`)
  }
  return { answer: `rows ${m[1]} checksum ${m[2]} count ${m[4]}`, ns: Number(m[5]) / w.count }
}

const bins = [exe, copy, twin]
const labels = ["nish", "nish copy", "C"]

if (validate) {
  for (const w of WORKLOADS) {
    const answers = bins.map((b) => runOnce(b, w).answer)
    if (answers.some((a) => a !== answers[0])) {
      fail(`${w.name}: the sides disagree\n${answers.map((a, k) => `  ${labels[k]}: ${a}`).join("\n")}`)
    }
    console.log(`${w.name}: ${answers[0]}, the same on both sides`)
  }
  console.log("bench/sqlite: valid")
  process.exit(0)
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}
const min = (xs) => Math.min(...xs)
/** The interquartile range, quartiles by linear interpolation. */
const iqr = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const at = (q) => {
    const i = q * (s.length - 1)
    const lo = Math.floor(i)
    return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (i - lo)
  }
  return at(0.75) - at(0.25)
}

const times = WORKLOADS.map(() => bins.map(() => []))
const answers = WORKLOADS.map(() => null)
// Round 0 warms the binaries and the page cache and is not counted.
const timed = Math.ceil(rounds / bins.length) * bins.length
for (let round = 0; round <= timed; round++) {
  for (let w = 0; w < WORKLOADS.length; w++) {
    for (let j = 0; j < bins.length; j++) {
      const k = (j + round) % bins.length
      const r = runOnce(bins[k], WORKLOADS[w])
      if (answers[w] !== null && r.answer !== answers[w]) {
        fail(`round ${round}: ${labels[k]} ${WORKLOADS[w].name} printed ${r.answer}, not ${answers[w]}`)
      }
      answers[w] = r.answer
      if (round > 0) {
        times[w][k].push(r.ns)
      }
    }
  }
}

const ns = (v) => `${v.toFixed(0)} ns`
const signed = (v) => `${v >= 0 ? "+" : ""}${v.toFixed(0)} ns`
const version = /#define SQLITE_VERSION\s+"([^"]+)"/.exec(
  fs.readFileSync(path.join(sqliteDir, "sqlite3.h"), "utf8")
)
console.log(`sqlite: ${timed} rounds; SQLite ${version?.[1] ?? "of unknown version"}`)
for (let w = 0; w < WORKLOADS.length; w++) {
  const [n, c, t] = times[w]
  console.log(`${WORKLOADS[w].name}: ${answers[w]}`)
  for (let k = 0; k < bins.length; k++) {
    console.log(
      `  ${labels[k].padEnd(10)} min ${ns(min(times[w][k]))}/call, median ${ns(median(times[w][k]))}/call,` +
        ` IQR ${ns(iqr(times[w][k]))}`
    )
  }
  console.log(
    `  nish - C   min ${signed(min(n) - min(t))}, median ${signed(median(n) - median(t))}` +
      ` (${(((median(n) - median(t)) / median(t)) * 100).toFixed(1)}% of C's median)`
  )
  console.log(
    `  noise band (build against its copy): min ${ns(Math.abs(min(n) - min(c)))}` +
      ` (${((Math.abs(min(n) - min(c)) / min(n)) * 100).toFixed(1)}%),` +
      ` median ${ns(Math.abs(median(n) - median(c)))} (${((Math.abs(median(n) - median(c)) / median(n)) * 100).toFixed(1)}%)`
  )
}
