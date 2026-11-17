// Ported to Nish from Goose (https://github.com/aardappel/goose). Licensed
// under the Apache License, Version 2.0; see bench/goose/LICENSE.
// Upstream file: bench/goose/records_var.goose, at commit 3a0aa2e.
//
// An event log of variant records -- telemetry, game events, any tagged
// message stream -- built from a xorshift64 stream, then replayed four times.
// The log is three columns, the layout a Nish program gives a hot table: a
// byte of tag (with a Say's text length in its upper six bits), an `i32` id,
// and a `u32` payload (a Move's two offsets packed, a Quit's code, or where a
// Say's text starts in one shared byte buffer). Nine bytes an event, plus the
// text; no event is a separate allocation.

import { uncheckedGet } from "nish:unsafe"

const N: i32 = 2000000 // bench:n
const PASSES: i32 = 4

const xsNext = (x: u64): u64 => {
  let v = x
  v ^= v << 13
  v ^= v >> 7
  v ^= v << 17
  return v
}

export const main = (): i32 => {
  const TICK: u8 = 0
  const MOVE: u8 = 1
  const SAY: u8 = 2
  const QUIT: u8 = 3
  const kind: u8[] = []
  const id: i32[] = []
  const pay: u32[] = []
  const text: u8[] = []
  let r: u64 = 12345
  for (let i: i32 = 0; i < N; i++) {
    r = xsNext(r)
    const k = r % 8
    id.push(toI32((r >> 3) % 100000))
    if (k < 4) {
      kind.push(MOVE)
      pay.push(toU32((r >> 20) % 201) | (toU32((r >> 40) % 201) << 16))
    } else if (k < 6) {
      // A word of 4..15 letters from its own chain, so the caller's stream
      // advances once per event whatever the variant is.
      let w = xsNext(r)
      const n = 4 + toU8(w % 12)
      kind.push(SAY | (n << 2))
      pay.push(toU32(text.length))
      for (let j: u8 = 0; j < n; j++) {
        w = xsNext(w)
        text.push(97 + toU8(w % 26))
      }
    } else if (k < 7) {
      kind.push(QUIT)
      pay.push(toU32((r >> 20) % 256))
    } else {
      kind.push(TICK)
      pay.push(0)
    }
  }
  let total: i64 = 0
  for (let p: i32 = 0; p < PASSES; p++) {
    for (let i: i32 = 0; i < N; i++) {
      const tk = uncheckedGet(kind, i)
      const tag = tk & 3
      if (tag === TICK) {
        total += 1
        continue
      }
      const e = uncheckedGet(id, i)
      const v = uncheckedGet(pay, i)
      if (tag === MOVE) {
        total += toI64(e + toI32(v & 0xffff) + toI32(v >> 16) - 200)
      } else if (tag === SAY) {
        total += toI64(e + toI32(tk >> 2) + toI32(text[toI32(v)]))
      } else {
        total += toI64(e + toI32(v))
      }
    }
  }
  console.log(`${N}`)
  console.log(`${total}`)
  return 0
}
