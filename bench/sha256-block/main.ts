// SHA-256's block function in ns a block, and the HMAC paths built on it, under
// bench/crypto/README.md's program contract. bench/sha256-block/run.mjs builds
// it with `--profile speed` and runs
//
//   main <kernel> <size> <iterations>
//
//   block <size>    `sha256` of a <size>-byte message from ../crypto/lib/gen,
//                   its first four bytes XORed with the iteration. A
//                   multiple of 64 compresses size / 64 + 1 blocks (the last
//                   is the padding), which run.mjs divides by.
//   hmac <size>     `hmacSha256` of a <size>-byte message under a 32-byte key:
//                   the one-shot HMAC-SHA256, its key's pads absorbed each call
//   hs256 0         a JWT signed with `jwtSignString` and verified with
//                   `JwtVerifier.verifyString` under an HS256 `JwtKey`: the
//                   `HmacKey` path (`hmacKeyedInto`, `hmacKeyedVerify`)
//   pbkdf2 <count>  `pbkdf2HmacSha256` at <count> iterations, 32 bytes out:
//                   every U_j resumes a hasher with `hmacCopySha256`
//
// Each prints the checksum of every output on stdout and the timed loop's
// nanoseconds on stderr.
import { hmacSha256, pbkdf2HmacSha256 } from "nish/crypto/hmac"
import { JWT_ALG_HS256, JWT_MAX_TOKEN, JWT_OK, JwtKey, JwtVerifier, jwtHmacKey, jwtSignString } from "nish/crypto/jwt"
import { sha256 } from "nish/crypto/sha256"
import { Secret, exposeWith, secret, wipe } from "nish:secret"
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

/** `sha256` over the message, `iterations` times. */
const blockLoop = (a: Args): i32 => {
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

/** `hmacSha256` over the message under a 32-byte key, `iterations` times. */
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

/** A copy of `bytes`, for `expose` to hand back. */
const copyBytes = (bytes: u8[]): u8[] => {
  const out: u8[] = new Array<u8>(toI32(bytes.length))
  for (let i: i32 = 0; i < toI32(out.length) && i < toI32(bytes.length); i++) {
    out[i] = bytes[i]
  }
  return out
}

/** `fold` over the UTF-16 units of `text`, low byte only: a token is ASCII. */
const foldText = (sum: u32, text: string): u32 => {
  let s: u32 = sum
  for (let i: i32 = 0; i < toI32(text.length); i++) {
    s = (s ^ (toU32(text.charCodeAt(i)) & 255)) * 16777619
  }
  return s
}

/** `fold(sum, plain)`, for `exposeWith` to run on a derived key. */
const foldPlain = (plain: u8[], sum: u32): u32 => fold(sum, plain)

/** An HS256 token signed and then verified, its claims' `iat` the iteration. */
const hs256Loop = (a: Args): i32 => {
  const inp: Inputs = inputs(a.kernel, a.size, 32, 0, 0, 0)
  const raw: Secret<u8[]> = secret(copyBytes(inp.key))
  const key: JwtKey | null = jwtHmacKey(JWT_ALG_HS256, raw)
  wipe(raw)
  if (key === null) {
    writeError("sha256-block: jwtHmacKey refused a 32-byte key\n")
    return 1
  }
  const v = new JwtVerifier(JWT_MAX_TOKEN)
  let sum: u32 = foldStart()
  const started: i64 = now()
  for (let i: i32 = 0; i < a.iterations; i++) {
    const token: string | null = jwtSignString(key, `{"sub":"1234567890","iat":${1516239022 + i},"exp":${1516242622 + i}}`)
    const status: i32 = token === null ? -100 : v.verifyString(key, token, toI64(1516239022 + i))
    if (token === null || status !== JWT_OK) {
      writeError(`sha256-block: an HS256 token failed to verify (${status})\n`)
      return 1
    }
    sum = foldText(sum, token)
  }
  report(sum, started)
  key.wipe()
  return 0
}

/** `pbkdf2HmacSha256` at `size` iterations, the salt's first bytes the iteration. */
const pbkdf2Loop = (a: Args): i32 => {
  const inp: Inputs = inputs(a.kernel, a.size, 32, 0, 0, 16)
  const salt: u8[] = inp.msg
  const base: u8[] = baseOf(salt, 0)
  const password: Secret<u8[]> = secret(copyBytes(inp.key))
  let sum: u32 = foldStart()
  const started: i64 = now()
  for (let i: i32 = 0; i < a.iterations; i++) {
    tweak(salt, 0, base, i)
    const dk: Secret<u8[]> | null = pbkdf2HmacSha256(password, salt, a.size, 32)
    if (dk === null) {
      wipe(password)
      writeError("sha256-block: pbkdf2HmacSha256 refused its request\n")
      return 1
    }
    sum = exposeWith(dk, sum, foldPlain)
    wipe(dk)
  }
  report(sum, started)
  wipe(password)
  return 0
}

export const main = (): i32 => {
  const a: Args | null = parseArgs("sha256-block")
  if (a === null) {
    return 2
  }
  if (a.kernel === "block") {
    return blockLoop(a)
  }
  if (a.kernel === "hmac") {
    return hmacLoop(a)
  }
  if (a.kernel === "hs256") {
    return hs256Loop(a)
  }
  if (a.kernel === "pbkdf2") {
    return pbkdf2Loop(a)
  }
  writeError(`sha256-block: no kernel ${a.kernel}\n`)
  return 2
}
