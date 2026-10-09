// `indexOfAny` from `nish/text` against the same walk compiled as written
// (WP38 S1, docs/wp38-simd.md §3.1).
//
//   build/nish bench/index-of-any.ts -o build/bench/index-of-any/ --link build/bench/index-of-any/app
//   build/bench/index-of-any/app
//
// The haystack is 1 MiB of lowercase letters with a quote or a backslash every
// 4,099 bytes: the shape of a JSON string body, where the scan for the next
// byte that matters is nearly all of the work. Every round is a different
// text: one more quote is written over a byte at a position that moves with
// the round, so each round's matches differ and the optimiser cannot answer
// once for all of them. The text is built before either side's clock starts,
// each side counts every match in it, and every index is folded into that
// side's checksum, which the program prints; the two must agree.
//
// `indexOfAny` is the runtime kernel natively (`src/kernels.ts`). `walkFrom`
// below is `std/text.ts`'s `indexOfAnyFrom` copied into this root module,
// where nothing recognises it, so it is compiled as the byte loop it is.
import { monotonicNanos } from "nish:process"
import { indexOfAny } from "nish/text"

const HAYSTACK_BYTES: i32 = 1048576
const MATCH_EVERY: i32 = 4099
const ROUNDS: i32 = 200
const SET: string = '"\\'
/** How far the round's extra quote moves each round: prime, so it lands on a new byte every time. */
const MOVE: i32 = 5237

/**
 * `std/text.ts`'s walker, verbatim but for its name: the unrecognised side. It
 * must stay identical to `indexOfAnyFrom`, or the ratio this prints measures
 * two different loops.
 */
const walkFrom = (text: string, bytes: string, from: i32): i32 => {
  const length: i32 = toI32(text.length)
  const count: i32 = toI32(bytes.length)
  let i: i32 = from
  while (i >= 0 && i < length) {
    const code: i32 = toI32(text.charCodeAt(i))
    let j: i32 = 0
    while (j < count) {
      if (toI32(bytes.charCodeAt(j)) === code) {
        return i
      }
      j += 1
    }
    i += 1
  }
  return -1
}

/** 1 MiB of letters, with a quote or a backslash at every `MATCH_EVERY`th byte. */
const haystack = (): string => {
  const letters = "abcdefghijklmnopqrstuvwxyz"
  const parts: string[] = []
  let i: i32 = 0
  while (i < HAYSTACK_BYTES) {
    if (i % MATCH_EVERY === MATCH_EVERY - 1) {
      parts.push(i % 2 === 0 ? '"' : "\\")
    } else {
      parts.push(letters.substring(i % 26, (i % 26) + 1))
    }
    i += 1
  }
  return parts.join("")
}

/** Every match of `SET` in `text`, by the kernel, folded into `sum`. */
const kernelChecksum = (text: string, sum: i64): i64 => {
  let folded: i64 = sum
  let at: i32 = indexOfAny(text, SET, 0)
  while (at >= 0) {
    folded = (folded * 31 + toI64(at)) % 1000000007
    at = indexOfAny(text, SET, at + 1)
  }
  return folded
}

/** The same, by the unrecognised walker. */
const walkChecksum = (text: string, sum: i64): i64 => {
  let folded: i64 = sum
  let at: i32 = walkFrom(text, SET, 0)
  while (at >= 0) {
    folded = (folded * 31 + toI64(at)) % 1000000007
    at = walkFrom(text, SET, at + 1)
  }
  return folded
}

export const main = (): number => {
  const base = haystack()
  let kernelSum: i64 = 0
  let walkSum: i64 = 0
  let kernelNanos: i64 = 0
  let walkNanos: i64 = 0
  let round: i32 = 0
  while (round < ROUNDS) {
    const at: i32 = (round * MOVE) % HAYSTACK_BYTES
    const text = `${base.slice(0, at)}"${base.slice(at + 1, HAYSTACK_BYTES)}`
    const kernelStart = monotonicNanos()
    kernelSum = kernelChecksum(text, kernelSum)
    kernelNanos += monotonicNanos() - kernelStart
    const walkStart = monotonicNanos()
    walkSum = walkChecksum(text, walkSum)
    walkNanos += monotonicNanos() - walkStart
    round += 1
  }

  const bytes: f64 = toF64(HAYSTACK_BYTES) * toF64(ROUNDS)
  const kernelMs: f64 = toF64(kernelNanos) / 1000000.0
  const walkMs: f64 = toF64(walkNanos) / 1000000.0
  console.log(`checksum: kernel ${kernelSum} walk ${walkSum}`)
  console.log(`kernel: ${kernelMs} ms, ${bytes / kernelMs / 1000000.0} GB/s`)
  console.log(`walk:   ${walkMs} ms, ${bytes / walkMs / 1000000.0} GB/s`)
  console.log(`ratio:  ${walkMs / kernelMs}x`)
  return kernelSum === walkSum ? 0 : 1
}
