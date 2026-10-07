// Writes the input every `bench/json` reader parses: one flat JSON object per
// line, shaped like the compiler's own `--json` diagnostics (the surface
// `std/json` exists to read), with a nested `range` object and a `related`
// array before the last field so that a reader has to step over them. A
// fixed-seed generator makes the file, and so the checksum, the same on every
// machine.
//
//   node bench/json/gen.mjs <lines> <out.jsonl>
import { writeFileSync } from "node:fs"

const lines = Number(process.argv[2] ?? 100000)
const out = process.argv[3] ?? "build/bench/json/input.jsonl"

let seed = 0x2545f491
const next = () => {
  // xorshift32: small, deterministic and the same in every Node release.
  seed ^= seed << 13
  seed ^= seed >>> 17
  seed ^= seed << 5
  seed >>>= 0
  return seed
}
const pick = (items) => items[next() % items.length]

const files = [
  "src/checker.ts",
  "src/emit-call.ts",
  "src/parser.ts",
  "std/json.ts",
  "tests/nish/run.ts",
  "examples/http/server.ts",
]
const words = [
  "type",
  "value",
  "string",
  "number",
  "is",
  "not",
  "assignable",
  "to",
  "parameter",
  "of",
  "the",
  "call",
  "expected",
  "found",
  "`i32`",
  "`f64`",
  "field",
  "array",
  "closure",
  "captures",
  "generic",
  "narrowed",
  "here",
  "{",
  "}",
  "[",
  "]",
  ":",
  ",",
]
// Each escape `std/json` decodes, and a BMP `\u` escape (no surrogate pair:
// the module does not recombine them, and its header says why).
const escapes = ['\\"', "\\n", "\\t", "\\\\", "\\/", "\\u00e9", "\\u2192"]

const message = () => {
  const count = 4 + (next() % 28)
  const parts = []
  for (let i = 0; i < count; i++) {
    parts.push(next() % 10 === 0 ? pick(escapes) : pick(words).replaceAll('"', '\\"'))
  }
  return parts.join(" ")
}

const rows = []
for (let i = 0; i < lines; i++) {
  const line = 1 + (next() % 20000)
  const column = 1 + (next() % 120)
  const related = []
  for (let r = next() % 3; r > 0; r--) {
    related.push(`{"file":"${pick(files)}","line":${1 + (next() % 20000)},"message":"${message()}"}`)
  }
  rows.push(
    `{"file":"${pick(files)}","line":${line},"column":${column},"severity":"${pick(["error", "warning", "note"])}",` +
      `"code":"NL${String(next() % 10000).padStart(4, "0")}",` +
      `"range":{"start":{"line":${line},"column":${column}},"end":{"line":${line},"column":${column + (next() % 40)}}},` +
      `"related":[${related.join(",")}],"fixes":[],"message":"${message()}"}`
  )
}
writeFileSync(out, `${rows.join("\n")}\n`)
