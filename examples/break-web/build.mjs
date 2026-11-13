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
// <out>/manifest.json  a hash of every input and the compiler's version
//
// The output is committed, so the docs site needs no compiler. `--check`
// builds nothing: it hashes the inputs again and fails, naming each one that
// changed since the committed build, so a change to the game's code that
// forgot to rebuild is caught; and the compiler's `--help` and `--version`
// are asked again, so a page that answers differently from the CLI is too.
import { createHash } from "node:crypto"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
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

/** What the compiler prints on stdout for `option`, without its last newline. */
const ask = (option) => {
  const r = spawnSync(nish, [option], { encoding: "utf8" })
  if (r.status !== 0) {
    fail(
      `${nish} ${option} failed: build the compiler (npm run build) or pass --nish\n${r.error?.message ?? ""}${r.stderr ?? ""}`
    )
  }
  return r.stdout.replace(/\n$/, "")
}

/** Where the compiler found docs/AI.md: this machine's path, which a page must not show or hash. */
const GUIDE_PATH = /\S*\/docs\/AI\.md$/m

/** The compiler's `--help`, with its guide named as the package names it rather than by this checkout's path. */
const askHelp = () => ask("--help").replace(GUIDE_PATH, "docs/AI.md in the nish package")

const sha256 = (text) => createHash("sha256").update(text).digest("hex")

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
  const now = manifest(askHelp())
  const changed = []
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
    if (!fs.existsSync(path.join(out, name))) {
      changed.push(`${path.relative(root, path.join(out, name))} (missing from the build)`)
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
const SHELL_HELP = 'export const HELP = ""'
const SHELL_VERSION = 'export const VERSION = ""'
const shell = fs.readFileSync(path.join(here, "shell.mjs"), "utf8")
if (!shell.includes(SHELL_HELP) || !shell.includes(SHELL_VERSION)) {
  fail(`shell.mjs no longer holds ${SHELL_HELP} and ${SHELL_VERSION}; update build.mjs to match`)
}

const help = askHelp()
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
  shell
    .replace(SHELL_HELP, () => `export const HELP = ${JSON.stringify(help)}`)
    .replace(SHELL_VERSION, () => `export const VERSION = ${JSON.stringify(record.compiler)}`)
)
fs.writeFileSync(path.join(out, MANIFEST), `${JSON.stringify(record, null, 2)}\n`)
process.stdout.write(`break-web: ${out}\n`)
