// The strings.mjs half of the encode pin (tests/run.js, emit-ts section):
//
//   node tests/emit-ts/encodes/unit.mjs [strings.mjs]
//
// A loop in the shape of std/text.ts's `indexOfAnyFrom` and std/yaml.ts's
// `yamlByte`: per byte of a large document it reads `strLen(text)` and
// `charCodeAt(text, i)`, then a byte of a short needle and of a second short
// word, so the strings alternate on every call. The document, the needle and
// the word are none of them ASCII, so three encoded entries stay in the cache
// at once and it is the cache, not the ASCII path, that keeps them. Prints the encodes and
// exits 0 when they stay a small constant, 1 when they grow with the loop, as
// a single-slot cache's do (one encode of the document per byte read).
import path from "node:path"
import { pathToFileURL } from "node:url"

import { encodes } from "./count.mjs"

const file = path.resolve(process.argv[2] ?? path.join(import.meta.dirname, "..", "..", "..", "runtime", "core", "strings.mjs"))
const { charCodeAt, strLen } = await import(pathToFileURL(file).href)

const text = "key: välue # ünïcode\n".repeat(5000)
const needles = "é:#\n"
const word = "välue"
const before = encodes()
let sum = 0
for (let i = 0; i < strLen(text); i++) {
  sum += charCodeAt(text, i)
  sum += charCodeAt(needles, i % strLen(needles))
  sum += charCodeAt(word, i % strLen(word))
}
const made = encodes() - before
const reads = strLen(text)
console.log(`${made} encodes for ${reads} reads of a ${reads}-byte document (checksum ${sum})`)
process.exit(made <= 8 ? 0 : 1)
