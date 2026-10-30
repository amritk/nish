// The loop every bench/json-value parse program runs: one JSON document parsed into a
// `JsonDocument` over and over, the document reused, so a round costs what a
// server pays for a parse once its arrays have grown.
//
//   <program> <file> <iterations> <at>
//
// Before each iteration the byte at offset `at` (a digit
// bench/json-value/measure.mjs picks) is set to the digit `iteration % 10`, so
// no iteration parses what the one before did. Every iteration folds the root's
// kind and length and the values, slots and string bytes the parse stored into
// the printed checksum. The first line printed is the checksum, the second
// `ns <elapsed>` for every iteration together.
import { JSON_VALUE_MAX_VALUES, JsonDocument, JsonValue } from "nish/json-value"

/**
 * Parses argv's document `iterations` times into `doc` with `parse`, which a
 * program passes as an arrow naming one entry point, so that the binary holds
 * only that one; prints the checksum and the time, and answers the exit code.
 */
export const benchParse = (
  doc: JsonDocument,
  parse: (doc: JsonDocument, src: u8[], off: i32, len: i32) => JsonValue
): number => {
  if (process.argv.length < 4) {
    console.error("usage: <program> <file> <iterations> <at>")
    return 2
  }
  const read: u8[] | null = readFileBytesSync(process.argv[1])
  if (read === null) {
    console.error(`cannot read ${process.argv[1]}`)
    return 1
  }
  const src: u8[] = read
  const iterations: i32 = toI32(parseInt(process.argv[2]))
  const at: i32 = toI32(parseInt(process.argv[3]))
  doc.maxValues = JSON_VALUE_MAX_VALUES
  let checksum: i64 = 0
  const t0: i64 = monotonicNanos()
  for (let i: i32 = 0; i < iterations; i += 1) {
    if (at >= 0 && at < toI32(src.length)) {
      src[at] = toU8(48 + (i % 10))
    }
    const root = parse(doc, src, 0, toI32(src.length))
    if (root < 0) {
      console.error(`parse failed: ${root} at ${doc.errorAt}`)
      return 1
    }
    const fold: i64 =
      toI64(doc.kind(root)) +
      toI64(doc.length(root)) +
      toI64(doc.top) +
      toI64(doc.slotTop) +
      toI64(doc.byteTop)
    checksum = (checksum * toI64(31) + fold) % toI64(1000000007)
  }
  const elapsed: i64 = monotonicNanos() - t0
  console.log(`${checksum}`)
  console.log(`ns ${elapsed}`)
  return 0
}
