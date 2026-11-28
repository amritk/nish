/**
 * The tests/link programs' results, kept between runs by what each one reads.
 *
 *   import { openLinkResults } from "./link-results.js"
 *   node tests/run.js --link-results build/cache/link-results/shard-3.json --shard 3/9
 *
 * A link program is a compile, a link, a run and the checks on what they
 * wrote; it reads the compiler under test, std/, the runtime and the link
 * recipe, its own directory and the tests/link directories it imports, the
 * toolchain, and the harness that runs it. When none of those changed since a
 * run in which every one of its checks passed, the same checks pass again, so
 * a pull request's second push, or a first push that leaves a program's
 * inputs as `main` had them, replays that run's record instead of building
 * the program again. The `test` job keeps the file in the Actions cache, per
 * shard (`docs/wp10-ci.md`, "Link-program results across runs"); the push to
 * main and the release never read it.
 *
 * **What the key covers** (`baseKey`, then each program's own):
 *
 *   - the compiler under test, byte for byte, and the suite's flags other
 *     than the ones that only place work (`--shard`, `--jobs`, `--seed`,
 *     `--link-results`): the seed is in the binary already;
 *   - the harness: tests/run.js and every file it imports, followed through
 *     relative imports, so any edit to the suite's code is a new key;
 *   - every file under std/ and runtime/, scripts/build.sh, package.json and
 *     nish-capabilities.lock.json. All of std/, not the modules a compile
 *     writes: a library of generics writes no `.ll` of its own
 *     (`std/collections.ts`), so no output names it;
 *   - the toolchain and the tools a run drives, by `--version`; Node's version,
 *     the platform, the architecture, the kernel release, glibc, the CPU's
 *     model and feature flags (a kernel path the runtime picks at run time),
 *     the core count; and the variables a build or a run reads (`ENV_KEYS`,
 *     and every `NISH_*`);
 *   - the program's directory and every tests/link directory it imports by a
 *     relative path, followed transitively, each whole by content.
 *
 * **What is never kept**, so always run: a record with a failed check, or no
 * check, or a log line (an `--update` run writes goldens); a program a later
 * section reads the output of (`never`, `LINK_READ_LATER` in tests/run.js);
 * a program that wrote no module (a rejection); a program whose compile names
 * a source outside std/ and its directories, or whose relative imports leave
 * them; and a program any file of whose directory names a path of the
 * checkout outside them in a string (`"tests/json-suite/..."`,
 * `` `runtime/${f}` ``, `"../../README.md"`) or a word of `args`: such a
 * program can read that file at run time, which no compile names. A path
 * built at run time from pieces is the one read this cannot find.
 *
 * **Age.** A record replays for `MAX_AGE_MS` after the run that built it,
 * and a replay carries that time forward unchanged, so the clock (a
 * certificate's validity, a date in a golden) is checked at least that
 * often. The push to main, which never replays, builds every program in full.
 */
import crypto from "node:crypto"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

/** Bumped when what the key covers changes, so an older file is never read as this one. */
export const FORMAT = "link-results 2"

/** The suite's flags that only place work, each with the value after it. */
export const PLACING_FLAGS = ["--shard", "--jobs", "--seed", "--link-results"]

/** How long a record replays after the run that built it: a week. */
export const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

/** The variables besides `NISH_*` a build or a program's run reads, by name. */
export const ENV_KEYS = [
  "CC",
  "CFLAGS",
  "LDFLAGS",
  "WASI_SYSROOT",
  "HOME",
  "XDG_CONFIG_HOME",
  "XDG_DATA_HOME",
  "XDG_CACHE_HOME",
  "TMPDIR",
  "TZ",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "TERM",
  "COLUMNS",
  "LINES",
  "NO_COLOR",
  "FORCE_COLOR",
  "PATH",
  "LD_LIBRARY_PATH",
  "LD_PRELOAD",
  "SSL_CERT_FILE",
  "SSL_CERT_DIR",
]

/** The tools a link program's build or checks run, whose version is part of the key. */
export const TOOLS = [
  "clang",
  "ld.lld",
  "llvm-as",
  "opt",
  "wasm-ld",
  "openssl",
  "curl",
  "python3",
  "valgrind",
]

/** The root-level entries no program names as an input: generated, or not the project's. */
const NOT_INPUTS = new Set(["node_modules", "build", ".git"])

/** What the base key holds whole, so a program may name it. */
export const BASE_INPUTS = [
  "std",
  "runtime",
  "scripts/build.sh",
  "package.json",
  "nish-capabilities.lock.json",
]

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

/** `rel` under `dir`, as a path relative to the checkout, or null when it leaves the checkout. */
const within = (top, rel) => {
  const r = path.relative(top, rel).split(path.sep).join("/")
  return r.startsWith("..") || path.isAbsolute(r) ? null : r
}

/**
 * `file` and every file it imports by a relative path, followed transitively:
 * the harness a link program's checks are written in.
 *
 * @param {string} file a path relative to the checkout
 * @param {Set<string>} [seen] the files found so far
 * @param {string} [top] the checkout
 * @returns {Set<string>} the closure, relative to the checkout
 */
export const harnessFiles = (file, seen = new Set(), top = repoRoot) => {
  if (seen.has(file) || !fs.existsSync(path.join(top, file))) {
    return seen
  }
  seen.add(file)
  const text = fs.readFileSync(path.join(top, file), "utf8")
  for (const m of text.matchAll(/^(?:import|export) [^"]*?from "(\.\.?\/[^"]+)"/gm)) {
    harnessFiles(path.posix.normalize(path.posix.join(path.posix.dirname(file), m[1])), seen, top)
  }
  return seen
}

const harnessMemo = new Map()

/** `harnessFiles("tests/run.js")` for a checkout, read once per run. */
const harnessOf = (top) => {
  if (!harnessMemo.has(top)) {
    harnessMemo.set(top, [...harnessFiles("tests/run.js", new Set(), top)])
  }
  return harnessMemo.get(top)
}

/** `<tool> --version`, or that it is not there. */
const toolVersion = (tool) => {
  const ran = spawnSync(tool, ["--version"], { encoding: "utf8" })
  return ran.status === 0 ? `${ran.stdout}${ran.stderr}` : `${tool}: not runnable`
}

/**
 * The machine a program builds and runs on: the tools' versions, Node, the
 * kernel, glibc, the CPU's model and feature flags, and the core count.
 *
 * @returns {string} one line per fact
 */
export const machineIdentity = () => {
  const cpuinfo = fs.existsSync("/proc/cpuinfo") ? fs.readFileSync("/proc/cpuinfo", "utf8") : ""
  const field = (name) => new RegExp(`^${name}\\s*:\\s*(.*)$`, "m").exec(cpuinfo)?.[1] ?? ""
  const glibc = process.report?.getReport?.().header?.glibcVersionRuntime ?? ""
  return [
    ...TOOLS.map((t) => `${t} ${toolVersion(t)}`),
    `node ${process.version} ${process.platform} ${process.arch} ${os.release()} glibc ${glibc}`,
    `cpu ${field("model name")}|${field("flags") || field("Features")}|${os.cpus()[0]?.model ?? ""} cores ${os.cpus().length}`,
  ].join("\n")
}

/**
 * What every program of this run shares: the compiler, the harness, std/,
 * the link's own inputs, the machine, the environment and the flags.
 *
 * @param {object} run the run
 * @param {string} run.nish the compiler under test
 * @param {string[]} run.argv the suite's arguments after `node tests/run.js`
 * @param {NodeJS.ProcessEnv} [run.env] the environment the programs inherit
 * @param {string} [run.machine] `machineIdentity()`, which a check replaces
 * @param {string} [run.top] the checkout, which a check replaces
 * @returns {string} the key, hex
 */
export const baseKey = ({ nish, argv, env = process.env, machine, top = repoRoot }) => {
  const flags = []
  for (let i = 0; i < argv.length; i++) {
    if (PLACING_FLAGS.includes(argv[i])) {
      i++
    } else {
      flags.push(argv[i])
    }
  }
  const harness = [...harnessFiles("tests/run.js", new Set(), top)].sort()
  const vars = Object.keys(env)
    .filter((k) => k.startsWith("NISH_") || ENV_KEYS.includes(k))
    .sort()
    .map((k) => `${k}=${env[k]}`)
  const parts = [
    FORMAT,
    `compiler ${fileHash(nish)}`,
    `flags ${JSON.stringify(flags)}`,
    ...harness.map((f) => `harness ${f} ${fileHash(path.join(top, f))}`),
    `std ${treeHash(path.join(top, "std"))}`,
    `runtime ${treeHash(path.join(top, "runtime"))}`,
    ...["scripts/build.sh", "package.json", "nish-capabilities.lock.json"].map(
      (f) => `${f} ${fileHash(path.join(top, f))}`
    ),
    machine ?? machineIdentity(),
    `env ${JSON.stringify(vars)}`,
  ]
  return sha(parts.join("\n"))
}

/** A text file of a program's directory, other than what its packages hold. */
const ownFiles = (top, dir) =>
  filesUnder(path.join(top, dir)).filter((f) => !f.split("/").includes("node_modules"))

/**
 * The tests/link directories a program is built from: its own, and each one
 * a relative import reaches from it, transitively. A relative import that
 * leaves tests/link for anywhere but std/ (which the base key holds whole) is
 * a refusal: the file it reaches is in no key.
 *
 * @param {string} name the program, a directory under tests/link
 * @param {string} [top] the checkout
 * @returns {{dirs: string[], refusal: string | null}} the directories, relative to the checkout, or why not
 */
export const linkDirsOf = (name, top = repoRoot) => {
  const dirs = new Set()
  const todo = [`tests/link/${name}`]
  const importRe = /(?:\bfrom|\bimport)\s*\(?\s*["'](\.{1,2}\/[^"']+)["']/g
  while (todo.length > 0) {
    const dir = todo.pop()
    if (dirs.has(dir)) {
      continue
    }
    dirs.add(dir)
    for (const f of ownFiles(top, dir).filter((file) => /\.(m?ts|m?js)$/.test(file))) {
      const text = fs.readFileSync(path.join(top, dir, f), "utf8")
      for (const m of text.matchAll(importRe)) {
        const target = within(top, path.resolve(top, dir, path.dirname(f), m[1]))
        if (target === null) {
          return { dirs: [], refusal: `it imports ${m[1]}, outside the checkout` }
        }
        const parts = target.split("/")
        if (parts[0] === "tests" && parts[1] === "link" && parts.length > 3) {
          todo.push(`tests/link/${parts[2]}`)
        } else if (parts[0] !== "std") {
          return { dirs: [], refusal: `it imports ${target}, outside tests/link and std/` }
        }
      }
    }
  }
  return { dirs: [...dirs].sort(), refusal: null }
}

/**
 * The first path of the checkout outside a program's directories, the
 * harness and `BASE_INPUTS` that a file of its own directory names, or null: a program that names one may read it
 * at run time, which its key would not see. A string in a source names one
 * when it starts with a root-level entry of the checkout, or with `../` and
 * is not an import specifier; a word of `args` names one when it starts with
 * a root-level entry.
 *
 * @param {string} name the program, a directory under tests/link
 * @param {string[]} [dirs] the program's directories (`linkDirsOf`)
 * @param {string} [top] the checkout
 * @returns {string | null} the path named, or null
 */
export const namedOutsidePath = (name, dirs = [`tests/link/${name}`], top = repoRoot) => {
  const own = `tests/link/${name}`
  const entries = fs
    .readdirSync(top)
    .filter((e) => !NOT_INPUTS.has(e))
    .map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  const rooted = `(?:\\./)?((?:${entries.join("|")})(?:/[^"'\`\\s]*)?)`
  const quoted = new RegExp(`["'\`]${rooted}["'\`/$]`, "g")
  const relative = /(\bfrom\s*|\bimport\s*\(?\s*)?["'`](\.\.\/[^"'`\s]*)/g
  const word = new RegExp(`(?:^|\\s)${rooted}(?=\\s|$)`, "g")
  const covered = [...dirs, ...BASE_INPUTS, ...harnessOf(top)]
  const outside = (rel) => !covered.some((d) => rel === d || rel.startsWith(`${d}/`))
  for (const f of ownFiles(top, own)) {
    const text = fs.readFileSync(path.join(top, own, f), "latin1")
    const found =
      f === "args"
        ? [...text.matchAll(word)].map((m) => m[1])
        : [
            ...[...text.matchAll(quoted)].map((m) => m[1]),
            ...[...text.matchAll(relative)]
              .filter((m) => m[1] === undefined)
              .map((m) => within(top, path.resolve(top, own, path.dirname(f), m[2]))),
          ]
    for (const named of found) {
      if (named === null) {
        return `${own}/${f}: a relative path outside the checkout`
      }
      // A template literal names the directory its first `${` is in.
      const rel = named.split("${")[0].replace(/\/+$/, "")
      if (rel !== "" && outside(rel) && fs.existsSync(path.join(top, rel))) {
        return rel
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
 * @param {string} [top] the checkout
 * @returns {string[] | null} the sources, or null
 */
export const sourcesIn = (outDir, top = repoRoot) => {
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
    const rel = within(top, path.resolve(top, named[1]))
    if (rel === null || !fs.existsSync(path.join(top, rel))) {
      return null
    }
    files.add(rel)
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
 * @param {() => number} [options.now] the clock, which a check replaces
 * @param {string} [options.top] the checkout, which a check replaces
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
export const openLinkResults = ({ file, base, never = [], now = Date.now, top = repoRoot }) => {
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
  /** The program's key, or null when its directories cannot be told. */
  const programKey = (name) => {
    const { dirs, refusal } = linkDirsOf(name, top)
    return refusal !== null
      ? null
      : sha([base, ...dirs.map((d) => `${d} ${treeHash(path.join(top, d))}`)].join("\n"))
  }
  return {
    lookup: (name) => {
      if (file === null || nevers.has(name)) {
        return null
      }
      const entry = old[name]
      const age = now() - Number(entry?.built)
      if (!entry || !(age >= 0 && age <= MAX_AGE_MS) || !keepable(entry.record)) {
        return null
      }
      const key = programKey(name)
      if (key === null || entry.key !== key) {
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
      const { dirs, refusal } = linkDirsOf(name, top)
      if (refusal !== null) {
        return refuse(refusal)
      }
      const named = namedOutsidePath(name, dirs, top)
      if (named !== null) {
        return refuse(`it names ${named}, which it may read at run time`)
      }
      const sources = sourcesIn(outDir, top)
      if (sources === null) {
        return refuse("its compile names no source file inside the checkout")
      }
      const unkeyed = sources.find((f) => !f.startsWith("std/") && !dirs.some((d) => f.startsWith(`${d}/`)))
      if (unkeyed !== undefined) {
        return refuse(`its compile reads ${unkeyed}, which no key holds`)
      }
      fresh[name] = {
        key: programKey(name),
        built: now(),
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
