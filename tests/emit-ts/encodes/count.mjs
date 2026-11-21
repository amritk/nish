// Preloaded with `node --import`: counts every UTF-8 encode the process makes
// (`TextEncoder`'s `encode` and `encodeInto`, wrapped on the prototype, so an
// encoder built before or after this runs is counted alike) and, at exit,
// writes the count to the file `NISH_ENCODES_TO` names. tests/run.js's emit-ts
// section reads it to pin that runtime/core/strings.mjs encodes a string once
// while it stays in use, not once per byte read.
import fs from "node:fs"

const proto = TextEncoder.prototype
const { encode, encodeInto } = proto
let count = 0
proto.encode = function (s) {
  count += 1
  return encode.call(this, s)
}
proto.encodeInto = function (s, into) {
  count += 1
  return encodeInto.call(this, s, into)
}

/** The encodes made so far. */
export const encodes = () => count

process.on("exit", () => {
  if (process.env.NISH_ENCODES_TO) fs.writeFileSync(process.env.NISH_ENCODES_TO, `${count}\n`)
})
