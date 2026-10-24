/**
 * Fuzz target: `JsonTokenizer` (std/json-tokenizer.ts), driven to its end.
 *
 * Byte 0 picks the mode and the rest is the text, handed over as the window
 * `[1, n)` of `data` so a read before the window or past it is caught too.
 * Bit 0 of the mode sets tight `JsonLimits`, so the limit refusals run on
 * short inputs; bit 1 calls `skipValue` at every container instead of
 * stepping into it. Every token is read back the way a decoder would: its
 * string into a buffer of exactly `stringLength()` bytes, its number as an
 * integer, an unsigned and an `f64`. A refusal is a negative token; nothing
 * the text holds may panic.
 */
import {
  JSON_TOK_ARRAY_BEGIN,
  JSON_TOK_KEY,
  JSON_TOK_NUMBER,
  JSON_TOK_OBJECT_BEGIN,
  JSON_TOK_STRING,
  JsonLimits,
  JsonTokenizer,
} from "nish/json-tokenizer"

export const fuzzOne = (data: u8[]): void => {
  const n: i32 = toI32(data.length)
  if (n === 0) {
    return
  }
  const mode: i32 = toI32(data[0])
  const limits: JsonLimits = new JsonLimits()
  if ((mode & 1) !== 0) {
    limits.maxDepth = 4
    limits.maxStringBytes = 16
    limits.maxNumberBytes = 8
    limits.maxTotalBytes = 64
  }
  const skip: boolean = (mode & 2) !== 0
  const tok: JsonTokenizer = new JsonTokenizer(data, 1, n - 1, limits)
  let k: i32 = tok.next()
  // Every token moves the cursor at least one byte, so this ends.
  let steps: i32 = 0
  while (k > 0 && steps <= n) {
    if (k === JSON_TOK_STRING || k === JSON_TOK_KEY) {
      const len: i32 = tok.stringLength()
      if (len >= 0) {
        const out: u8[] = new Array<u8>(len)
        if (tok.stringInto(out, 0) !== len) {
          panic("json-tokenizer: stringInto disagrees with stringLength")
        }
      }
      tok.keyEquals("id")
      tok.isText()
    } else if (k === JSON_TOK_NUMBER) {
      if (tok.isInteger()) {
        tok.numberI64()
      }
      if (tok.isU64()) {
        tok.numberU64()
      }
      tok.isIntegral()
      tok.numberF64()
    } else if (skip && (k === JSON_TOK_OBJECT_BEGIN || k === JSON_TOK_ARRAY_BEGIN)) {
      if (tok.skipValue() < 0) {
        return
      }
    }
    k = tok.next()
    steps += 1
  }
  if (steps > n) {
    panic("json-tokenizer: more tokens than bytes")
  }
}
