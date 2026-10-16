// WP38 S3a, depth form 4: depth-checked.ts with the scan's reads through
// uncheckedGet, the comparator's second measurement (docs/wp38-simd.md §2.3,
// §3.2.1), one byte at a time as depth-scalar.c is. It counts closed strings
// and brackets, answering -1 past depth 64 or below 0 and -2 for an
// unterminated document; the counts wrap as the vector form's would. The
// documents and rounds are depth-doc.h's: argv[1] is "s0" or "log", and an
// argv[2] of "setup" builds the document and scans it no times.
import { uncheckedGet, wrappingAdd } from "nish:unsafe"

const DOC_BYTES: i32 = 1048576
const ROUNDS: i32 = 500
const MAX_DEPTH: i32 = 64
const PIECE_S0: string = '{"id":"a\\"b","n":[1,2,3],"s":"x,y:z","d":{"k":[true,null]}},'
const PIECE_LOG: string =
  '{"code":404,"line":1234,"tags":[1,2,3],"message":"GET /api/v1/items?page=2 returned an ' +
  'empty page after one retry; the upstream said \\"no rows\\" and the cache was cold"},'

const scan = (bytes: u8[]): i32 => {
  let tokens: i32 = 0
  let depth: i32 = 0
  let inString = false
  let escaped = false
  for (let i: i32 = 0; i < toI32(bytes.length); i++) {
    const c = uncheckedGet(bytes, i)
    if (inString) {
      if (escaped) {
        escaped = false
      } else if (c === 92) {
        escaped = true
      } else if (c === 34) {
        inString = false
        tokens = wrappingAdd(tokens, 1)
      }
    } else if (c === 34) {
      inString = true
    } else if (c === 123 || c === 91) {
      depth = wrappingAdd(depth, 1)
      if (depth > MAX_DEPTH) {
        return -1
      }
      tokens = wrappingAdd(tokens, 1)
    } else if (c === 125 || c === 93) {
      depth = wrappingAdd(depth, -1)
      if (depth < 0) {
        return -1
      }
      tokens = wrappingAdd(tokens, 1)
    }
  }
  if (inString || depth !== 0) {
    return -2
  }
  return tokens
}

export const main = (): i32 => {
  const piece = process.argv.length > 1 && process.argv[1] === "log" ? PIECE_LOG : PIECE_S0
  const len = toI32(piece.length)
  const pieces = DOC_BYTES / len
  const flip = toI32(piece.indexOf("[1")) + 1
  const bytes: u8[] = []
  for (let i: i32 = 0; i < pieces * len; i++) {
    bytes.push(toU8(piece.charCodeAt(i % len)))
  }
  const rounds = process.argv.length > 2 && process.argv[2] === "setup" ? 0 : ROUNDS
  let checksum: i64 = 0
  for (let r: i32 = 0; r < rounds; r++) {
    const at = (r % pieces) * len + flip
    if (at >= 0 && at + 2 < toI32(bytes.length)) {
      bytes[at] = toU8(91)
      bytes[at + 2] = toU8(93)
    }
    checksum = (checksum * 31 + toI64(scan(bytes) + r)) % 1000003
  }
  console.log(checksum)
  return 0
}
