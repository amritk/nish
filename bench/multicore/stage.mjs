// Copies the server's source into the challenge submission staged at
// submission/nish-std-amritk/src, which the challenge builds on its own
// (build.sh compiles src/main.ts), so the submission is a folder that can be
// copied into the challenge's repository as it is.
//
//   node bench/multicore/stage.mjs           copy
//   node bench/multicore/stage.mjs --check   exit 1 when the copy differs
import fs from "node:fs"
import path from "node:path"

const here = import.meta.dirname
const from = path.join(here, "conduit")
const to = path.join(here, "submission", "nish-std-amritk", "src")
const files = fs
  .readdirSync(from)
  .filter((f) => f.endsWith(".ts") || f === "LICENSE.md")
  .sort()

if (process.argv.includes("--check")) {
  const staged = fs.existsSync(to) ? fs.readdirSync(to).sort() : []
  const stale = files.filter(
    (f) =>
      !staged.includes(f) ||
      fs.readFileSync(path.join(from, f), "utf8") !== fs.readFileSync(path.join(to, f), "utf8")
  )
  const extra = staged.filter((f) => !files.includes(f))
  if (stale.length > 0 || extra.length > 0) {
    console.error(
      `stage: submission/nish-std-amritk/src differs from conduit/ (${[...stale, ...extra].join(", ")}): run node bench/multicore/stage.mjs`
    )
    process.exit(1)
  }
  process.exit(0)
}
fs.rmSync(to, { recursive: true, force: true })
fs.mkdirSync(to, { recursive: true })
for (const f of files) {
  fs.copyFileSync(path.join(from, f), path.join(to, f))
}
console.log(`stage: ${files.length} files into ${path.relative(process.cwd(), to)}`)
