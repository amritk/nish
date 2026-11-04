// WP38 S3, depth form 5: depth-vector.c's kernel written with nish:simd, the
// form S3's bar times against form 3 (docs/wp38-simd.md §2.3, §7). Each
// 16-byte block is compared against the four structural bytes at once; a
// block with none (`any` false) is skipped whole, and a block with some walks
// its `bitmask` in order through depth-checked.ts's state machine, kept in
// locals. The lowest set bit's index is `31 - Math.clz32(bits & (0 - bits))`,
// Nish having no count-trailing-zeros builtin. An escape is held as the
// position it consumes, so a `\` at the end of one block still escapes the
// first byte of the next.
// The documents and rounds are depth-checked.ts's: argv[1] is "s0" or "log",
// and an argv[2] of "setup" builds the document and scans it no times.
import { wrappingAdd } from "nish:unsafe"
import { any, bitmask, eq, loadU8x16, or, splatU8x16 } from "nish:simd"

const DOC_BYTES: i32 = 1048576
const ROUNDS: i32 = 500
const MAX_DEPTH: i32 = 64
const PIECE_S0: string = '{"id":"a\\"b","n":[1,2,3],"s":"x,y:z","d":{"k":[true,null]}},'
const PIECE_LOG: string =
  '{"code":404,"line":1234,"tags":[1,2,3],"message":"GET /api/v1/items?page=2 returned an ' +
  'empty page after one retry; the upstream said \\"no rows\\" and the cache was cold"},'

/** The closed strings and brackets of `bytes`: -1 past depth 64 or below 0, -2 unterminated. */
const scan = (bytes: u8[]): i32 => {
  let tokens: i32 = 0
  let depth: i32 = 0
  let inString = false
  // The position a `\` consumes, so an escape crosses a block's end.
  let escAt: i32 = -1
  const n = toI32(bytes.length)
  const quote = splatU8x16(34)
  const slash = splatU8x16(92)
  const open = splatU8x16(123)
  const close = splatU8x16(125)
  // `[` and `]` differ from `{` and `}` only in bit 5.
  const fold = splatU8x16(32)
  let p: i32 = 0
  for (; p + 16 <= n; p = p + 16) {
    const x = loadU8x16(bytes, p)
    const folded = or(x, fold)
    const hit = or(or(eq(x, quote), eq(x, slash)), or(eq(folded, open), eq(folded, close)))
    if (!any(hit)) {
      continue
    }
    let bits = bitmask(hit)
    while (bits !== 0) {
      const at = p + 31 - Math.clz32(bits & (0 - bits))
      bits = bits & (bits - 1)
      if (at < 0 || at >= toI32(bytes.length)) {
        break
      }
      const c = bytes[at]
      if (inString) {
        if (at === escAt) {
          continue
        }
        if (c === 92) {
          escAt = at + 1
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
  }
  // The last partial block, byte by byte: the same machine with the escape as a flag.
  let escaped = false
  if (inString && escAt === p) {
    escaped = true
  }
  for (; p >= 0 && p < toI32(bytes.length); p++) {
    const c = bytes[p]
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
