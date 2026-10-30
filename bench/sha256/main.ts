// The portable SHA-256 path's own benchmark: `sha256` on one message, and an
// HS256 JWT signed and verified, under bench/crypto/README.md's program
// contract. bench/sha256/run.mjs builds it with `--profile speed` and runs
//
//   main <kernel> <size> <iterations>
//
//   sha256 <size>   the one-shot digest of a <size>-byte message drawn by
//                   ../crypto/lib/gen, its first four bytes XORed with the
//                   iteration (the hash family's sha256 kernel)
//   hs256 0         a JWT of RFC 7519 §3.1's shape signed (RFC 7515
//                   §A.1's base64url header.payload under HMAC-SHA256) and
//                   then verified, the claims' `iat` the iteration
//
// Each prints the checksum of every output on stdout and the timed loop's
// nanoseconds on stderr.
import { base64urlDecode, base64urlEncode } from "nish/crypto/base64url"
import { hmacSha256, hmacSha256Verify } from "nish/crypto/hmac"
import { sha256 } from "nish/crypto/sha256"
import {
  Args,
  baseOf,
  fold,
  foldStart,
  Inputs,
  inputs,
  now,
  parseArgs,
  report,
  tweak,
} from "../crypto/lib/gen"

/** The protected header every token carries: `{"alg":"HS256","typ":"JWT"}`, encoded once. */
const HEADER: string = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"

/** The bytes of `text`, which is ASCII, as a JWS signing input is. */
const asciiBytes = (text: string): u8[] => {
  const out: u8[] = new Array<u8>(toI32(text.length))
  for (let i: i32 = 0; i < toI32(out.length); i++) {
    out[i] = toU8(text.charCodeAt(i))
  }
  return out
}

/** `sha256` over the message, `iterations` times. */
const digestLoop = (a: Args): i32 => {
  const inp: Inputs = inputs(a.kernel, a.size, 0, 0, 0, a.size)
  const msg: u8[] = inp.msg
  const base: u8[] = baseOf(msg, 0)
  let sum: u32 = foldStart()
  const started: i64 = now()
  for (let i: i32 = 0; i < a.iterations; i++) {
    tweak(msg, 0, base, i)
    sum = fold(sum, sha256(msg))
  }
  report(sum, started)
  return 0
}

/**
 * HS256 under a 32-byte key: each iteration signs a token for its own claims
 * and then verifies it as a receiver would, splitting at the second `.`,
 * decoding the signature and checking the tag over the signing input.
 */
const hs256Loop = (a: Args): i32 => {
  const inp: Inputs = inputs(a.kernel, a.size, 32, 0, 0, 0)
  const key: u8[] = inp.key
  let sum: u32 = foldStart()
  const started: i64 = now()
  for (let i: i32 = 0; i < a.iterations; i++) {
    const claims: string = `{"sub":"1234567890","name":"John Doe","admin":true,"iat":${1516239022 + i}}`
    const signingInput: string = `${HEADER}.${base64urlEncode(asciiBytes(claims))}`
    const token: string = `${signingInput}.${base64urlEncode(hmacSha256(key, asciiBytes(signingInput)))}`

    const dot: i32 = toI32(token.indexOf(".", toI32(HEADER.length) + 1))
    const signature: u8[] | null = base64urlDecode(token.slice(dot + 1))
    if (signature === null || !hmacSha256Verify(key, asciiBytes(token.slice(0, dot)), signature)) {
      writeError("sha256: an HS256 token failed to verify\n")
      return 1
    }
    sum = fold(sum, signature)
  }
  report(sum, started)
  return 0
}

export const main = (): i32 => {
  const a: Args | null = parseArgs("sha256")
  if (a === null) {
    return 2
  }
  if (a.kernel === "sha256") {
    return digestLoop(a)
  }
  if (a.kernel === "hs256") {
    return hs256Loop(a)
  }
  writeError(`sha256: no kernel ${a.kernel}\n`)
  return 2
}
