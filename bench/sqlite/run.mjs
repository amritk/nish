// What `nish/sqlite` adds to a call of SQLite, on the twelve-dollar server
// challenge's schema and queries: the same loop through the module (main.ts),
// through SQLite's own C API (twin.c) and through rusqlite (twin.rs), on the
// same database, and how much of a difference this machine can see at all.
//
//   npm run build && node bench/sqlite/run.mjs [--validate] [--rounds N] [--no-rust] [--variant V | --base REV] [--compiler <nish>]
//     --validate  one run of each side at small counts: rows, checksums and
//                 failures must agree, nothing is timed
//     --rounds N  timed rounds, rounded up to a multiple of the number of
//                 binaries and of 2 (default 12), after one uncounted
//                 warm-up round
//     --no-rust   leave out the THREADSAFE=2 group: twin.rs, its C twin and
//                 the --threads build
//     --variant V one more binary, timed in the same rounds against what it
//                 varies and that binary's byte-identical copy, whose
//                 difference is the comparison's noise band; the THREADSAFE=2
//                 group is left out. V is one of
//                   pgo            main.ts linked with --pgo-use, on a profile
//                                  trained in a temp dir (below)
//                   x86-64-v3      main.ts linked with --cpu x86-64-v3
//                   pgo-x86-64-v3  both
//                   c-native       the C twin compiled and linked with
//                                  -march=native, against the C twin (nish
//                                  refuses --cpu native, so this is C only)
//                 With --validate, the variant must read what every side reads.
//     --base REV  the variant is main.ts built by the same compiler against
//                 commit REV's std/ and runtime/ (and its scripts/build.sh),
//                 checked out in a git worktree under build/bench/sqlite/ and
//                 removed after the build: what a change to the module or
//                 the adapter moves, timed in the same rounds as the build
//                 and its copy. It runs every Nish workload, so main.ts's
//                 calls must be ones REV's module has. Not with --variant.
//
// PGO's training: an instrumented build (`--link --pgo-generate`, with the
// variant's --cpu) runs lookup, feed, insert and insert-txn on a database
// `twin seed` makes in a temp dir from another seed and at other sizes than
// the timed one, so the profile is not fitted to the rows the timed runs read;
// `llvm-profdata merge` writes the profile to build/bench/sqlite/, and the
// variant is `--link --pgo-use` on it. No profile is kept in the repository.
//
// Two SQLite builds are timed. THREADSAFE=0 is what a `--link` build gets:
// the build, its copy and the C twin. THREADSAFE=2 is what `--threads` gets,
// and the least rusqlite opens a connection on: the `--threads` build, twin.c
// on that SQLite and twin.rs on it, which cargo builds against the same
// sqlite3.c object (libsqlite3-sys pointed at it, never its bundled copy or
// the system's; run.mjs holds twin.rs's `PRAGMA compile_options` to the C
// twin's). Rust − C is rusqlite's cost; the C twins' difference is the
// threading mode's. With no cargo the group is left out, with a note.
//
// main.ts is built with `--link` (the speed profile) and copied byte for byte;
// twin.c is compiled against the same runtime/sqlite/sqlite3.c with the flags
// scripts/build.sh compiles SQLite with for that link (the speed profile's
// optimisation flags, its hardening as bench/compiler.mjs reads it, and the
// SQLite options, THREADSAFE=0 among them), sqlite3.c as a native object of
// its own as the link has it, and linked with the link's flags on Linux; the
// twin must then pass scripts/check-hardening.mjs, as a Nish binary does.
// NISH_SQLITE_CFLAGS, which changes how the build compiles SQLite, is refused:
// the twin would not have it. Both open the database with the same flags and
// PRAGMAs and prepare each statement once.
//
// The database is the challenge's schema.sql filled by `twin seed`: 50,000
// users, 500,000 posts and 2,000,000 likes from one fixed generator, in WAL
// mode, made once in build/bench/sqlite/ and made again only when schema.sql,
// twin.c, sqlite3.c or the flags change. Nothing is downloaded.
//
// Each round runs every workload on every binary, in an order that rotates by
// round, so over a multiple of their number each goes first equally often;
// the feed-cursor workloads, which the twins have no path for, run on
// the build and its copy alone, which alternate, so balance needs an even
// count: the timed count is rounded up to a multiple of both, and their lines
// are set against feed's. A run times its own loop and prints a checksum of
// every value it read; every run of a workload must print the same rows and
// checksum. The report is ns per call, min, median and interquartile range
// over the rounds; the cost of the module
// (and of the adapter's checks) is the build less the twin, and the noise band
// is the build against its byte-identical copy: a difference inside it is one
// this machine cannot see.
import { createHash } from "node:crypto"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { compileArgv, compilerFrom, hardeningFlags, unhardened } from "../compiler.mjs"

const root = path.resolve(import.meta.dirname, "..", "..")
const here = path.join(root, "bench", "sqlite")
const sqliteDir = path.join(root, "runtime", "sqlite")
const outDir = path.join(root, "build", "bench", "sqlite")
const nishc = compilerFrom(process.argv)

/** `name` on PATH or in one of `extra`, or null. */
const which = (name, extra = []) => {
  for (const dir of [...(process.env.PATH ?? "").split(path.delimiter), ...extra]) {
    const p = path.join(dir, name)
    if (dir !== "" && fs.existsSync(p)) {
      return p
    }
  }
  return null
}

const fail = (msg) => {
  console.error(`bench/sqlite/run.mjs: ${msg}`)
  process.exit(2)
}

let rounds = 12
let validate = false
let rust = true
let variant = null
let baseRev = null
const argv = nishc.rest
for (let i = 2; i < argv.length; i++) {
  if (argv[i] === "--rounds") {
    rounds = Number(argv[++i])
  } else if (argv[i] === "--validate") {
    validate = true
  } else if (argv[i] === "--no-rust") {
    rust = false
  } else if (argv[i] === "--base") {
    baseRev = argv[++i]
    if (baseRev === undefined) {
      fail("--base needs a commit")
    }
  } else if (argv[i] === "--variant") {
    variant = argv[++i]
    if (variant === undefined) {
      fail("--variant needs a value")
    }
  } else {
    fail(`unknown option ${argv[i]}`)
  }
}
if (!(rounds >= 2)) {
  fail("--rounds needs at least 2")
}
// What each --variant builds: a profile to link with, the --cpu level, or the
// C twin's -march=native.
const VARIANTS = {
  pgo: { pgo: true, cpu: [] },
  "x86-64-v3": { pgo: false, cpu: ["--cpu", "x86-64-v3"] },
  "pgo-x86-64-v3": { pgo: true, cpu: ["--cpu", "x86-64-v3"] },
  "c-native": { native: true },
}
if (variant !== null && !Object.hasOwn(VARIANTS, variant)) {
  fail(`--variant takes ${Object.keys(VARIANTS).join(", ")}, not ${variant}`)
}
if (baseRev !== null) {
  if (variant !== null) {
    fail("--base and --variant each add the one variant; pass one of them")
  }
  // The rest of the script reads a base build as one more Nish variant.
  variant = "base"
  VARIANTS.base = { base: baseRev, pgo: false, cpu: [] }
}

// Calls a run: each timed run is a fraction of a second on a 2020s core.
// feed-cursor-walk and feed-cursor read feed's rows through cursors instead
// of SQL: they run at feed's count and must print feed's line (`same`), and
// neither twin has a cursor path, so they run on the build and its copy only
// (`noTwin`). feed-cursor-walk opens its transaction and cursors once, outside
// the timed loop; feed-cursor opens and closes them on every call.
// feed-cursor-row is feed-cursor-walk with each post's and author's columns
// read by one Cursor.readRow call, timed in the same rounds.
const WORKLOADS = [
  { name: "lookup", count: validate ? 2000 : 200000 },
  { name: "feed", count: validate ? 50 : 10000 },
  { name: "feed-cursor-walk", count: validate ? 50 : 10000, same: "feed", noTwin: true },
  { name: "feed-cursor-row", count: validate ? 50 : 10000, same: "feed", noTwin: true },
  { name: "feed-cursor", count: validate ? 50 : 10000, same: "feed", noTwin: true },
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
]
// The two threading modes: a build without --threads, and one with it.
const THREADSAFE = { st: "-DSQLITE_THREADSAFE=0", mt: "-DSQLITE_THREADSAFE=2" }
const cc = process.env.CC || "clang"
// scripts/build.sh's hardening, as bench/compiler.mjs reads it, all of it:
// sqlite3.c is C in the link too, so the stack protector and _FORTIFY_SOURCE
// reach it there as they do here. The compiles leave out the linker's flags,
// as build.sh's own compiles do.
const HARDEN = (() => {
  try {
    return hardeningFlags(cc)
  } catch (e) {
    return fail(e.message)
  }
})()
const HARDEN_CC = HARDEN.filter((f) => !f.startsWith("-Wl,") && !f.startsWith("-fuse-ld="))
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
        "-Wl,--build-id=sha1",
        "-s",
        ...(spawnSync("ld.lld", ["--version"]).status === 0 ? ["-fuse-ld=lld"] : []),
      ]
    : []

const run = (cmd, args, what, env = process.env) => {
  const r = spawnSync(cmd, args, { cwd: root, encoding: "utf8", maxBuffer: 1 << 26, env })
  if (r.status !== 0) {
    fail(`${what} failed (exit ${r.status})\n${r.stdout}${r.stderr}`)
  }
  return r.stdout
}

fs.mkdirSync(outDir, { recursive: true })
const exe = path.join(outDir, "nish")
const copy = path.join(outDir, "nish-copy")
const twin = path.join(outDir, "twin")
const exeMt = path.join(outDir, "nish-threads")
const twinMt = path.join(outDir, "twin-mt")
const rustDir = path.join(outDir, "rust")
const twinRs = path.join(rustDir, "target", "release", "twin-rs")
const exeVariant = path.join(outDir, "nish-variant")
const twinCopy = path.join(outDir, "twin-copy")
const twinNative = path.join(outDir, "twin-native")
for (const f of [exe, copy, twin, exeMt, twinMt, twinRs, exeVariant, twinCopy, twinNative]) {
  fs.rmSync(f, { force: true })
}
const nishBuild = (out, extra, what, compiler = nishc) => {
  const ir = `${out}.ir`
  fs.rmSync(ir, { recursive: true, force: true })
  run(
    compiler.cmd,
    compileArgv(compiler, [path.join(here, "main.ts"), "-o", `${ir}${path.sep}`, "--link", out, ...extra]),
    what
  )
}
nishBuild(exe, [], "the Nish build")
/** `bin` copied to `to`, which must then be byte-identical to it. */
const copyOf = (bin, to) => {
  fs.copyFileSync(bin, to)
  if (!fs.readFileSync(bin).equals(fs.readFileSync(to))) {
    fail(`${path.basename(to)} is not byte-identical to ${path.basename(bin)}`)
  }
}
copyOf(exe, copy)
/**
 * twin.c built on SQLite in threading mode `mode` (`st` or `mt`), with `extra`
 * on every compile and the link; answers the SQLite object too.
 */
const cTwin = (mode, out, extra = []) => {
  const objects = []
  const tag = extra.length > 0 ? `-${path.basename(out)}` : ""
  for (const unit of ["sqlite3.c", "twin.c"]) {
    const src = unit === "twin.c" ? path.join(here, unit) : path.join(sqliteDir, unit)
    const obj = path.join(outDir, unit.replace(/\.c$/, `-${mode}${tag}.o`))
    const defs = [...SQLITE_DEFS, THREADSAFE[mode]]
    run(
      cc,
      [...CFLAGS, ...extra, ...HARDEN_CC, ...defs, "-I", sqliteDir, "-c", src, "-o", obj],
      `${cc} ${unit} (${mode}${tag})`
    )
    objects.push(obj)
  }
  run(
    cc,
    [...CFLAGS, ...extra, ...HARDEN, ...LDFLAGS, ...objects, "-lm", "-o", out],
    `${cc} ${path.basename(out)}`
  )
  const lacks = unhardened(out)
  if (lacks !== null) {
    fail(`the C twin ${path.basename(out)} is not built as hardened as a Nish binary\n${lacks}`)
  }
  return objects[0]
}
cTwin("st", twin)
const schema = path.join(here, "schema.sql")

/** One run of `bin`'s workload `name` on `database`, as `run` runs it: its stdout. */
const runWorkload = (bin, name, database, count, env = process.env) =>
  run(bin, [name, database, String(count)], `${path.basename(bin)} ${name}`, env)
const LINE = /^rows (\d+) checksum (\d+) failed (-?\d+) count (\d+) ns (\d+)$/
/** What a workload's run printed, refused unless it read rows and nothing failed. */
const parsed = (bin, name, out) => {
  const m = LINE.exec(out.trim())
  if (m === null || m[3] !== "0" || Number(m[1]) === 0) {
    fail(`${bin} ${name} printed ${JSON.stringify(out)}`)
  }
  return m
}

// PGO's training database: another seed, and other sizes, than the timed one.
// It has more posts than lookup's ids reach, so every lookup finds its post;
// the insert workloads, which run last, delete the posts past id 500,000.
const TRAIN_SEED = ["7", "45000", "510000", "1800000"]
const TRAIN = [
  ["lookup", 50000],
  ["feed", 2000],
  ["insert", 5000],
  ["insert-txn", 20000],
]
/** An instrumented build of main.ts with `cpu`, trained, and its runs merged: the profile's path. */
const trainedProfile = (cpu) => {
  const profdata = process.env.LLVM_PROFDATA || which("llvm-profdata")
  if (profdata === null) {
    fail(
      "--variant pgo needs llvm-profdata on PATH, as nish --pgo-use does (Ubuntu's llvm-18 installs llvm-profdata-18)"
    )
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nish-sqlite-pgo-"))
  try {
    const instrumented = path.join(tmp, "nish-instrumented")
    nishBuild(instrumented, ["--pgo-generate", ...cpu], "the instrumented (--pgo-generate) build")
    const trainDb = path.join(tmp, "train.db")
    run(twin, ["seed", trainDb, schema, ...TRAIN_SEED], "the training seed")
    const env = { ...process.env, LLVM_PROFILE_FILE: path.join(tmp, "train-%p.profraw") }
    for (const [name, count] of TRAIN) {
      parsed(instrumented, name, runWorkload(instrumented, name, trainDb, count, env))
    }
    const raws = fs
      .readdirSync(tmp)
      .filter((f) => f.endsWith(".profraw"))
      .map((f) => path.join(tmp, f))
    if (raws.length !== TRAIN.length) {
      fail(`the training wrote ${raws.length} .profraw files, not one a run (${TRAIN.length})`)
    }
    const out = path.join(outDir, `${variant}.profdata`)
    run(profdata, ["merge", "-o", out, ...raws], "llvm-profdata merge")
    return out
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}
/**
 * main.ts built against commit `rev`'s std/ and runtime/: the compiler reads
 * its package root from its own path (`<root>/build/nish`), so a copy of it
 * inside a worktree of `rev` compiles and links with that commit's library,
 * adapter and scripts/build.sh. The worktree goes once the build is done.
 */
const baseBuild = (rev, out) => {
  if (nishc.prefix.length > 0) {
    fail("--base needs a native compiler, not a Node entry point, to copy into the base's tree")
  }
  const tree = path.join(outDir, "base-tree")
  const git = (args, what) => run("git", args, what)
  fs.rmSync(tree, { recursive: true, force: true })
  git(["worktree", "prune"], "git worktree prune")
  git(["worktree", "add", "--detach", "--force", tree, rev], `git worktree add ${rev}`)
  try {
    const at = git(["-C", tree, "rev-parse", "--short=12", "HEAD"], "git rev-parse").trim()
    const compiler = path.join(tree, "build", "nish")
    fs.mkdirSync(path.dirname(compiler), { recursive: true })
    fs.copyFileSync(nishc.cmd, compiler)
    fs.chmodSync(compiler, 0o755)
    nishBuild(out, [], `the base build (${rev})`, { cmd: compiler, prefix: [] })
    return at
  } finally {
    git(["worktree", "remove", "--force", tree], "git worktree remove")
  }
}
const spec = variant === null ? null : VARIANTS[variant]
let baseAt = null
if (spec?.base !== undefined) {
  baseAt = baseBuild(spec.base, exeVariant)
} else if (spec?.native === true) {
  copyOf(twin, twinCopy)
  cTwin("st", twinNative, ["-march=native"])
} else if (spec !== null) {
  const pgo = spec.pgo ? ["--pgo-use", trainedProfile(spec.cpu)] : []
  nishBuild(exeVariant, [...pgo, ...spec.cpu], `the ${variant} build`)
}

// The THREADSAFE=2 group, when there is a cargo to build twin.rs with, and no
// variant to time instead.
if (rust && variant !== null) {
  console.error(
    `note: ${baseRev !== null ? "--base" : `--variant ${variant}`} leaves out the THREADSAFE=2 group (rusqlite)`
  )
}
const cargo =
  rust && variant === null
    ? process.env.CARGO || which("cargo", [path.join(os.homedir(), ".cargo", "bin")])
    : null
if (rust && variant === null && cargo === null) {
  console.error("note: cargo not found; the THREADSAFE=2 group (rusqlite) is left out (set CARGO=<path>)")
}
let rustVersions = null
if (cargo !== null) {
  nishBuild(exeMt, ["--threads"], "the Nish --threads build")
  const sqliteMt = cTwin("mt", twinMt)
  // libsqlite3-sys links `-lsqlite3` from SQLITE3_LIB_DIR: an archive of the
  // C twin's own object, so the Rust side runs the very SQLite the C side does.
  const libDir = path.join(rustDir, "lib")
  fs.mkdirSync(libDir, { recursive: true })
  fs.mkdirSync(path.join(rustDir, "src"), { recursive: true })
  const archive = path.join(libDir, "libsqlite3.a")
  fs.rmSync(archive, { force: true })
  const ar = process.env.AR || which("llvm-ar") || which("ar")
  if (ar === null) {
    fail("no ar to archive sqlite3.c's object with (set AR)")
  }
  run(ar, ["rcs", archive, sqliteMt], "ar libsqlite3.a")
  fs.copyFileSync(path.join(here, "twin.rs"), path.join(rustDir, "src", "main.rs"))
  fs.writeFileSync(
    path.join(rustDir, "Cargo.toml"),
    [
      '[package]\nname = "twin-rs"\nversion = "0.0.0"\nedition = "2024"\npublish = false\n',
      // An empty workspace keeps cargo from looking above build/ for one.
      "[workspace]\n",
      // Pinned, so a rerun builds the rusqlite the figures were measured with.
      // No features: not `bundled`, which would compile its own SQLite.
      '[dependencies]\nrusqlite = { version = "=0.43.0", default-features = false }\n',
      // The speed profile's shape: -O3, one unit, LTO across the Rust crates.
      '[profile.release]\nopt-level = 3\ncodegen-units = 1\nlto = "fat"\npanic = "abort"\nstrip = "symbols"\n',
    ].join("\n")
  )
  const env = {
    ...process.env,
    SQLITE3_LIB_DIR: libDir,
    SQLITE3_INCLUDE_DIR: sqliteDir,
    SQLITE3_STATIC: "1",
    // A system sqlite3.pc would otherwise win over SQLITE3_LIB_DIR.
    SQLITE3_NO_PKG_CONFIG: "1",
  }
  run(
    cargo,
    ["build", "--release", "--quiet", "--manifest-path", path.join(rustDir, "Cargo.toml")],
    "cargo twin-rs",
    env
  )
  const lock = fs.readFileSync(path.join(rustDir, "Cargo.lock"), "utf8")
  const crate = (name) => lock.match(new RegExp(`name = "${name}"\nversion = "([^"]+)"`))?.[1] ?? "unknown"
  const rustc = run(
    process.env.RUSTC || which("rustc", [path.join(os.homedir(), ".cargo", "bin")]) || "rustc",
    ["--version"],
    "rustc --version"
  ).trim()
  rustVersions = `rusqlite ${crate("rusqlite")}, libsqlite3-sys ${crate("libsqlite3-sys")}, ${rustc}`
}

// The seed, made again when what makes it changes.
const db = path.join(outDir, "feed.db")
const stamp = path.join(outDir, "feed.db.stamp")
const hash = createHash("sha256")
for (const f of [schema, path.join(here, "twin.c"), path.join(sqliteDir, "sqlite3.c")]) {
  hash.update(fs.readFileSync(f))
}
hash.update([cc, ...CFLAGS, ...HARDEN, ...SQLITE_DEFS, THREADSAFE.st].join(" "))
const want = hash.digest("hex")
if (!fs.existsSync(db) || !fs.existsSync(stamp) || fs.readFileSync(stamp, "utf8") !== want) {
  for (const f of [db, `${db}-wal`, `${db}-shm`, stamp]) {
    fs.rmSync(f, { force: true })
  }
  process.stdout.write(run(twin, ["seed", db, schema], "the seed"))
  fs.writeFileSync(stamp, want)
}

/** One run of `bin` on workload `w`: what it read, and its ns per call. */
const runOnce = (bin, w) => {
  const m = parsed(bin, w.name, runWorkload(bin, w.name, db, w.count))
  return { answer: `rows ${m[1]} checksum ${m[2]} count ${m[4]}`, ns: Number(m[5]) / w.count }
}

// The Rust side must run the SQLite the C side runs: the same options, and
// no libsqlite3 of the system's loaded beside it.
if (cargo !== null) {
  const cOptions = run(twinMt, ["options", db], "twin-mt options")
  const rsOptions = run(twinRs, ["options", db], "twin-rs options")
  if (rsOptions !== cOptions || !/THREADSAFE=2/.test(rsOptions)) {
    fail(
      `twin-rs does not run the C twin's SQLite\n  C:    ${cOptions.trim().split("\n").join(" ")}\n  Rust: ${rsOptions.trim().split("\n").join(" ")}`
    )
  }
  const readelf = which("llvm-readelf") || which("readelf")
  if (readelf !== null && /NEEDED.*libsqlite3/.test(run(readelf, ["-d", twinRs], "readelf twin-rs"))) {
    fail("twin-rs links a shared libsqlite3, not the C twin's object")
  }
}

const bins = [exe, copy, twin, ...(cargo !== null ? [exeMt, twinMt, twinRs] : [])]
const labels = ["nish", "nish copy", "C", ...(cargo !== null ? ["nish mt", "C mt", "Rust mt"] : [])]
// The binaries that run a noTwin workload: the build, its copy, and a Nish variant.
const nishSide = [0, 1]
// A variant's comparison, as indices into `bins`: the variant, what it
// varies, and that binary's copy.
let against = null
if (spec?.native === true) {
  bins.push(twinCopy, twinNative)
  labels.push("C copy", "C native")
  against = { variant: 4, base: 2, copy: 3 }
} else if (spec !== null) {
  bins.push(exeVariant)
  labels.push(`nish ${variant}`)
  nishSide.push(3)
  against = { variant: 3, base: 0, copy: 1 }
}
/** The binaries that run workload `w`: index into `bins`. */
const ranBy = (w) => (w.noTwin ? nishSide : bins.map((_, k) => k))
const byName = new Map(WORKLOADS.map((w, i) => [w.name, i]))

if (validate) {
  const seen = new Map()
  for (const w of WORKLOADS) {
    const answers = ranBy(w).map((k) => runOnce(bins[k], w).answer)
    if (answers.some((a) => a !== answers[0])) {
      fail(`${w.name}: the sides disagree\n${answers.map((a, k) => `  ${labels[k]}: ${a}`).join("\n")}`)
    }
    if (w.same !== undefined && answers[0] !== seen.get(w.same)) {
      fail(`${w.name} printed ${answers[0]}, not ${w.same}'s ${seen.get(w.same)}`)
    }
    seen.set(w.name, answers[0])
    console.log(
      w.same !== undefined
        ? `${w.name}: ${answers[0]}, the same on every Nish side, and the same as ${w.same}`
        : `${w.name}: ${answers[0]}, the same on every side`
    )
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
// Every rotation must come round equally often: all the binaries, or the
// build and its copy alone for a noTwin workload, so the lcm of the two.
const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b))
const period = WORKLOADS.map((w) => ranBy(w).length).reduce((a, n) => (a * n) / gcd(a, n), 1)
const timed = Math.ceil(rounds / period) * period
for (let round = 0; round <= timed; round++) {
  for (let w = 0; w < WORKLOADS.length; w++) {
    const ks = ranBy(WORKLOADS[w])
    for (let j = 0; j < ks.length; j++) {
      const k = ks[(j + round) % ks.length]
      const r = runOnce(bins[k], WORKLOADS[w])
      const same = WORKLOADS[w].same
      const expected = answers[w] ?? (same === undefined ? null : answers[byName.get(same)])
      if (expected !== null && r.answer !== expected) {
        fail(`round ${round}: ${labels[k]} ${WORKLOADS[w].name} printed ${r.answer}, not ${expected}`)
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
if (variant !== null) {
  const what = baseAt === null ? variant : `base, main.ts on ${baseRev}'s std/ and runtime/ (${baseAt})`
  console.log(`  variant: ${what}, against ${labels[against.base]} and its copy`)
}
if (rustVersions !== null) {
  console.log(`  mt: SQLITE_THREADSAFE=2; ${rustVersions}`)
}
/** The noise band line: `a`, a binary's times, against `b`, its copy's. */
const band = (what, a, b) =>
  console.log(
    `  noise band (${what}): min ${ns(Math.abs(min(a) - min(b)))}` +
      ` (${((Math.abs(min(a) - min(b)) / min(a)) * 100).toFixed(1)}%),` +
      ` median ${ns(Math.abs(median(a) - median(b)))} (${((Math.abs(median(a) - median(b)) / median(a)) * 100).toFixed(1)}%)`
  )
const pct = (a, b) => `${(((median(a) - median(b)) / median(b)) * 100).toFixed(1)}%`
for (let w = 0; w < WORKLOADS.length; w++) {
  const [n, c, t, nm, tm, rs] = times[w]
  console.log(`${WORKLOADS[w].name}: ${answers[w]}`)
  for (const k of ranBy(WORKLOADS[w])) {
    console.log(
      `  ${labels[k].padEnd(10)} min ${ns(min(times[w][k]))}/call, median ${ns(median(times[w][k]))}/call,` +
        ` IQR ${ns(iqr(times[w][k]))}`
    )
  }
  const same = WORKLOADS[w].same
  if (same !== undefined) {
    // Against the other workload's build, timed in the same rounds.
    const s = times[byName.get(same)][0]
    console.log(
      `  - ${same.padEnd(8)} min ${signed(min(n) - min(s))}, median ${signed(median(n) - median(s))}` +
        ` (${(((median(n) - median(s)) / median(s)) * 100).toFixed(1)}% of ${same}'s median)`
    )
  }
  if (!WORKLOADS[w].noTwin) {
    console.log(
      `  nish - C   min ${signed(min(n) - min(t))}, median ${signed(median(n) - median(t))}` +
        ` (${(((median(n) - median(t)) / median(t)) * 100).toFixed(1)}% of C's median)`
    )
  }
  band("build against its copy", n, c)
  if (against !== null && ranBy(WORKLOADS[w]).includes(against.variant)) {
    const [v, b, bc] = [times[w][against.variant], times[w][against.base], times[w][against.copy]]
    const base = labels[against.base]
    console.log(
      `  ${`${labels[against.variant]} - ${base}`.padEnd(18)} min ${signed(min(v) - min(b))}, median ${signed(median(v) - median(b))} (${pct(v, b)} of ${base}'s median)`
    )
    if (against.base !== 0) {
      band(`${base} against its copy`, b, bc)
    }
  }
  if (rs !== undefined && !WORKLOADS[w].noTwin) {
    for (const [label, a, b] of [
      ["nish mt - C mt", nm, tm],
      ["Rust mt - C mt", rs, tm],
      ["nish mt - Rust mt", nm, rs],
      ["C mt - C", tm, t],
    ]) {
      console.log(
        `  ${label.padEnd(18)} min ${signed(min(a) - min(b))}, median ${signed(median(a) - median(b))} (${pct(a, b)} of the second's median)`
      )
    }
  }
}
