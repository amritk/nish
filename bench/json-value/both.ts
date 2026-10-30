// bench/json-value/main.ts in a program that also reaches `parseRanged`: the
// timed loop runs `parse`, ranges off, and one ranged parse of the same bytes
// before it keeps the ranged loop in the binary. What `parse` costs in a
// program that uses both entry points, measured rather than assumed.
import { JsonLimits } from "nish/json-tokenizer"
import { JsonDocument } from "nish/json-value"

import { benchParse } from "./loop"

export const main = (): number => {
  const doc = new JsonDocument(new JsonLimits())
  const read: u8[] | null = process.argv.length < 2 ? null : readFileBytesSync(process.argv[1])
  if (read !== null && doc.parseRanged(read, 0, toI32(read.length)) < 0) {
    console.error(`ranged parse failed at ${doc.errorAt}`)
    return 1
  }
  return benchParse(doc, (d, src, off, len) => d.parse(src, off, len))
}
