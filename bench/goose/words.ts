// Ported to Nish from Goose (https://github.com/aardappel/goose). Licensed
// under the Apache License, Version 2.0; see bench/goose/LICENSE.
// Upstream file: bench/goose/words.goose, at commit 3a0aa2e.
//
// Word frequency counting: a text of N words drawn with a skew from a random
// vocabulary, split into words, then counted in an open-addressed map. As in
// Goose, no key is copied: a word is an offset pair into the one text, and a
// slot keeps the offset of the word it holds. The vocabulary is a flat byte
// table of fixed-capacity rows so it stays randomly indexable.

import { uncheckedGet, uncheckedSet } from "nish:unsafe"

const N: i32 = 2000000 // bench:n
const MAXW: i32 = 20

const xsNext = (x: u64): u64 => {
  let v = x
  v ^= v << 13
  v ^= v >> 7
  v ^= v << 17
  return v
}

/** FNV-1a over `text[s..e)`. */
const hash = (text: u8[], s: i32, e: i32): u64 => {
  // The FNV-1a 64-bit offset basis, 0xcbf29ce484222325, past 2^53.
  const hi: u64 = 0xcbf29ce4
  const lo: u64 = 0x84222325
  let h: u64 = (hi << 32) | lo
  for (let i = s; i < e; i++) {
    h = (h ^ toU64(uncheckedGet(text, i))) * 1099511628211
  }
  return h
}

const same = (text: u8[], a: i32, b: i32, n: i32): boolean => {
  for (let i: i32 = 0; i < n; i++) {
    if (uncheckedGet(text, a + i) !== uncheckedGet(text, b + i)) {
      return false
    }
  }
  return true
}

export const main = (): i32 => {
  const vocab: i32 = N / 10 + 16
  let r: u64 = 12345
  // A vocabulary of fixed-capacity words.
  const dict = new Array<u8>(vocab * MAXW)
  const dlen = new Array<i32>(vocab)
  for (let i: i32 = 0; i < dlen.length; i++) {
    r = xsNext(r)
    const n = 3 + toI32(r % 12)
    for (let j: i32 = 0; j < n; j++) {
      r = xsNext(r)
      dict[i * MAXW + j] = 97 + toU8(r % 26)
    }
    dlen[i] = n
  }
  // A text of N words drawn with a skew towards the front of the vocabulary.
  const text: u8[] = []
  const v64 = toI64(vocab)
  for (let i: i32 = 0; i < N; i++) {
    r = xsNext(r)
    const a = toI64(r % toU64(v64))
    const k = toI32((a * a) / v64)
    const n = uncheckedGet(dlen, k)
    for (let j: i32 = 0; j < n; j++) {
      text.push(dict[k * MAXW + j])
    }
    text.push(32)
  }
  // Split: an empty part is not a word.
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
  // Count, in an open-addressed map whose keys are offsets into the text.
  let nslots: i32 = 16
  while (nslots < vocab * 4) {
    nslots *= 2
  }
  const mask = toU64(nslots - 1)
  const keyAt = new Array<i32>(nslots)
  const keyLen = new Array<i32>(nslots)
  const counts = new Array<i32>(nslots)
  let distinct: i32 = 0
  const words = starts.length
  for (let w: i32 = 0; w < words; w++) {
    const s = uncheckedGet(starts, w)
    const n = uncheckedGet(ends, w) - s
    let idx = toI32(hash(text, s, s + n) & mask)
    while (true) {
      const c = uncheckedGet(counts, idx)
      if (c === 0) {
        uncheckedSet(keyAt, idx, s)
        uncheckedSet(keyLen, idx, n)
        uncheckedSet(counts, idx, 1)
        distinct++
        break
      }
      if (uncheckedGet(keyLen, idx) === n && same(text, uncheckedGet(keyAt, idx), s, n)) {
        uncheckedSet(counts, idx, c + 1)
        break
      }
      idx = toI32(toU64(idx + 1) & mask)
    }
  }
  let total: i64 = 0
  for (let i: i32 = 0; i < nslots; i++) {
    const c = uncheckedGet(counts, i)
    if (c > 0) {
      total += toI64(c) * toI64(uncheckedGet(keyLen, i) + toI32(text[uncheckedGet(keyAt, i)]))
    }
  }
  console.log(`${words}`)
  console.log(`${distinct}`)
  console.log(`${total}`)
  return 0
}
