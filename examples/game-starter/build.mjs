// Builds examples/game-starter into one directory a static server can serve:
//
//   node examples/game-starter/build.mjs [--nish build/nish] [--out build/game-starter] [--memory 16]
//
// <out>/game.wasm   game.ts with nish/host/game, nish/raster and nish/synth,
//                   linked --profile wasm-host with memory fixed at --memory MiB
// <out>/game.mjs    its generated loader, which startGame finds beside the .wasm
// <out>/game.d.ts   the loader's typings
// <out>/nish/       nish/page/game and the two files it imports, as they ship
// <out>/index.html  the page: one startGame call
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, "../..")
const flag = (name, fallback) => {
  const at = process.argv.indexOf(name)
  return at < 0 ? fallback : process.argv[at + 1]
}
const nish = path.resolve(root, flag("--nish", "build/nish"))
const out = path.resolve(root, flag("--out", "build/game-starter"))
const memory = flag("--memory", "16")
const ll = path.join(out, "ll")

/** Runs `cmd` from the repository's root; exits with its output when it fails. */
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { cwd: root, encoding: "utf8" })
  if (r.status !== 0) {
    process.stderr.write(`game-starter: ${cmd} ${args.join(" ")} failed\n${r.stdout}${r.stderr}`)
    process.exit(1)
  }
  return r.stdout
}

// Every output goes first, so a failed step cannot leave an older one to be served.
fs.rmSync(out, { recursive: true, force: true })
fs.mkdirSync(ll, { recursive: true })
fs.mkdirSync(path.join(out, "nish"))

// The game: game.ts and each std module it imports, one .ll each; the loader
// is written beside the .d.ts.
run(nish, [
  path.relative(root, path.join(here, "game.ts")),
  "--target",
  "wasm32",
  "--emit-dts",
  path.join(out, "game.d.ts"),
  "-o",
  `${ll}/`,
])
// nish/term (which nish/host/game reads input through) calls
// nish_arena_keep, which runtime/runtime-wasm.c does not define yet. Keeping
// the value where it is, reclaiming nothing, is the answer the native runtime
// gives whenever its guards refuse, so it is always correct.
const keep = path.join(ll, "arena-keep.c")
fs.writeFileSync(
  keep,
  "#include <stdint.h>\nvoid *nish_arena_keep(uint64_t mark, void *p) { (void)mark; return p; }\n"
)
const modules = fs
  .readdirSync(ll)
  .filter((f) => f.endsWith(".ll"))
  .map((f) => path.join(ll, f))
process.stdout.write(
  run("bash", [
    "scripts/build.sh",
    ...modules,
    "runtime/runtime-wasm.c",
    keep,
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
  fs.copyFileSync(path.join(root, "runtime", file), path.join(out, "nish", file))
}
fs.copyFileSync(path.join(here, "index.html"), path.join(out, "index.html"))
process.stdout.write(`game-starter: ${out}\n`)
