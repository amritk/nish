// Ported to Nish from Goose (https://github.com/aardappel/goose). Licensed
// under the Apache License, Version 2.0; see bench/goose/LICENSE.
// Upstream file: bench/goose/strlist.goose, at commit 3a0aa2e.
//
// A list of strings: one text of random space-separated words (3..20
// letters), split into a list, then scanned four times for each word's length
// and its first and last byte. Nish has no slice type -- a window into a
// buffer is `(buf, offset, length)` -- so the list is two `i32` columns of
// offsets into the one text, and splitting it allocates nothing per word.

import { uncheckedGet } from "nish:unsafe"

const N: i32 = 400000 // bench:n
const PASSES: i32 = 4

const xsNext = (x: u64): u64 => {
  let v = x
  v ^= v << 13
  v ^= v >> 7
  v ^= v << 17
  return v
}

export const main = (): i32 => {
  // One text buffer of space-separated random words.
  const text: u8[] = []
  let r: u64 = 12345
  for (let i: i32 = 0; i < N; i++) {
    r = xsNext(r)
    const wl = 3 + toI32(r % 18)
    for (let j: i32 = 0; j < wl; j++) {
      r = xsNext(r)
      text.push(97 + toU8(r % 26))
    }
    text.push(32)
  }
  // Split it into a list of words; an empty part is not a word.
  const starts: i32[] = []
  const ends: i32[] = []
  const len = text.length
  let start: i32 = 0
  for (let i: i32 = 0; i < len; i++) {
    if (uncheckedGet(text, i) === 32) {
      if (i > start) {
        starts.push(start)
        ends.push(i)
      }
      start = i + 1
    }
  }
  if (len > start) {
    starts.push(start)
    ends.push(len)
  }
  // Scan the list repeatedly: length and first/last byte of each word.
  const count = starts.length
  let total: i64 = 0
  for (let p: i32 = 0; p < PASSES; p++) {
    for (let k: i32 = 0; k < count; k++) {
      const s = uncheckedGet(starts, k)
      const e = uncheckedGet(ends, k)
      total += toI64(e - s + toI32(text[s]) + toI32(text[e - 1]))
    }
  }
  console.log(`${count}`)
  console.log(`${total}`)
  return 0
}
