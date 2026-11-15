// Builds the game behind the docs hero terminal into the directory the docs
// site serves at /break/:
//
//   node examples/break-web/build.mjs [--out docs/site/break] [--nish <compiler>] [--memory 32]
//   node examples/break-web/build.mjs --check
//
// <out>/game.wasm      game.ts (the terminal game's director and scenes, with
//                      nish/host/game, nish/raster and nish/synth), linked
//                      --profile wasm-host with memory fixed at --memory MiB
// <out>/game.mjs       its generated loader
// <out>/break.mjs      the page side, which docs/site/site.js imports on demand
// <out>/shell.mjs      what the hero terminal answers, with the compiler's own
//                      --help and --version written in; site.js imports it on
//                      the terminal's first key
// <out>/nish/          nish/page/game and the two files it imports, as they ship
// <out>/manifest.json  a hash of every input and every served file, and the
//                      compiler's version
//
// It also writes examples/break-web/help.ts, the compiler's `--help` in its
// colours as a string, which game.ts hands the director: the help the intro
// breaks apart is the terminal game's, word for word (src/break.ts passes
// `helpText(new Style(true, true), "")`, and std/cli cannot be imported
// under --deterministic).
//
// The compiler is asked as a user would see it, whoever builds: with
// NISH_AGENT=0 (no agent's section, so no path on this machine) and the
// colour pinned (NO_COLOR for the shell, FORCE_COLOR for the game).
//
// The output is committed, so the docs site needs no compiler. `--check`
// builds nothing: it hashes the inputs again and fails, naming each one that
// changed since the committed build, so a change to the game's code that
// forgot to rebuild is caught; the compiler's `--help` and `--version` are
// asked again, so a page that answers differently from the CLI is too; and
// every served file is hashed against the manifest, so an edited or
// half-written output is refused. A known limit: a compiler whose code
// generation changed under the same version string is not caught, since
// --check compiles nothing.
import { createHash } from "node:crypto"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, "..", "..")
const fail = (message) => {
  process.stderr.write(`break-web: ${message}\n`)
  process.exit(1)
}
// The flags, and --check; anything else is refused, so a misspelt flag cannot
// quietly build with a default.
const FLAGS = ["--out", "--nish", "--memory"]
for (let i = 2; i < process.argv.length; i += 1) {
  const name = process.argv[i]
  if (FLAGS.includes(name)) {
    i += 1
  } else if (name !== "--check") {
    fail(`unknown argument ${name}; the flags are ${FLAGS.join(", ")} and --check`)
  }
}
const flag = (name, fallback) => {
  const at = process.argv.indexOf(name)
  if (at < 0) {
    return fallback
  }
  const value = process.argv[at + 1]
  if (value === undefined || value === "" || value.startsWith("--")) {
    fail(`${name} needs a value`)
  }
  return value
}

const named = flag("--nish", undefined)
const nish = named === undefined ? path.join(root, "build", "nish") : path.resolve(named)
const out = path.resolve(flag("--out", path.join(root, "docs", "site", "break")))
const memory = flag("--memory", "32")
const checking = process.argv.includes("--check")
const MANIFEST = "manifest.json"

// ---- the inputs -------------------------------------------------------------

/** The runtime files the page needs, as they ship in the package. */
const PAGE = ["page-game.mjs", "page-frame.mjs", "page.mjs"]

/** What a build serves: the module, its loader, the page and the shell, and PAGE under nish/. */
const SERVED = ["game.wasm", "game.mjs", "break.mjs", "shell.mjs", ...PAGE.map((f) => `nish/${f}`)]

/**
 * Every source the module is built from: game.ts and each file it imports,
 * followed through relative and `nish/…` (std/) specifiers. `nish:` modules
 * are the compiler's own and move with its version.
 */
const sources = () => {
  const seen = new Map()
  const visit = (file) => {
    if (seen.has(file)) {
      return
    }
    if (!fs.existsSync(file)) {
      fail(`${path.relative(root, file)} is imported but does not exist`)
    }
    const text = fs.readFileSync(file, "utf8")
    seen.set(file, text)
    for (const [, spec] of text.matchAll(/\bfrom\s+"([^"]+)"/g)) {
      if (spec.startsWith("nish/")) {
        visit(path.join(root, "std", `${spec.slice("nish/".length)}.ts`))
      } else if (spec.startsWith(".")) {
        visit(path.resolve(path.dirname(file), spec.endsWith(".ts") ? spec : `${spec}.ts`))
      }
    }
  }
  visit(path.join(here, "game.ts"))
  return seen
}

/** `file` as the manifest names it: relative to the repository, with forward slashes. */
const key = (file) => path.relative(root, file).split(path.sep).join("/")

/** The inputs, relative to the repository, each with its hash, in a stable order. */
const inputs = () => {
  const read = sources()
  const files = [
    ...read.keys(),
    path.join(here, "break.mjs"),
    path.join(here, "build.mjs"),
    path.join(here, "shell.mjs"),
    path.join(root, "runtime", "runtime-wasm.c"),
    path.join(root, "scripts", "build.sh"),
    ...PAGE.map((f) => path.join(root, "runtime", f)),
  ]
  const hashes = {}
  for (const file of files.sort((a, b) => (key(a) < key(b) ? -1 : 1))) {
    hashes[key(file)] = createHash("sha256")
      .update(read.get(file) ?? fs.readFileSync(file))
      .digest("hex")
  }
  return hashes
}

/**
 * The environment the compiler is asked in: as a person at a terminal sees
 * it, not an agent (whose help names this machine's docs/AI.md), with `colour`
 * deciding the escapes.
 */
const asked = (colour) => {
  const env = { ...process.env, NISH_AGENT: "0" }
  for (const name of ["CLAUDECODE", "GEMINI_CLI", "NO_COLOR", "FORCE_COLOR", "CLICOLOR_FORCE"]) {
    delete env[name]
  }
  return colour ? { ...env, FORCE_COLOR: "1" } : { ...env, NO_COLOR: "1" }
}

/** What the compiler prints on stdout for `option`, without its last newline; in colour when `colour`. */
const ask = (option, colour = false) => {
  const r = spawnSync(nish, [option], { encoding: "utf8", env: asked(colour) })
  if (r.status !== 0) {
    fail(
      `${nish} ${option} failed: build the compiler (npm run build) or pass --nish\n${r.error?.message ?? ""}${r.stderr ?? ""}`
    )
  }
  return r.stdout.replace(/\n$/, "")
}

/**
 * The paths of the machine that builds: the repository, the working directory
 * and the home directory, less any so short (a root, a home of "/") that any
 * text would hold it.
 */
const LOCAL = [root, process.cwd(), os.homedir()].filter((p) => p.length > 1 && path.parse(p).root !== p)

/**
 * The start of a path on any machine, whoever built it: a home or temporary
 * directory on Linux or macOS, a Windows drive, or a file URL. --check runs on
 * another machine than the build, so LOCAL alone would miss the builder's.
 */
const ANY_PATH = /\/home\/|\/Users\/|\/root\/|\/tmp\/|\b[A-Za-z]:\\|file:\/\//

/** The first of LOCAL, docs/AI.md or ANY_PATH that `text` names; null when none. */
const localPath = (text) =>
  [...LOCAL, "docs/AI.md"].find((p) => text.includes(p)) ?? ANY_PATH.exec(text)?.[0] ?? null

/** The compiler's `--help`; a page must not show or hash a path on the machine that built it. */
const askHelp = (colour) => {
  const text = ask("--help", colour)
  if (localPath(text) !== null) {
    fail(`${nish} --help names ${localPath(text)} under NISH_AGENT=0; build.mjs must not publish it`)
  }
  return text
}

/** The served module, loader and shell that name a path, each with the path. */
const leaks = () =>
  ["game.wasm", "game.mjs", "shell.mjs"]
    .map((name) => path.join(out, name))
    .filter((file) => fs.existsSync(file))
    .map((file) => [file, localPath(fs.readFileSync(file, "latin1"))])
    .filter(([, found]) => found !== null)
    .map(([file, found]) => `${path.relative(root, file)} (names ${found})`)

/** Every file under --out, relative to it, with "/" between its parts. */
const builtFiles = (dir = out, under = "") =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const name = `${under}${entry.name}`
    return entry.isDirectory() ? builtFiles(path.join(dir, entry.name), `${name}/`) : [name]
  })

const sha256 = (text) => createHash("sha256").update(text).digest("hex")

/** game.ts's import of the coloured help: generated, committed, and compared by --check. */
const HELP_TS = path.join(here, "help.ts")
const helpModule = (coloured) =>
  `// Generated by build.mjs: the compiler's --help in its colours, for the help\n// the game's intro breaks apart. Do not edit; rebuild.\nexport const BREAK_HELP: string =\n  ${JSON.stringify(coloured)}\n`

/** The shell's two answers, as build.mjs writes them over its empty ones. */
const shellHelp = (text) => `export const HELP = ${JSON.stringify(text)}`
const shellVersion = (text) => `export const VERSION = ${JSON.stringify(text)}`

/** Each served file's hash, in SERVED's order. */
const outputs = () =>
  Object.fromEntries(SERVED.map((name) => [name, sha256(fs.readFileSync(path.join(out, name)))]))

/** The record --check compares: the compiler's answers, the memory, and every input's hash. */
const manifest = (helpText) => ({
  compiler: ask("--version"),
  help: sha256(helpText),
  memory,
  inputs: inputs(),
})

// ---- --check ----------------------------------------------------------------

if (checking) {
  const file = path.join(out, MANIFEST)
  if (!fs.existsSync(file)) {
    fail(`${path.relative(root, file)} is missing: run node examples/break-web/build.mjs`)
  }
  const was = JSON.parse(fs.readFileSync(file, "utf8"))
  const help = askHelp(false)
  const now = manifest(help)
  const changed = []
  if (!fs.existsSync(HELP_TS) || fs.readFileSync(HELP_TS, "utf8") !== helpModule(askHelp(true))) {
    changed.push(`${key(HELP_TS)} (not the compiler's coloured --help)`)
  }
  if (was.compiler !== now.compiler) {
    changed.push(`the compiler (${was.compiler} → ${now.compiler})`)
  }
  if (was.help !== now.help) {
    changed.push("the compiler's --help")
  }
  if (was.memory !== now.memory) {
    changed.push(`--memory (${was.memory} → ${now.memory})`)
  }
  for (const name of new Set([...Object.keys(was.inputs ?? {}), ...Object.keys(now.inputs)])) {
    if (was.inputs?.[name] !== now.inputs[name]) {
      let why = ""
      if (!(name in now.inputs)) {
        why = " (gone)"
      } else if (!(name in (was.inputs ?? {}))) {
        why = " (new)"
      }
      changed.push(`${name}${why}`)
    }
  }
  for (const name of SERVED) {
    const served = path.join(out, name)
    if (!fs.existsSync(served)) {
      changed.push(`${path.relative(root, served)} (missing from the build)`)
    } else if (was.outputs?.[name] !== sha256(fs.readFileSync(served))) {
      changed.push(`${path.relative(root, served)} (not the file this build wrote)`)
    }
  }
  for (const name of builtFiles()) {
    if (name !== MANIFEST && !SERVED.includes(name)) {
      changed.push(`${path.relative(root, path.join(out, name))} (not a file this build writes)`)
    }
  }
  changed.push(...leaks())
  // The shell answers as the compiler does now, not only as it did when built.
  const shellFile = path.join(out, "shell.mjs")
  if (fs.existsSync(shellFile)) {
    const built = fs.readFileSync(shellFile, "utf8")
    if (!built.includes(shellHelp(help)) || !built.includes(shellVersion(now.compiler))) {
      changed.push(`${path.relative(root, shellFile)} (its --help or --version is not the compiler's)`)
    }
  }
  if (changed.length > 0) {
    fail(
      `the committed build is stale; rebuild with node examples/break-web/build.mjs. Changed since it was built:\n  ${changed.join("\n  ")}`
    )
  }
  process.stdout.write(`break-web: ${path.relative(root, out) || out} is up to date\n`)
  process.exit(0)
}

// ---- the build --------------------------------------------------------------

// --out is emptied first, so it may only name a directory this script owns:
// not a root, not one holding this game, the repository or the working
// directory, and not one holding anything an earlier build did not write.
const inside = (dir, of) => {
  const rel = path.relative(dir, of)
  return rel === "" || !(rel.startsWith("..") || path.isAbsolute(rel))
}
if (path.dirname(out) === out || inside(out, here) || inside(out, process.cwd()) || inside(out, root)) {
  fail(`--out ${out} holds the game, the repository or the working directory; name a directory of its own`)
}
// The top-level names a build leaves, and those it writes and removes.
const written = new Set([
  ...SERVED.map((name) => name.split("/")[0]),
  "game.wasm.sites.json",
  "game.d.ts",
  "ll",
  MANIFEST,
])
if (fs.existsSync(out) && !fs.readdirSync(out).every((name) => written.has(name))) {
  fail(`--out ${out} holds files this build did not write; name a new directory`)
}

/** Runs `cmd` in this directory; exits with its output when it fails. */
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { cwd: here, encoding: "utf8" })
  if (r.status !== 0) {
    fail(`${cmd} ${args.join(" ")} failed\n${r.error?.message ?? ""}${r.stdout ?? ""}${r.stderr ?? ""}`)
  }
  return r.stdout
}

// The source imports nish/page/game from the runtime; the copy, from beside it.
const PAGE_FROM = '"../../runtime/page-game.mjs"'
const page = fs.readFileSync(path.join(here, "break.mjs"), "utf8")
if (!page.includes(PAGE_FROM)) {
  fail(`break.mjs no longer imports ${PAGE_FROM}; update build.mjs to match`)
}

// The shell's two answers the compiler gives, written over its empty ones.
const SHELL_HELP = shellHelp("")
const SHELL_VERSION = shellVersion("")
const shell = fs.readFileSync(path.join(here, "shell.mjs"), "utf8")
if (!shell.includes(SHELL_HELP) || !shell.includes(SHELL_VERSION)) {
  fail(`shell.mjs no longer holds ${SHELL_HELP} and ${SHELL_VERSION}; update build.mjs to match`)
}

const help = askHelp(false)
// help.ts first: game.ts imports it, and the manifest hashes it as an input.
const helpTs = helpModule(askHelp(true))
if (!fs.existsSync(HELP_TS) || fs.readFileSync(HELP_TS, "utf8") !== helpTs) {
  fs.writeFileSync(HELP_TS, helpTs)
}
const record = manifest(help)
const ll = path.join(out, "ll")
// Every output goes first, so a failed step cannot leave an older one to be served.
fs.rmSync(out, { recursive: true, force: true })
fs.mkdirSync(ll, { recursive: true })
fs.mkdirSync(path.join(out, "nish"))

run(nish, [
  "game.ts",
  "--target",
  "wasm32",
  "--deterministic",
  "--emit-dts",
  path.join(out, "game.d.ts"),
  "-o",
  `${ll}/`,
])
const modules = fs
  .readdirSync(ll)
  .filter((f) => f.endsWith(".ll"))
  .map((f) => path.join(ll, f))
process.stdout.write(
  run("bash", [
    path.join(root, "scripts", "build.sh"),
    ...modules,
    path.join(root, "runtime", "runtime-wasm.c"),
    "-o",
    path.join(out, "game.wasm"),
    "--profile",
    "wasm-host",
    "--memory",
    memory,
  ])
)
// Only the module, its loader and the page are served.
for (const name of ["ll", "game.d.ts", "game.wasm.sites.json"]) {
  fs.rmSync(path.join(out, name), { recursive: true, force: true })
}
for (const file of PAGE) {
  fs.copyFileSync(path.join(root, "runtime", file), path.join(out, "nish", file))
}
fs.writeFileSync(path.join(out, "break.mjs"), page.replace(PAGE_FROM, '"./nish/page-game.mjs"'))
fs.writeFileSync(
  path.join(out, "shell.mjs"),
  shell.replace(SHELL_HELP, () => shellHelp(help)).replace(SHELL_VERSION, () => shellVersion(record.compiler))
)
if (leaks().length > 0) {
  fail(
    `the build names a path of this machine; nothing it holds may be published:\n  ${leaks().join("\n  ")}`
  )
}
fs.writeFileSync(path.join(out, MANIFEST), `${JSON.stringify({ ...record, outputs: outputs() }, null, 2)}\n`)
process.stdout.write(`break-web: ${out}\n`)
