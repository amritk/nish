// The hash family's Nish program: SHA-256, SHA-512, HMAC-SHA256 and
// HKDF-SHA256 from std/crypto, under the contract in bench/crypto/README.md.
// bench/crypto/run.mjs builds it with `--profile speed` and runs
//
//   main <kernel> <size> <iterations>
//
// The inputs each kernel draws are in this family's README.md.
import { hkdfExpandSha256, hkdfExtractSha256 } from "nish/crypto/hkdf"
import { hmacSha256 } from "nish/crypto/hmac"
import { sha256 } from "nish/crypto/sha256"
import { sha512 } from "nish/crypto/sha512"
import { Args, baseOf, fold, foldStart, Inputs, inputs, now, parseArgs, report, tweak } from "../lib/gen"

/** HKDF-Expand's output: the 42 bytes of RFC 5869's first test case. */
const HKDF_OUT: i32 = 42

/** `sha256` or `sha512` over the message, `iterations` times. */
const digestLoop = (a: Args, wide: boolean): i32 => {
  const inp: Inputs = inputs(a.kernel, a.size, 0, 0, 0, a.size)
  const msg: u8[] = inp.msg
  const base: u8[] = baseOf(msg, 0)
  let sum: u32 = foldStart()
  const started: i64 = now()
  for (let i: i32 = 0; i < a.iterations; i++) {
    tweak(msg, 0, base, i)
    sum = fold(sum, wide ? sha512(msg) : sha256(msg))
  }
  report(sum, started)
  return 0
}

/** HMAC-SHA256 under a 32-byte key. */
const hmacLoop = (a: Args): i32 => {
  const inp: Inputs = inputs(a.kernel, a.size, 32, 0, 0, a.size)
  const msg: u8[] = inp.msg
  const base: u8[] = baseOf(msg, 0)
  let sum: u32 = foldStart()
  const started: i64 = now()
  for (let i: i32 = 0; i < a.iterations; i++) {
    tweak(msg, 0, base, i)
    sum = fold(sum, hmacSha256(inp.key, msg))
  }
  report(sum, started)
  return 0
}

/** HKDF-SHA256: extract under a 32-byte salt, then a 42-byte expand under a 10-byte info. */
const hkdfLoop = (a: Args): i32 => {
  const inp: Inputs = inputs(a.kernel, a.size, 32, 0, 10, a.size)
  const ikm: u8[] = inp.msg
  const base: u8[] = baseOf(ikm, 0)
  let sum: u32 = foldStart()
  const started: i64 = now()
  for (let i: i32 = 0; i < a.iterations; i++) {
    tweak(ikm, 0, base, i)
    const okm: u8[] | null = hkdfExpandSha256(hkdfExtractSha256(inp.key, ikm), inp.aad, HKDF_OUT)
    if (okm === null) {
      writeError("hash: hkdfExpandSha256 answered null\n")
      return 1
    }
    sum = fold(sum, okm)
  }
  report(sum, started)
  return 0
}

export const main = (): i32 => {
  const a: Args | null = parseArgs("hash")
  if (a === null) {
    return 2
  }
  if (a.kernel === "sha256") {
    return digestLoop(a, false)
  }
  if (a.kernel === "sha512") {
    return digestLoop(a, true)
  }
  if (a.kernel === "hmac-sha256") {
    return hmacLoop(a)
  }
  if (a.kernel === "hkdf-sha256") {
    return hkdfLoop(a)
  }
  writeError(`hash: no kernel ${a.kernel}\n`)
  return 2
}
