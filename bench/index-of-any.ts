// `indexOfAny` from `nish/text` against the same walk compiled as written
// (WP38 S1, docs/wp38-simd.md §3.1).
//
//   build/nish bench/index-of-any.ts -o build/bench/index-of-any/ --link build/bench/index-of-any/app
//   build/bench/index-of-any/app
//
// The haystack is 1 MiB of lowercase letters with a quote or a backslash every
// 4,099 bytes: the shape of a JSON string body, where the scan for the next
// byte that matters is nearly all of the work. Each round counts every match
// from a start that moves with the round, so no two rounds ask the same
// question and the optimiser cannot answer once for all of them, and every
// count is folded into a checksum the program prints. The two sides must
// print the same checksum.
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

/** `std/text.ts`'s walker, verbatim but for its name: the unrecognised side. */
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

export const main = (): number => {
  const text = haystack()
  let kernelSum: i64 = 0
  const kernelStart = monotonicNanos()
  let round: i32 = 0
  while (round < ROUNDS) {
    let at: i32 = indexOfAny(text, SET, round * 7)
    while (at >= 0) {
      kernelSum = kernelSum * 31 + toI64(at)
      kernelSum = kernelSum % 1000000007
      at = indexOfAny(text, SET, at + 1)
    }
    round += 1
  }
  const kernelNanos = monotonicNanos() - kernelStart

  let walkSum: i64 = 0
  const walkStart = monotonicNanos()
  round = 0
  while (round < ROUNDS) {
    let at: i32 = walkFrom(text, SET, round * 7)
    while (at >= 0) {
      walkSum = walkSum * 31 + toI64(at)
      walkSum = walkSum % 1000000007
      at = walkFrom(text, SET, at + 1)
    }
    round += 1
  }
  const walkNanos = monotonicNanos() - walkStart

  const bytes: f64 = toF64(HAYSTACK_BYTES) * toF64(ROUNDS)
  const kernelMs: f64 = toF64(kernelNanos) / 1000000.0
  const walkMs: f64 = toF64(walkNanos) / 1000000.0
  console.log(`checksum: kernel ${kernelSum} walk ${walkSum}`)
  console.log(`kernel: ${kernelMs} ms, ${bytes / kernelMs / 1000000.0} GB/s`)
  console.log(`walk:   ${walkMs} ms, ${bytes / walkMs / 1000000.0} GB/s`)
  console.log(`ratio:  ${walkMs / kernelMs}x`)
  return kernelSum === walkSum ? 0 : 1
}
