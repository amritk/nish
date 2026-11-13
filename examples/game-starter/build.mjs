// Builds the game in this directory into one directory a static server can serve:
//
//   node build.mjs [--out dist] [--nish <compiler>] [--memory 16]
//
// <out>/game.wasm   game.ts with nish/host/game, nish/raster and nish/synth,
//                   linked --profile wasm-host with memory fixed at --memory MiB
// <out>/game.mjs    its generated loader, which startGame finds beside the .wasm
// <out>/game.d.ts   the loader's typings
// <out>/nish/       nish/page/game and the two files it imports, as they ship
// <out>/index.html  the page: one startGame call
//
// The toolchain is the installed `nish` package (`npm install nish`): its
// scripts/build.sh and runtime/ link the module, and the `nish` command in
// node_modules/.bin (or on PATH) compiles it. Inside the nish repository the
// checkout is the package. `--nish` names the compiler instead.
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const fail = (message) => {
  process.stderr.write(`game-starter: ${message}\n`)
  process.exit(1)
}
// The flags, each with one value; anything else is refused, so a misspelt
// flag cannot quietly build into the default directory.
const FLAGS = ["--out", "--nish", "--memory"]
const given = new Map()
for (let i = 2; i < process.argv.length; i += 2) {
  const name = process.argv[i]
  if (!FLAGS.includes(name)) {
    fail(`unknown argument ${name}; the flags are ${FLAGS.join(", ")}`)
  }
  const value = process.argv[i + 1]
  if (value === undefined || value === "" || value.startsWith("--")) {
    fail(`${name} needs a value`)
  }
  given.set(name, value)
}
const flag = (name, fallback) => given.get(name) ?? fallback

/** The installed nish package's directory, found the way `import "nish"` would find it. */
const packageDir = () => {
  for (const from of [process.cwd(), here]) {
    try {
      return path.dirname(createRequire(path.join(from, "noop.js")).resolve("nish/package.json"))
    } catch {
      // Not installed there; try the next place.
    }
  }
  return fail("the nish package is not installed here: run `npm install nish`")
}
const pkg = packageDir()

/** The compiler: --nish, node_modules/.bin/nish above this directory, a checkout's build, or PATH. */
const compiler = () => {
  const named = flag("--nish", undefined)
  if (named !== undefined) {
    return path.resolve(named)
  }
  for (let dir = here; ; dir = path.dirname(dir)) {
    const bin = path.join(dir, "node_modules", ".bin", "nish")
    if (fs.existsSync(bin)) {
      return bin
    }
    if (path.dirname(dir) === dir) {
      break
    }
  }
  const checkout = path.join(pkg, "build", "nish")
  return fs.existsSync(checkout) ? checkout : "nish"
}
const nish = compiler()

const out = path.resolve(flag("--out", path.join(here, "dist")))
const memory = flag("--memory", "16")
const ll = path.join(out, "ll")

// --out is emptied first, so it may only name a directory this script owns:
// the game's own dist/, a directory that does not exist yet or is empty, or one
// an earlier build marked as its own. Never a root, nor one holding this game,
// the package or the working directory.
const MARKER = ".game-starter-build"
const inside = (dir, of) => {
  const rel = path.relative(dir, of)
  return rel === "" || !(rel.startsWith("..") || path.isAbsolute(rel))
}
if (path.dirname(out) === out || inside(out, here) || inside(out, process.cwd()) || inside(out, pkg)) {
  fail(`--out ${out} holds the game, the package or the working directory; name a directory of its own`)
}
if (fs.existsSync(out)) {
  if (!fs.statSync(out).isDirectory()) {
    fail(`--out ${out} is a file; name a directory`)
  }
  const owned = out === path.join(here, "dist") || fs.existsSync(path.join(out, MARKER))
  if (!owned && fs.readdirSync(out).length > 0) {
    fail(`--out ${out} holds files this build did not write; name a new or empty directory`)
  }
}

/** Runs `cmd` in this directory; exits with its output when it fails. */
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { cwd: here, encoding: "utf8" })
  if (r.status !== 0) {
    fail(`${cmd} ${args.join(" ")} failed\n${r.error?.message ?? ""}${r.stdout ?? ""}${r.stderr ?? ""}`)
  }
  return r.stdout
}

// Every output goes first, so a failed step cannot leave an older one to be served.
fs.rmSync(out, { recursive: true, force: true })
fs.mkdirSync(ll, { recursive: true })
fs.mkdirSync(path.join(out, "nish"))
fs.writeFileSync(
  path.join(out, MARKER),
  "written by examples/game-starter/build.mjs; --out may empty this directory\n"
)

// The two commands the guide's "Building" section shows: game.ts and each std
// module it imports to one .ll each (the loader is written beside the .d.ts),
// then a link with the wasm runtime.
run(nish, ["game.ts", "--target", "wasm32", "--emit-dts", path.join(out, "game.d.ts"), "-o", `${ll}/`])
const modules = fs
  .readdirSync(ll)
  .filter((f) => f.endsWith(".ll"))
  .map((f) => path.join(ll, f))
process.stdout.write(
  run("bash", [
    path.join(pkg, "scripts", "build.sh"),
    ...modules,
    path.join(pkg, "runtime", "runtime-wasm.c"),
    "-o",
    path.join(out, "game.wasm"),
    "--profile",
    "wasm-host",
    "--memory",
    memory,
  ])
)
fs.rmSync(ll, { recursive: true })

// The page: nish/page/game with its siblings, and index.html.
for (const file of ["page-game.mjs", "page-frame.mjs", "page.mjs"]) {
  fs.copyFileSync(path.join(pkg, "runtime", file), path.join(out, "nish", file))
}
fs.copyFileSync(path.join(here, "index.html"), path.join(out, "index.html"))
process.stdout.write(`game-starter: ${out}\n`)
