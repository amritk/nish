// Builds examples/wasm-arena into one directory a static server can serve, and
// the native replay beside it:
//
//   node examples/wasm-arena/build.mjs [--nish build/nish] [--out build/arena] [--memory 4]
//
// <out>/web/   client.wasm (--profile wasm-host, memory fixed at --memory MiB),
//              its loader client.mjs and typings client.d.ts, page.js and host.js (page.ts and host.ts
//              with their types stripped), nish-page.mjs (runtime/page.mjs),
//              index.html
// <out>/replay sim.ts and replay.ts compiled natively with --deterministic
//
// The page needs no bundler and no import map: the three bare or extensionless
// imports page.ts makes are rewritten to the files written beside it.
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import { stripTypeScriptTypes } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, "../..")
const flag = (name, fallback) => {
  const at = process.argv.indexOf(name)
  return at < 0 ? fallback : process.argv[at + 1]
}
const nish = path.resolve(root, flag("--nish", "build/nish"))
const out = path.resolve(root, flag("--out", "build/arena"))
const memory = flag("--memory", "4")
const web = path.join(out, "web")
const ll = path.join(out, "ll")

/** Runs `cmd` from the repository's root; exits with its output when it fails. */
const run = (cmd, args, env) => {
  const r = spawnSync(cmd, args, { cwd: root, encoding: "utf8", env: { ...process.env, ...env } })
  if (r.status !== 0) {
    process.stderr.write(`wasm-arena: ${cmd} ${args.join(" ")} failed\n${r.stdout}${r.stderr}`)
    process.exit(1)
  }
  return r.stdout
}

fs.rmSync(ll, { recursive: true, force: true })
fs.rmSync(web, { recursive: true, force: true })
fs.mkdirSync(web, { recursive: true })
fs.mkdirSync(ll, { recursive: true })

// The page module: client.ts, with sim.ts and nish/host/ring, one .ll each.
run(nish, [
  "examples/wasm-arena/client.ts",
  "--target",
  "wasm32",
  "--host",
  "examples/wasm-arena/host.ts",
  "--emit-dts",
  path.join(web, "client.d.ts"),
  "-o",
  `${ll}/`,
])
const modules = fs
  .readdirSync(ll)
  .filter((f) => f.endsWith(".ll"))
  .map((f) => path.join(ll, f))
const wasm = path.join(web, "client.wasm")
process.stdout.write(
  run("bash", ["scripts/build.sh", ...modules, "-o", wasm, "--profile", "wasm-host", "--memory", memory])
)

// The native replay: the same sim.ts, under --deterministic.
run(nish, [
  "examples/wasm-arena/replay.ts",
  "--deterministic",
  "-o",
  `${path.join(out, "replay-ll")}/`,
  "--link",
  path.join(out, "replay"),
])

// The page: types stripped, imports pointed at the files beside it.
const strip = (from, to, rewrite) => {
  let text = stripTypeScriptTypes(fs.readFileSync(path.join(here, from), "utf8"))
  for (const [spec, file] of rewrite) {
    text = text.replaceAll(`from "${spec}"`, `from "${file}"`)
  }
  fs.writeFileSync(path.join(web, to), text)
}
strip("page.ts", "page.js", [
  ["nish/page", "./nish-page.mjs"],
  ["./client", "./client.mjs"],
  ["./host", "./host.js"],
])
strip("host.ts", "host.js", [])
fs.copyFileSync(path.join(root, "runtime/page.mjs"), path.join(web, "nish-page.mjs"))
fs.copyFileSync(path.join(here, "index.html"), path.join(web, "index.html"))
process.stdout.write(`wasm-arena: ${web} and ${path.join(out, "replay")}\n`)
