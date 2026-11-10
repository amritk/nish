// Driven by tests/run.js's host-import-text section: every export through the
// loader, against the page's own host.ts, with the raw exports caught so the
// arena mark can be read across calls.
import { readFileSync } from "node:fs"
import * as host from "./host.ts"
import { loadSync } from "./main.mjs"

const Real = WebAssembly.Instance
let raw = null
WebAssembly.Instance = function (module, imports) {
  const made = new Real(module, imports)
  raw = made.exports
  return made
}
const bytes = readFileSync(new URL("./main.wasm", import.meta.url))
const m = loadSync(bytes, { host, onPanic: () => {} })
const show = (s) => JSON.stringify(s)
console.log(`speak ${m.speak(42, 0.1 + 0.2)}`)
console.log(`label ${show(m.label(-7))} fixed ${show(m.fixed())} nothing ${show(m.nothing())} takes ${typeof m.takes}`)
const mark = raw.nish_arena_mark()
const size = m.memory.buffer.byteLength
let same = true
for (let i = 0; i < 10000; i++) same = same && m.label(i) === `#${i} é\u{1D11E}`
console.log(`label x10000 ${same} mark ${raw.nish_arena_mark() === mark} memory ${m.memory.buffer.byteLength === size}`)
const storage = m.views().storage
const out = (n) => show(new TextDecoder().decode(storage.OUTBOX.subarray(0, n)))
let n = m.compose(-12, 0.5)
console.log(`compose ${n} ${out(n)}`)
const before = storage.OUTBOX.slice()
// "n=7 x=" fits and lands; the 19 bytes of 0.30000000000000004 do not, so they write nothing.
const failed = m.compose(7, 0.1 + 0.2)
console.log(`compose overflow ${failed} ${out(6)} rest untouched ${before.every((b, i) => i < 6 || storage.OUTBOX[i] === b)}`)
const w = new TextEncoder().encodeInto("héllo \u{1D11E}", storage.INBOX).written
n = m.echo(w)
console.log(`echo ${w} ${n} ${out(n)}`)
console.log(`readBack ${show(m.readBack(w))} ${show(m.readBack(33))} ${show(m.readBack(-1))} ${show(m.readBack(0))}`)
const big = new TextEncoder().encodeInto("x".repeat(20), storage.INBOX).written
const kept = storage.OUTBOX.slice()
console.log(`echo overflow ${m.echo(big)} untouched ${kept.every((b, i) => storage.OUTBOX[i] === b)}`)
console.log(`bom ${show(m.bom())}`)
const settled = storage.OUTBOX.slice()
console.log(`chained ${m.chained()} untouched ${settled.every((b, i) => storage.OUTBOX[i] === b)}`)
