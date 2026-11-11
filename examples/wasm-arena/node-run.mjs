// Runs the built page of examples/wasm-arena under Node, with no GPU: the page's
// own startArena, scripted, and a renderer that only counts. tests/run.js's
// `wasm-arena` section reads what it prints and replays the recorded input
// natively (build.mjs's <out>/replay), which must print the same hash.
//
//   node examples/wasm-arena/node-run.mjs <out>/web <frames> [seed]
//
// Prints one JSON line: frames, ticks, hash, the input as replay's run-length
// arguments, and whether memory's byteLength and the arena's mark held still
// across every frame.
import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

const [dir, framesArg, seedArg] = process.argv.slice(2)
const frames = Number(framesArg)
const seed = Number(seedArg ?? "1")

// The loader keeps the raw exports to itself; the arena's mark is one of them.
const Real = WebAssembly.Instance
let raw = null
WebAssembly.Instance = function Instance(module, imports) {
  const made = new Real(module, imports)
  raw = made.exports
  return made
}

const page = await import(pathToFileURL(path.resolve(dir, "page.js")).href)
let drawn = 0
const renderer = {
  prepare: () => undefined,
  shader: () => false,
  program: () => undefined,
  draw: (_f32, _at, n) => {
    drawn += n
  },
}
const arena = page.startArena(fs.readFileSync(path.join(dir, "client.wasm")), renderer, seed, frames * 8 + 8)
const byteLength = arena.module.memory.buffer.byteLength
const mark = raw.nish_arena_mark()
// Mostly 60 Hz, with a dropped frame (two ticks) and a short one (none) in each cycle.
const dtOf = (f) => {
  if (f % 97 === 50) {
    return 2000 / 60
  }
  return f % 89 === 30 ? 5 : 1000 / 60
}
let steady = true
for (let f = 0; f < frames; f++) {
  const word = page.scripted(f)
  if ((word & 255) !== 0) {
    arena.press(word & 255)
  }
  if (word >> 8 !== 0) {
    arena.release(word >> 8)
  }
  arena.frame(dtOf(f))
  if (arena.module.memory.buffer.byteLength !== byteLength || raw.nish_arena_mark() !== mark) {
    steady = false
  }
}
console.log(
  JSON.stringify({
    frames,
    ticks: arena.module.ticks(),
    logged: arena.logged(),
    overflow: arena.overflow(),
    hash: arena.hash(),
    runs: page.runs(arena.log, arena.logged()),
    byteLength,
    steady,
    webgpu: arena.webgpu,
    drawn,
  })
)
