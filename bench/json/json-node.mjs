// Node's built-in JSON.parse (V8): a full object per line, then three property
// reads. The checksum counts UTF-8 bytes, as every other twin does, so each
// string's length is `Buffer.byteLength` rather than `.length`. Same fields
// and checksum as json.ts.
import { readFileSync } from "node:fs"

const lines = readFileSync(process.argv[2], "utf8").split("\n")
const start = process.hrtime.bigint()
let sum = 0
for (const line of lines) {
  if (line.length === 0) {
    continue
  }
  const doc = JSON.parse(line)
  sum = (sum + Buffer.byteLength(doc.code) + doc.line + Buffer.byteLength(doc.message)) & 1073741823
}
const elapsed = process.hrtime.bigint() - start
console.log(sum)
console.log(String(elapsed))
