/**
 * The tests/link programs' results, kept between runs by what each one reads.
 *
 *   import { openLinkResults } from "./link-results.js"
 *   node tests/run.js --link-results build/cache/link-results/shard-3.json --shard 3/9
 *
 * A link program is a compile, a link, a run and the checks on what they
 * wrote; it reads the compiler under test, the runtime and the link recipe,
 * the program's own directory and the sources the compiler follows from its
 * `main.ts`, the toolchain, and the harness that runs it. When none of those
 * changed since a run in which every one of its checks passed, the same
 * checks pass again, so a pull request's second push, or a first push that
 * leaves a program's inputs as `main` had them, replays that run's record
 * instead of building the program again. The `test` job keeps the file in
 * the Actions cache, per shard (`docs/wp10-ci.md`, "Link-program results
 * across runs"); the push to main and the release never read it.
 *
 * **What the key covers** (`baseKey`, then each entry's own):
 *
 *   - the compiler under test, byte for byte, and the suite's flags other
 *     than the ones that only place work (`--shard`, `--jobs`, `--seed`,
 *     `--link-results`): the seed is in the binary already;
 *   - the harness: tests/run.js and every file it imports, followed through
 *     relative imports, so any edit to the suite's code is a new key;
 *   - everything under runtime/, scripts/build.sh, package.json and
 *     nish-capabilities.lock.json, which every `--link` reads;
 *   - the toolchain by `--version`, Node's version, the platform, the
 *     architecture, the kernel release, glibc, the CPU's model and feature
 *     flags (a kernel path the runtime picks at run time), the core count, and
 *     every variable whose name starts with `NISH_`, with `WASI_SYSROOT` and
 *     `CC`;
 *   - the program's directory, every file under it by content;
 *   - the sources: each module the compile wrote names its own file in
 *     `source_filename`, as `tests/self/compiler-cache.js` reads them, and the
 *     entry keeps each one's hash and the names in its directory, so an edited
 *     import, or a file added beside one that a resolver could pick instead,
 *     is a miss.
 *
 * **What is never kept**, so always run: a record with a failed check, or no
 * check, or a log line (an `--update` run writes goldens); a program a later
 * section reads the output of (`never`, `LINK_READ_LATER` in tests/run.js);
 * a program that wrote no module, or whose module names a file outside the
 * checkout; and a program any file of whose directory names a path under
 * another top-level directory of the checkout (`"tests/json-suite/..."`,
 * `"runtime/runtime.c"`): such a program reads that file at run time, which
 * no compile names, so its key cannot see it. A path built at run time from
 * pieces is the one read this cannot find; the push to main, which never
 * replays, runs every program in full.
 */
import crypto from "node:crypto"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

/** Bumped when what the key covers changes, so an older file is never read as this one. */
export const FORMAT = "link-results 1"

/** The suite's flags that only place work, each with the value after it. */
export const PLACING_FLAGS = ["--shard", "--jobs", "--seed", "--link-results"]

const sha = (data) => crypto.createHash("sha256").update(data).digest("hex")

/** Every regular file under `dir`, sorted, relative to it; none when it is missing. */
const filesUnder = (dir) =>
  fs.existsSync(dir)
    ? fs
        .readdirSync(dir, { recursive: true, withFileTypes: true })
        .filter((e) => e.isFile())
        .map((e) => path.relative(dir, path.join(e.parentPath, e.name)).split(path.sep).join("/"))
        .sort()
    : []

/** One hash over a tree's paths and contents. */
const treeHash = (dir) => {
  const h = crypto.createHash("sha256")
  for (const f of filesUnder(dir)) {
    h.update(`${f}\0`)
    h.update(fs.readFileSync(path.join(dir, f)))
    h.update("\0")
  }
  return h.digest("hex")
}

/** A file's hash, or `absent`. */
const fileHash = (file) => (fs.existsSync(file) ? sha(fs.readFileSync(file)) : "absent")

/** The names in a directory, sorted and hashed: what a resolver choosing among them could see. */
const listingHash = (dir) => (fs.existsSync(dir) ? sha(fs.readdirSync(dir).sort().join("\0")) : "absent")

/**
 * `file` and every file it imports by a relative path, followed transitively:
 * the harness a link program's checks are written in.
 *
 * @param {string} file a path relative to the checkout
 * @param {Set<string>} [seen] the files found so far
 * @returns {Set<string>} the closure, relative to the checkout
 */
export const harnessFiles = (file, seen = new Set()) => {
  if (seen.has(file) || !fs.existsSync(path.join(root, file))) {
    return seen
  }
  seen.add(file)
  const text = fs.readFileSync(path.join(root, file), "utf8")
  for (const m of text.matchAll(/^(?:import|export) [^"]*?from "(\.\.?\/[^"]+)"/gm)) {
    harnessFiles(path.posix.normalize(path.posix.join(path.posix.dirname(file), m[1])), seen)
  }
  return seen
}

/** `<tool> --version`, or that it is not there. */
const toolVersion = (tool) => {
  const ran = spawnSync(tool, ["--version"], { encoding: "utf8" })
  return ran.status === 0 ? ran.stdout : `${tool}: not runnable`
}

/** The CPU's model name and feature flags, from /proc/cpuinfo where there is one. */
const cpuIdentity = () => {
  const text = fs.existsSync("/proc/cpuinfo") ? fs.readFileSync("/proc/cpuinfo", "utf8") : ""
  const field = (name) => new RegExp(`^${name}\\s*:\\s*(.*)$`, "m").exec(text)?.[1] ?? ""
  return `${field("model name")}|${field("flags") || field("Features")}|${os.cpus()[0]?.model ?? ""}`
}

/**
 * What every program of this run shares: the compiler, the harness, the
 * link's own inputs, the machine and the flags.
 *
 * @param {object} run the run
 * @param {string} run.nish the compiler under test
 * @param {string[]} run.argv the suite's arguments after `node tests/run.js`
 * @param {NodeJS.ProcessEnv} [run.env] the environment the programs inherit
 * @returns {string} the key, hex
 */
export const baseKey = ({ nish, argv, env = process.env }) => {
  const flags = []
  for (let i = 0; i < argv.length; i++) {
    if (PLACING_FLAGS.includes(argv[i])) {
      i++
    } else {
      flags.push(argv[i])
    }
  }
  const harness = [...harnessFiles("tests/run.js")].sort()
  const vars = Object.keys(env)
    .filter((k) => k.startsWith("NISH_") || k === "WASI_SYSROOT" || k === "CC")
    .sort()
    .map((k) => `${k}=${env[k]}`)
  const glibc = process.report?.getReport?.().header?.glibcVersionRuntime ?? ""
  const parts = [
    FORMAT,
    `compiler ${fileHash(nish)}`,
    `flags ${JSON.stringify(flags)}`,
    ...harness.map((f) => `harness ${f} ${fileHash(path.join(root, f))}`),
    `runtime ${treeHash(path.join(root, "runtime"))}`,
    ...["scripts/build.sh", "package.json", "nish-capabilities.lock.json"].map(
      (f) => `${f} ${fileHash(path.join(root, f))}`
    ),
    ...["clang", "ld.lld", "llvm-as", "opt", "wasm-ld"].map((t) => `${t} ${toolVersion(t)}`),
    `node ${process.version} ${process.platform} ${process.arch} ${os.release()} glibc ${glibc}`,
    `cpu ${cpuIdentity()} cores ${os.cpus().length}`,
    `env ${JSON.stringify(vars)}`,
  ]
  return sha(parts.join("\n"))
}

/** Top-level directories of the checkout, which a string naming a file under one points into. */
const topLevelDirs = () =>
  fs
    .readdirSync(root, { withFileTypes: true })
    .filter(
      (e) => e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules" && e.name !== "build"
    )
    .map((e) => e.name)

/**
 * The first path under another top-level directory that a file of the
 * program's directory names, or null: a program that names one may read it
 * at run time, which its key would not see.
 *
 * @param {string} name the program, a directory under tests/link
 * @returns {string | null} the path named, or null
 */
export const namedOutsidePath = (name) => {
  const dir = path.join(root, "tests", "link", name)
  const own = `tests/link/${name}/`
  const tops = topLevelDirs()
  // A quoted string in a source, or a word of `args` (the compiler's own
  // command line): prose in a comment names files too, and is not a read.
  const quoted = new RegExp(`["'](?:\\./)?((?:${tops.join("|")})/[^"'\\s]*)`, "g")
  const word = new RegExp(`(?:^|\\s)(?:\\./)?((?:${tops.join("|")})/\\S*)`, "g")
  for (const f of filesUnder(dir)) {
    if (f.split("/").includes("node_modules")) {
      continue
    }
    const text = fs.readFileSync(path.join(dir, f), "latin1")
    for (const m of text.matchAll(f === "args" ? word : quoted)) {
      const named = m[1].replace(/\/+$/, "")
      if (!`${named}/`.startsWith(own) && fs.existsSync(path.join(root, named))) {
        return named
      }
    }
  }
  return null
}

/**
 * The source files a compile wrote into `outDir` came from, relative to the
 * checkout and sorted, or null when it wrote none or one names a file that is
 * not inside the checkout.
 *
 * @param {string} outDir the compile's output directory
 * @returns {string[] | null} the sources, or null
 */
export const sourcesIn = (outDir) => {
  const modules = fs.existsSync(outDir) ? fs.readdirSync(outDir).filter((f) => f.endsWith(".ll")) : []
  const files = new Set()
  for (const module of modules) {
    const head = Buffer.alloc(4096)
    const fd = fs.openSync(path.join(outDir, module), "r")
    const read = fs.readSync(fd, head, 0, head.length, 0)
    fs.closeSync(fd)
    const named = /^source_filename = "([^"]+)"$/m.exec(head.subarray(0, read).toString("utf8"))
    if (named === null) {
      return null
    }
    const file = path.resolve(root, named[1])
    const rel = path.relative(root, file)
    if (rel.startsWith("..") || path.isAbsolute(rel) || !fs.existsSync(file)) {
      return null
    }
    files.add(rel.split(path.sep).join("/"))
  }
  return files.size > 0 ? [...files].sort() : null
}

/** Whether a record is one to keep: some check, every check passed, nothing logged. */
export const keepable = (record) =>
  Array.isArray(record?.steps) &&
  record.steps.some((s) => s.kind === "check") &&
  record.steps.every((s) => s.kind === "check" && s.ok === true)

/**
 * The results file of one run, read and written by the link-program loop.
 *
 * @param {object} options the run
 * @param {string | null} options.file the results file (`--link-results`), or null for none
 * @param {string} options.base `baseKey` of this run
 * @param {Iterable<string>} [options.never] programs that always run
 * @returns {{
 *   lookup: (name: string) => object | null,
 *   keep: (name: string, record: object, outDir: string) => string | null,
 *   save: () => void,
 *   replayed: string[],
 *   kept: string[],
 *   refused: Map<string, string>,
 * }} the cache: `lookup` gives a kept record or null, `keep` stores a fresh one
 *   (or says why not), and `save` writes every entry of this run
 */
export const openLinkResults = ({ file, base, never = [] }) => {
  const nevers = new Set(never)
  let old = {}
  if (file !== null && fs.existsSync(file)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, "utf8"))
      old =
        parsed?.format === FORMAT && parsed.entries && typeof parsed.entries === "object"
          ? parsed.entries
          : {}
    } catch {
      old = {}
    }
  }
  const fresh = {}
  const replayed = []
  const kept = []
  const refused = new Map()
  const programKey = (name) => sha(`${base}\n${treeHash(path.join(root, "tests", "link", name))}`)
  const stillTrue = (entry) =>
    Object.entries(entry.sources ?? {}).every(([f, h]) => fileHash(path.join(root, f)) === h) &&
    Object.entries(entry.dirs ?? {}).every(([d, h]) => listingHash(path.join(root, d)) === h)
  return {
    lookup: (name) => {
      if (file === null || nevers.has(name)) {
        return null
      }
      const entry = old[name]
      if (!entry || entry.key !== programKey(name) || !keepable(entry.record) || !stillTrue(entry)) {
        return null
      }
      fresh[name] = entry
      replayed.push(name)
      return { ...entry.record, replayed: entry.key.slice(0, 12) }
    },
    keep: (name, record, outDir) => {
      if (file === null) {
        return "no results file"
      }
      const refuse = (reason) => {
        refused.set(name, reason)
        return reason
      }
      if (nevers.has(name)) {
        return refuse("a later section reads its output")
      }
      if (!keepable(record)) {
        return refuse("not every check passed")
      }
      const outside = namedOutsidePath(name)
      if (outside !== null) {
        return refuse(`it names ${outside}, which it may read at run time`)
      }
      const sources = sourcesIn(outDir)
      if (sources === null) {
        return refuse("its compile names no source file inside the checkout")
      }
      fresh[name] = {
        key: programKey(name),
        sources: Object.fromEntries(sources.map((f) => [f, fileHash(path.join(root, f))])),
        dirs: Object.fromEntries(
          [...new Set(sources.map((f) => path.posix.dirname(f)))].map((d) => [
            d,
            listingHash(path.join(root, d)),
          ])
        ),
        record: { steps: record.steps, irDelegated: record.irDelegated === true },
      }
      kept.push(name)
      return null
    },
    save: () => {
      if (file === null) {
        return
      }
      fs.mkdirSync(path.dirname(file), { recursive: true })
      const tmp = `${file}.${process.pid}.tmp`
      fs.writeFileSync(tmp, JSON.stringify({ format: FORMAT, entries: fresh }))
      fs.renameSync(tmp, file)
    },
    replayed,
    kept,
    refused,
  }
}
