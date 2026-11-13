/**
 * The compiler under test, kept between runs by what it is built from.
 *
 *   import { linkCompiler } from "./compiler-cache.js";
 *   node tests/self/compiler-cache.js --key [--seed <nish>]
 *   node tests/self/compiler-cache.js --link <exe> [--seed <nish>]
 *
 * The seed's front end takes about two seconds over `src/compile.ts`, and its
 * `--link` about seventy more: the speed profile's full LTO is one module
 * optimised on one core, and a target with landing pads (every Linux and macOS
 * runner) links it in one partition (`scripts/build.sh`, "The speed link
 * splits..."). Every `node tests/run.js` paid that, so every CI job that runs
 * it -- eight `test` shards, seven steps of the NEON job -- and every filtered
 * run at a workstation spent a minute building a binary it had built before.
 *
 * **What the key covers is everything the link reads**, so a binary under a
 * key is the one `--link` would write now, byte for byte (`scripts/build.sh`
 * links one input to one output on one machine, which `scripts/bootstrap.sh`
 * already depends on):
 *
 *   - the seed's own file, and its package -- `libexec/`, `runtime/`, `std/`
 *     and `scripts/build.sh` under the root its `findPackage` settles on
 *     (`packageRoot` below), which is where the link's runtime and recipe come
 *     from, not this checkout's;
 *   - every source file the program is compiled from, and `package.json`. The
 *     seed's front end is run alone first (`-o <dir>/`, about two seconds),
 *     and each module it writes names its own file in `source_filename`
 *     (`modulesOf`), so the set is the compiler's own imports, not a guess;
 *   - the C compiler and linker by `--version`, the variables
 *     `scripts/build.sh` reads that reach a native link (`CC`,
 *     `NISH_SQLITE_CFLAGS`), the platform, the architecture and the core count
 *     (the speed link's partition count, where partitions are used).
 *
 * Hashing the files the front end names rather than all of `src/` and `std/`
 * keeps a change to a `std/` module the compiler does not import (most of
 * `std/net`) from costing every job a link: of 150 commits to main, 99 left
 * these files alone, where 67 left all of `src/` and `std/` alone. Anything
 * the key cannot see is a reason not to make one: a front end that fails, or a
 * module whose file is not there, leaves the compiler unkept and linked, as a
 * seed run under Node (`.js`) does, since it has no package to hash. `scripts/bootstrap.sh` and the fixed point never read
 * this cache: they prove a build, and a build they did not make proves nothing.
 *
 * The cache is `build/cache/compiler-under-test/<key>/`, newest four kept; CI
 * restores and saves the same directory with `actions/cache`, under the key
 * `--key` prints.
 */
import crypto from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { linkWith, root, seedForOracle, spawnSeed } from "./seed.js"

/** Where kept compilers live: under `build/`, so `rm -rf build` clears it with everything else. */
const CACHE = path.join(root, "build", "cache", "compiler-under-test")

/** How many keys to keep: a branch and `main` side by side, with room for a rebase. */
const KEEP = 4

/** Bumped when what the key covers changes, so an older layout is never read as this one. */
const FORMAT = "compiler-under-test 2"

/** Every regular file under `dir`, sorted, as paths relative to it; none when it is missing. */
const filesUnder = (dir) => {
  if (!fs.existsSync(dir)) {
    return []
  }
  return fs
    .readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(dir, path.join(entry.parentPath, entry.name)))
    .sort()
}

/**
 * The root `scripts/build.sh` runs from when `seedFile` links: the first of
 * its directory's parent, then its real path's, that holds the script, as
 * `packageRootCandidates` in `src/compile.ts` orders them; else this checkout,
 * the `.` candidate a compiler built inside it falls back to.
 */
const packageRoot = (seedFile) => {
  const candidates = [
    path.dirname(path.dirname(seedFile)),
    path.dirname(path.dirname(fs.realpathSync(seedFile))),
  ]
  return candidates.find((dir) => fs.existsSync(path.join(dir, "scripts", "build.sh"))) ?? root
}

/**
 * The source files the seed compiles `source` from, absolute and sorted, or
 * null when the front end fails, writes no module, or names a file that is not
 * there. Only the head of each module is read: `source_filename` is its second
 * line.
 */
const modulesOf = (seed, source) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nish-modules-"))
  try {
    const ran = spawnSeed(seed, [path.join(root, source), "-o", dir + path.sep])
    const modules = ran.status === 0 ? fs.readdirSync(dir).filter((f) => f.endsWith(".ll")) : []
    const files = new Set()
    for (const module of modules) {
      const head = Buffer.alloc(4096)
      const fd = fs.openSync(path.join(dir, module), "r")
      const read = fs.readSync(fd, head, 0, head.length, 0)
      fs.closeSync(fd)
      const named = /^source_filename = "([^"]+)"$/m.exec(head.subarray(0, read).toString("utf8"))
      if (named === null || !fs.existsSync(path.resolve(root, named[1]))) {
        return null
      }
      files.add(path.resolve(root, named[1]))
    }
    return files.size > 0 ? [...files].sort() : null
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

/** `<tool> --version`, or that it is not there: a different toolchain is a different binary. */
const toolVersion = (tool) => {
  const ran = spawnSync(tool, ["--version"], { encoding: "utf8" })
  return ran.status === 0 ? ran.stdout : `${tool}: not runnable`
}

/**
 * The key of the binary the seed links from `source`, or null when the seed
 * is not a native binary with a package to hash, or `modulesOf` cannot say
 * what the program is compiled from.
 */
const compilerKey = (seed, source) => {
  if (seed.prefix.length > 0) {
    return null
  }
  const modules = modulesOf(seed, source)
  if (modules === null) {
    return null
  }
  const pkg = packageRoot(seed.cmd)
  const hash = crypto.createHash("sha256")
  const take = (label, file) => {
    const bytes = fs.readFileSync(file)
    hash.update(`${label}\0${bytes.length}\0`)
    hash.update(bytes)
  }
  const takeTree = (label, dir) => {
    for (const file of filesUnder(dir)) {
      take(`${label}/${file}`, path.join(dir, file))
    }
  }
  hash.update(`${FORMAT}\0${source}\0`)
  take("seed", seed.cmd)
  for (const part of ["libexec", "runtime", "std"]) {
    takeTree(`package/${part}`, path.join(pkg, part))
  }
  take("package/scripts/build.sh", path.join(pkg, "scripts", "build.sh"))
  for (const file of modules) {
    take(`module/${path.relative(root, file)}`, file)
  }
  take("package.json", path.join(root, "package.json"))
  const cc = process.env.CC || "clang"
  hash.update(`cc\0${cc}\0${toolVersion(cc)}\0lld\0${toolVersion("ld.lld")}\0`)
  hash.update(`sqlite\0${process.env.NISH_SQLITE_CFLAGS ?? ""}\0`)
  hash.update(`host\0${process.platform}\0${process.arch}\0${os.availableParallelism()}\0`)
  return hash.digest("hex").slice(0, 32)
}

/** Drops all but the `KEEP` most recently used keys. */
const prune = () => {
  const entries = fs
    .readdirSync(CACHE, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^[0-9a-f]{32}$/.test(entry.name))
    .map((entry) => ({
      dir: path.join(CACHE, entry.name),
      used: fs.statSync(path.join(CACHE, entry.name)).mtimeMs,
    }))
    .sort((a, b) => b.used - a.used)
  for (const stale of entries.slice(KEEP)) {
    fs.rmSync(stale.dir, { recursive: true, force: true })
  }
}

/**
 * Keeps `built` under `key`. The copy is made beside the entry and renamed
 * into place, so a run that reads the entry while another writes it sees all
 * of the binary or none of it.
 */
const keep = (built, key, name) => {
  const dir = path.join(CACHE, key)
  const staging = `${dir}.${process.pid}.tmp`
  fs.rmSync(staging, { recursive: true, force: true })
  fs.mkdirSync(staging, { recursive: true })
  fs.copyFileSync(built, path.join(staging, name))
  try {
    fs.renameSync(staging, dir)
  } catch {
    // Another run kept the same key first; its binary is the same one.
    fs.rmSync(staging, { recursive: true, force: true })
  }
  prune()
}

/**
 * Links `source` with `seed` into `out`, or copies the binary a run before
 * linked from the same inputs. Answers null after printing why when the seed
 * cannot build it, else `{ out, key, reused }`: `key` is null when the seed
 * cannot be keyed and `reused` says whether the link was skipped.
 */
const linkCompiler = (seed, source, out) => {
  const key = compilerKey(seed, source)
  const name = path.basename(source, path.extname(source))
  const kept = key === null ? null : path.join(CACHE, key, name)
  if (kept !== null && fs.existsSync(kept)) {
    fs.mkdirSync(path.dirname(out), { recursive: true })
    fs.rmSync(out, { force: true })
    fs.copyFileSync(kept, out)
    fs.chmodSync(out, 0o755)
    const now = new Date()
    fs.utimesSync(path.dirname(kept), now, now)
    return { out, key, reused: true }
  }
  if (linkWith(seed, source, out) === null) {
    return null
  }
  if (key !== null) {
    keep(out, key, name)
  }
  return { out, key, reused: false }
}

const ENTRY = path.join("src", "compile.ts")

/** The command line: `--key` prints the key, `--link <exe>` builds or copies the compiler. */
const main = (argv) => {
  const seed = seedForOracle(argv)
  if (seed.error !== undefined) {
    console.error(`compiler-cache: ${seed.error}`)
    return 2
  }
  if (argv.includes("--key")) {
    const key = compilerKey(seed, ENTRY)
    if (key === null) {
      console.error(
        `compiler-cache: no key for what ${seed.label} links: it runs under Node, or its front end could not compile ${ENTRY}`
      )
      return 1
    }
    console.log(key)
    return 0
  }
  const at = argv.indexOf("--link")
  const out = at >= 0 ? argv[at + 1] : undefined
  if (out === undefined) {
    console.error("usage: node tests/self/compiler-cache.js (--key | --link <exe>) [--seed <nish>]")
    return 2
  }
  const linked = linkCompiler(seed, ENTRY, path.resolve(out))
  if (linked === null) {
    return 1
  }
  console.log(`${linked.reused ? "reused" : "linked"} ${out} (${seed.label}, key ${linked.key ?? "none"})`)
  return 0
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)))
}

export { linkCompiler }
