// Arrays across the host boundary (docs/wp8-interop.md). `Int32Array`,
// `Float64Array` and `BigInt64Array` are the Nish spellings of i32[],
// f64[] and i64[]: one layout, and the name a Node host sees in the typings.
//
//   nish examples/arrays.ts -o build/arrays.ll \
//     --emit-header build/arrays.h --emit-dts build/arrays.d.ts --emit-napi build/arrays_napi.c
//   scripts/build.sh build/arrays.ll runtime/runtime-wasm.c -o build/arrays.wasm --profile wasm
//   node examples/node-host.mjs build/arrays.wasm scale f64:1,2,3 2      # scale(...) = 2, 4, 6
//   scripts/build.sh build/arrays.ll runtime/runtime.c build/arrays_napi.c -o build/arrays.node --profile napi
//   node examples/node-addon.mjs build/arrays.node
//
// The host passes any length and any i32, so each sum checks every step and
// `squares` checks `n` before it allocates. `sumI32` answers a `Result`, which
// crosses as `{ ok, value }` / `{ ok, error }`. A `Result` of an i64 or of an
// array does not cross to JS, so `sumI64` and `squares` keep their plain
// results and refuse what they cannot answer on stderr, exiting 1: a wasm
// build, with no stderr and no process, traps instead (`squares(-1)` is a
// pinned test). `new Float64Array(xs.length)` needs no check, since a length
// is never negative.
//
// The types are spelled explicitly (i32 / f64) so the module means the same
// thing in both number modes.
//
// A loop that writes `out[i]` is bounded by `out.length` as well as by the
// input's: the two are equal, but the compiler proves an index in range only
// against the length the condition names, and `new Float64Array(xs.length)`
// does not tell it that `out` is as long as `xs`.

import { exit } from "nish:process"

// 2^63 - 1 and -2^63, spelled with products of 2^52 since a literal stops at 2^53.
const I64_MAX: i64 = 4503599627370496 * 1024 - 1 + 4503599627370496 * 1024
const I64_MIN: i64 = -I64_MAX - 1
// The `Err` codes, typed so a literal means i32 in both number modes.
const ABOVE: i32 = 1
const BELOW: i32 = -1

/** Sum of a Float64Array: the host passes the whole buffer once. */
export const sumF64 = (xs: Float64Array): f64 => {
  let total: f64 = 0
  for (const x of xs) {
    total += x
  }
  return total
}

/** Sum of an Int32Array, or `Err` when it leaves i32: `1` above, `-1` below. */
export const sumI32 = (xs: Int32Array): Result<i32, i32> => {
  let total: i32 = 0
  for (const x of xs) {
    const wide: i64 = toI64(total) + toI64(x)
    if (wide > 2147483647) {
      return Err(ABOVE)
    }
    if (wide < -2147483648) {
      return Err(BELOW)
    }
    total = toI32(wide)
  }
  return Ok(total)
}

/** A new array: the host gets a copy (wasm) or a fresh typed array (N-API). */
export const scale = (xs: Float64Array, k: f64): Float64Array => {
  const out = new Float64Array(xs.length)
  for (let i = 0; i < xs.length && i < out.length; i++) {
    out[i] = xs[i] * k
  }
  return out
}

/** `[0, 1, 4, ...]`, `n` long. 46341 is the longest whose last square, 46340², fits i32. */
export const squares = (n: i32): Int32Array => {
  if (n < 0 || n > 46341) {
    console.error("squares: n must be in 0..46341")
    exit(1)
  }
  const len: integer<0, 46341> = n
  const out = new Int32Array(len)
  for (let i = 0; i < out.length && i < len; i++) {
    out[i] = i * i
  }
  return out
}

/** Writes through its parameter: the header spells it `nish_array *`, and the host's buffer changes in place. */
export const fill = (xs: Int32Array, v: i32): void => {
  for (let i = 0; i < xs.length; i++) {
    xs[i] = v
  }
}

export const widen = (xs: Int32Array): BigInt64Array => {
  const out = new BigInt64Array(xs.length)
  for (let i = 0; i < xs.length; i++) {
    // Converted first and stored under its own test: `toI64` is a call, and a
    // call may change an array's length, so a bound tested before it no longer
    // proves `out[i]` in range after it.
    const wide = toI64(xs[i])
    if (i < out.length) {
      out[i] = wide
    }
  }
  return out
}

/** i64 in and out: JS passes a bigint. */
export const sumI64 = (xs: BigInt64Array): i64 => {
  let total: i64 = 0
  for (const x of xs) {
    // Two signs never overflow. Two of one sign are checked through the room
    // left before the limit, a difference that always fits i64.
    if (total >= 0 && x >= 0) {
      const left: i64 = I64_MAX - total - x
      if (left < 0) {
        console.error("sumI64: the sum overflows i64")
        exit(1)
      }
      total = I64_MAX - left
    } else if (total < 0 && x < 0) {
      const room: i64 = I64_MIN - total
      const left: i64 = x - room
      if (left < 0) {
        console.error("sumI64: the sum overflows i64")
        exit(1)
      }
      total = I64_MIN + left
    } else if (total >= 0 && x < 0) {
      total += x
    } else if (total < 0 && x >= 0) {
      total += x
    }
  }
  return total
}
