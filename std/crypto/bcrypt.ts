/**
 * `nish/crypto/bcrypt` — bcrypt password hashing, `$2b$` out and `$2a$`,
 * `$2b$`, `$2y$` in. It makes the hash libxcrypt's `crypt_r` and
 * crypt_blowfish make, and verifies as they do but for `$2x$` and a digest
 * character outside the alphabet. Where OpenBSD's `bcrypt.c` and Go's
 * `x/crypto` answer otherwise is the interoperability table in
 * docs/security/crypto-bcrypt.md.
 *
 *     import { bcryptHash, bcryptVerify } from "nish/crypto/bcrypt"
 *     import { Secret, secret } from "nish:secret"
 *
 *     const pw: Secret<u8[]> = secret(passwordBytes)
 *     const hash: Result<string, string> = bcryptHash(pw, randomBytes(16), 12)
 *     // "$2b$12$" + 22 salt characters + 31 digest characters
 *     const ok: Result<boolean, string> = bcryptVerify(pw, storedHash)
 *
 * **Several at once.** `bcryptHashN` and `bcryptVerifyN` take one to six
 * passwords (lane 0 always, a null lane skipped) and run their Blowfish
 * encryptions interleaved in one loop, so one core does the work of several
 * hashes in well under the time of as many; each result is the single path's,
 * byte for byte. `bcryptVerifyN` groups lanes by the cost their hash names,
 * and a malformed hash in any lane is an `Err` for the whole call, naming the
 * lane, before anything is hashed. `bcryptHash4` and `bcryptVerify4` are the
 * same for up to four. Which width is fastest depends on the core (how many
 * loads it issues a cycle, how much L1 the states fill), so `bcryptCalibrate`
 * measures it: it times widths one to six at cost 4 on throwaway passwords
 * and answers the one with the least time per hash. Call it once, at startup.
 *
 * **The password is a `Secret<u8[]>`** (`nish:secret`). The key schedule and
 * the 2^cost rounds run inside `exposeWith`; the Blowfish state (the P-array
 * and the four S-boxes, 1042 words), the expanded key and the key-stream copy
 * are wiped before it returns. `bcryptVerify` rebuilds the whole 60-character
 * hash and compares it with `timingSafeEqual` inside the same `exposeWith`,
 * then wipes the rebuilt hash and the given hash's bytes; the batch wipes its
 * state and digests and, in `bcryptVerifyN`, each lane's rebuilt and given
 * hash. The hash strings `bcryptHash` and `bcryptHashN` return are public and are not
 * wiped, nor are the bytes they are made from.
 *
 * **The key is the reference's.** The bytes up to the first NUL, then one NUL,
 * repeated until 72 bytes are taken: a password longer than 72 bytes hashes as
 * its first 72, and bytes after an embedded NUL are not read, as under
 * `crypt_r`; docs/security/crypto-bcrypt.md says why a longer password is cut
 * rather than refused. Bytes above 127 are unsigned, as `$2b$` and
 * `$2y$` define them. A `$2a$` hash gets crypt_blowfish's countermeasure for
 * the old sign-extension bug: when an 8-bit byte was sign-extended into a key
 * word and yet the buggy and the correct key came out equal, one bit of the
 * first P word is flipped, as crypt_blowfish flips it, so the `$2a$` digest of
 * such a password (`\xff\xff\xa3`) is not its `$2y$` one. It takes an 8-bit
 * byte after the first byte of a key word with only 0xff bytes before it, every
 * such byte in all 18 words being so placed, which UTF-8 never holds. `$2x$` (the bug itself) is refused.
 *
 * **Errors are `Err`s.** A salt that is not 16 bytes, a cost outside 4–31, or
 * a hash string that is not one (the wrong length, an unknown prefix, a cost
 * that is not two digits in range, a character outside the alphabet) is an
 * `Err` naming it. A well-formed hash that is not this password's is
 * `Ok(false)`, and so is one whose last salt character has bits set the
 * reference drops, since the hash the reference makes from it differs.
 *
 * **The cost comes from the hash.** `bcryptVerify` runs 2^cost rounds for the
 * cost the hash names, so a `$2b$31$` hash someone hands you takes 2^31
 * rounds, hours of one core. Verify only hashes you stored.
 *
 * **Pure.** No I/O and no C, so it builds for wasm32; `bcryptCalibrate`
 * alone reads the monotonic clock (`clock` in `--emit-capabilities`), and the
 * hashes never do. A `std/threads` task
 * may call `bcryptHash`, `bcryptVerify` and the batch: everything they wipe
 * is an array they made, never the caller's `hashes`, and the batch's state is
 * a `Secret` of a fresh array
 * (docs/security/crypto-bcrypt.md). A cost-12 hash takes a few hundred
 * milliseconds of one core; a server runs it off its event loop, on a task
 * (docs/guide/using-nish/password-hashing.md).
 *
 * The algorithm is Provos and Mazières's ("A Future-Adaptable Password
 * Scheme", USENIX 1999). The code is adapted from Solar Designer's
 * crypt_blowfish 1.3, which carries the notice below, and the 1042 initial
 * words, the hexadecimal digits of π, are its `BF_init_state`. Closest
 * upstream for each part: `bcryptInitState` is `BF_init_state`;
 * `bcryptEncrypt` and the rounds in `bcryptBody` are `BF_ENCRYPT`/`BF_ROUND`;
 * `bcryptBody` is `BF_body`; `bcryptSetKey` is `BF_set_key`; `bcryptDecodeSalt`
 * and `bcryptEncode` are `BF_decode` and `BF_encode`; `bcryptExposed` is the
 * part of `BF_crypt` after the setting is parsed, and `bcryptParse` that
 * parse. The state is one flat `u32[]` with P first (words 0–17) and the
 * S-boxes after (18–1041), so the body walks it in one pass, and every S-box
 * index is an `i32` masked to 0–255, which the checker proves in bounds
 * (`BCRYPT_STATE_WORDS`). The magic-string encryption, the parsing and the
 * alphabet are separate functions so a several-lane kernel can share them.
 *
 * Names carry the `bcrypt` prefix because a `std/` module's private functions
 * share the importing program's flat symbol namespace
 * (`docs/wp26-stdlib.md` §3e).
 *
 * Adapted from crypt_blowfish (https://www.openwall.com/crypt/), crypt_blowfish.c.
 * Written by Solar Designer, 1998-2014, and placed in the public domain, with a
 * permissive licence as the fallback; see std/crypto/LICENSE-crypt_blowfish.
 *
 * crypt_blowfish's notice, kept as it asks:
 *
 * Written by Solar Designer <solar at openwall.com> in 1998-2014.
 * No copyright is claimed, and the software is hereby placed in the public
 * domain.  In case this attempt to disclaim copyright and place the software
 * in the public domain is deemed null and void, then the software is
 * Copyright (c) 1998-2014 Solar Designer and it is hereby released to the
 * general public under the following terms:
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted.
 *
 * There's ABSOLUTELY NO WARRANTY, express or implied.
 *
 * It is my intent that you should be able to use this on your system,
 * as part of a software package, or anywhere else to improve security,
 * ensure compatibility, or for any other purpose.  I would appreciate
 * it if you give credit where it is due and keep your modifications in
 * the public domain as well, but I don't require that in order to let
 * you place this code and any modifications you make under a license
 * of your choice.
 *
 * This implementation is fully compatible with OpenBSD's bcrypt.c for prefix
 * "$2b$", originally by Niels Provos <provos at citi.umich.edu>, and it uses
 * some of his ideas.  The password hashing algorithm was designed by David
 * Mazieres <dm at lcs.mit.edu>.
 */

import { timingSafeEqual } from "nish/crypto/ct"
import { Secret, exposeWith, secret, wipe } from "nish:secret"
import { monotonicNanos } from "nish:process"

/** The length of a bcrypt hash string: `$2b$`, two cost digits, `$`, 22 salt and 31 digest characters. */
export const BCRYPT_HASH_LENGTH: i32 = 60

/** The length in bytes of a bcrypt salt. */
export const BCRYPT_SALT_SIZE: i32 = 16

/** The smallest cost the reference accepts: 2^4 rounds. */
export const BCRYPT_MIN_COST: i32 = 4

/** The largest cost: 2^31 rounds. */
export const BCRYPT_MAX_COST: i32 = 31

/** The number of password bytes the key schedule reads; the rest are not. */
export const BCRYPT_MAX_PASSWORD: i32 = 72

/**
 * The state's words: P (18) then S0–S3 (4 × 256). The guards before the
 * rounds and the key copy write 1042, 72 (`BCRYPT_MAX_PASSWORD`) and 16 as
 * literals: the range prover reads a literal bound, not a named constant, and
 * keeps every S-box bounds check without it.
 */
const BCRYPT_STATE_WORDS: i32 = 1042

/** The length of the setting, `$2b$NN$` and the 22 salt characters. */
const BCRYPT_SETTING_LENGTH: i32 = 29

/** What the hash needs besides the password, as one argument, since `exposeWith` hands on only one. */
interface BcryptSetting {
  /** The salt as four big-endian words. */
  salt: u32[]
  /** log2 of the round count, 4 to 31. */
  cost: i32
  /** 0x10000 for `$2a$`, whose countermeasure it enables; 0 for `$2b$` and `$2y$`. */
  safety: u32
}

/**
 * The one argument of the callbacks `exposeWith` runs on the password: the
 * setting, the 29 characters the hash starts with, and for verifying the hash
 * to compare with ("" when hashing). All of it is only read.
 */
interface BcryptJob {
  setting: BcryptSetting
  prefix: u8[]
  hash: string
}

/** A parsed hash string: its setting and the 29 characters the rebuilt hash starts with. */
interface BcryptParsed {
  setting: BcryptSetting
  prefix: u8[]
}

/**
 * All ones when `lo <= c <= hi`, else zero, without a branch: the encoding
 * reads the digest, which is the stored hash when the password is right. The
 * sums are in `u32`, as in `base64urlRangeMask` (std/crypto/base64url.ts), so
 * no overflow check branches on them.
 */
const bcryptRangeMask = (c: i32, lo: i32, hi: i32): i32 =>
  toI32((toU32(lo) - 1 - toU32(c)) & (toU32(c) - toU32(hi) - 1)) >> 31

/**
 * The bcrypt alphabet's character for the sextet `v`, `./A-Za-z0-9`: `.` + `v`,
 * plus the step to each range `v` has reached (2 lands on `A`, 28 on `a`, 54
 * on `0`).
 */
const bcryptCharOf = (v: i32): u8 =>
  toU8(
    46 +
      toU32(v) +
      toU32(bcryptRangeMask(v, 2, 63) & 17) +
      toU32(bcryptRangeMask(v, 28, 63) & 6) -
      toU32(bcryptRangeMask(v, 54, 63) & 75)
  )

/** The sextet of a bcrypt alphabet character, or -1 for any other byte, without a branch. */
const bcryptSextetOf = (c: i32): i32 => {
  const punct: i32 = bcryptRangeMask(c, 46, 47)
  const upper: i32 = bcryptRangeMask(c, 65, 90)
  const lower: i32 = bcryptRangeMask(c, 97, 122)
  const digit: i32 = bcryptRangeMask(c, 48, 57)
  const value: i32 =
    (punct & toI32(toU32(c) - 46)) |
    (upper & toI32(toU32(c) - 63)) |
    (lower & toI32(toU32(c) - 69)) |
    (digit & toI32(toU32(c) + 6))
  return value | ~(punct | upper | lower | digit)
}

/**
 * `BF_encode`: the first `n` bytes of `src` as bcrypt base64, three bytes to
 * four characters, and a one- or two-byte tail to two or three.
 */
const bcryptEncode = (src: u8[], n: i32): u8[] => {
  const out: u8[] = new Array<u8>((n * 4 + 2) / 3)
  bcryptEncodeInto(out, 0, src, n)
  return out
}

/**
 * `bcryptEncode` into `out` from `at`, as far as `out` reaches, so a digest's
 * characters land in an array the caller made and wipes.
 */
const bcryptEncodeInto = (out: u8[], at: i32, src: u8[], n: i32): void => {
  let i: i32 = 0
  let o: i32 = at
  while (i + 2 < n && i + 2 < toI32(src.length) && o >= 0 && o + 3 < toI32(out.length)) {
    const c1: i32 = toI32(src[i])
    const c2: i32 = toI32(src[i + 1])
    const c3: i32 = toI32(src[i + 2])
    out[o] = bcryptCharOf(c1 >> 2)
    out[o + 1] = bcryptCharOf(((c1 & 0x03) << 4) | (c2 >> 4))
    out[o + 2] = bcryptCharOf(((c2 & 0x0f) << 2) | (c3 >> 6))
    out[o + 3] = bcryptCharOf(c3 & 0x3f)
    i += 3
    o += 4
  }
  if (i >= 0 && i < n && i < toI32(src.length) && o >= 0 && o + 1 < toI32(out.length)) {
    const c1: i32 = toI32(src[i])
    out[o] = bcryptCharOf(c1 >> 2)
    if (i + 1 < n && i + 1 < toI32(src.length) && o + 2 < toI32(out.length)) {
      const c2: i32 = toI32(src[i + 1])
      out[o + 1] = bcryptCharOf(((c1 & 0x03) << 4) | (c2 >> 4))
      out[o + 2] = bcryptCharOf((c2 & 0x0f) << 2)
    } else {
      out[o + 1] = bcryptCharOf((c1 & 0x03) << 4)
    }
  }
}

/** `src` copied into `dst` from `at`, as far as `dst` reaches. */
const bcryptPut = (dst: u8[], at: i32, src: u8[]): void => {
  for (let k: i32 = 0; k < toI32(src.length); k++) {
    const o: i32 = at + k
    if (o >= 0 && o < toI32(dst.length)) {
      dst[o] = src[k]
    }
  }
}

/**
 * `BF_decode` of the 22 salt characters of `text` from `at`: the 16 bytes as
 * four big-endian words, or `null` if a character is outside the alphabet.
 * The 22nd character gives its top two bits only.
 */
const bcryptDecodeSalt = (text: string, at: i32): u32[] | null => {
  const sx: i32[] = new Array<i32>(22)
  for (let k: i32 = 0; k < toI32(sx.length); k++) {
    const p: i32 = at + k
    if (p < 0 || p >= toI32(text.length)) {
      return null
    }
    const v: i32 = bcryptSextetOf(toI32(text.charCodeAt(p)))
    if (v < 0) {
      return null
    }
    sx[k] = v
  }
  const bytes: u8[] = new Array<u8>(BCRYPT_SALT_SIZE)
  let s: i32 = 0
  let d: i32 = 0
  while (s + 3 < toI32(sx.length) && d + 2 < toI32(bytes.length)) {
    const c2: i32 = sx[s + 1]
    const c3: i32 = sx[s + 2]
    bytes[d] = toU8((sx[s] << 2) | ((c2 & 0x30) >> 4))
    bytes[d + 1] = toU8(((c2 & 0x0f) << 4) | ((c3 & 0x3c) >> 2))
    bytes[d + 2] = toU8(((c3 & 0x03) << 6) | sx[s + 3])
    s += 4
    d += 3
  }
  bytes[15] = toU8((sx[20] << 2) | ((sx[21] & 0x30) >> 4))
  return bcryptSaltWords(bytes)
}

/** Sixteen salt bytes as four big-endian words (`BF_swap`). */
const bcryptSaltWords = (bytes: u8[]): u32[] => {
  const words: u32[] = new Array<u32>(4)
  let w: i32 = 0
  for (let b: i32 = 0; b + 3 < toI32(bytes.length) && w < toI32(words.length); b += 4) {
    words[w] =
      (toU32(bytes[b]) << 24) | (toU32(bytes[b + 1]) << 16) | (toU32(bytes[b + 2]) << 8) | toU32(bytes[b + 3])
    w++
  }
  return words
}

/** `$2b$NN$` and the 22 salt characters for a cost and 16 salt bytes. */
const bcryptSettingOf = (salt: u8[], cost: i32): u8[] => {
  const out: u8[] = new Array<u8>(BCRYPT_SETTING_LENGTH)
  out[0] = 36
  out[1] = 50
  out[2] = 98
  out[3] = 36
  out[4] = toU8(cost / 10 + 48)
  out[5] = toU8((cost % 10) + 48)
  out[6] = 36
  bcryptPut(out, 7, bcryptEncode(salt, BCRYPT_SALT_SIZE))
  return out
}

/**
 * `BF_crypt`'s parse of a hash or setting: `$2a$`, `$2b$` or `$2y$`, two cost
 * digits from 04 to 31, `$` and 22 salt characters. The prefix it answers has
 * the last salt character canonical, its low four bits cleared, as the
 * reference writes it.
 */
const bcryptParse = (text: string): Result<BcryptParsed, string> => {
  if (toI32(text.length) < BCRYPT_SETTING_LENGTH) {
    return Err("bcrypt: hash too short")
  }
  const minor: i32 = toI32(text.charCodeAt(2))
  if (
    toI32(text.charCodeAt(0)) !== 36 ||
    toI32(text.charCodeAt(1)) !== 50 ||
    toI32(text.charCodeAt(3)) !== 36 ||
    (minor !== 97 && minor !== 98 && minor !== 121)
  ) {
    return Err("bcrypt: not a $2a$, $2b$ or $2y$ hash")
  }
  const d1: i32 = toI32(text.charCodeAt(4)) - 48
  const d2: i32 = toI32(text.charCodeAt(5)) - 48
  if (d1 < 0 || d1 > 9 || d2 < 0 || d2 > 9 || toI32(text.charCodeAt(6)) !== 36) {
    return Err("bcrypt: the cost is not two digits")
  }
  const cost: i32 = d1 * 10 + d2
  if (cost < BCRYPT_MIN_COST || cost > BCRYPT_MAX_COST) {
    return Err("bcrypt: the cost is outside 04 to 31")
  }
  const salt: u32[] | null = bcryptDecodeSalt(text, 7)
  if (salt === null) {
    return Err("bcrypt: the salt is not bcrypt base64")
  }
  const prefix: u8[] = new Array<u8>(BCRYPT_SETTING_LENGTH)
  for (let i: i32 = 0; i + 1 < toI32(prefix.length) && i < toI32(text.length); i++) {
    prefix[i] = toU8(text.charCodeAt(i))
  }
  prefix[28] = bcryptCharOf(bcryptSextetOf(toI32(text.charCodeAt(28))) & 0x30)
  const safety: u32 = minor === 97 ? 0x10000 : 0
  const setting: BcryptSetting = { salt: salt, cost: cost, safety: safety }
  const parsed: BcryptParsed = { setting: setting, prefix: prefix }
  return Ok(parsed)
}

/**
 * One Blowfish block, `lr[0]` and `lr[1]` in place (`BF_ENCRYPT`), under the
 * state `st`. The rounds are `bcryptBody`'s, which repeats them inline.
 */
const bcryptEncrypt = (st: u32[], lr: u32[]): void => {
  if (st.length < 1042) {
    return
  }
  if (lr.length < 2) {
    return
  }
  let l: u32 = lr[0] ^ st[0]
  let r: u32 = lr[1]
  for (let n: i32 = 1; n < 17; n += 2) {
    const la: i32 = toI32(l >>> 24) & 0xff
    const lb: i32 = toI32(l >>> 16) & 0xff
    const lc: i32 = toI32(l >>> 8) & 0xff
    const ld: i32 = toI32(l) & 0xff
    r = ctSelect(0xffffffff, r ^ st[n], 0) ^ (((st[18 + la] + st[274 + lb]) ^ st[530 + lc]) + st[786 + ld])
    const ra: i32 = toI32(r >>> 24) & 0xff
    const rb: i32 = toI32(r >>> 16) & 0xff
    const rc: i32 = toI32(r >>> 8) & 0xff
    const rd: i32 = toI32(r) & 0xff
    l =
      ctSelect(0xffffffff, l ^ st[n + 1], 0) ^ (((st[18 + ra] + st[274 + rb]) ^ st[530 + rc]) + st[786 + rd])
  }
  lr[0] = r ^ st[17]
  lr[1] = l
}

/**
 * `BF_body`: encrypt the zero block, then each result in turn, writing the
 * pairs over the whole state, P first and then the S-boxes. The hot loop:
 * 2^(cost+1) calls of 521 blocks each.
 *
 * Each half-round is `x ^ P[n] ^ F(y)`, and only `F(y)` waits on the previous
 * one, so `x ^ P[n]` belongs off the critical path with one XOR after the last
 * S-box add. Written plainly, LLVM's Reassociate and InstCombine put `P[n]`
 * after `F(y)` in 15 of 16 half-rounds, two dependent XORs instead of one
 * (docs/security/crypto-bcrypt.md, "Speed"). `ctSelect` with an all-ones mask
 * is `x ^ P[n]` itself, but behind the value barrier the mask is opaque, so the
 * `and` it leaves cannot be reassociated into the XOR chain: the half-round
 * keeps the order written, for one hoisted barrier and an `and` off the path.
 */
const bcryptBody = (st: u32[]): void => {
  if (st.length < 1042) {
    return
  }
  let l: u32 = 0
  let r: u32 = 0
  for (let i: i32 = 0; i + 1 < toI32(st.length); i += 2) {
    l ^= st[0]
    for (let n: i32 = 1; n < 17; n += 2) {
      const la: i32 = toI32(l >>> 24) & 0xff
      const lb: i32 = toI32(l >>> 16) & 0xff
      const lc: i32 = toI32(l >>> 8) & 0xff
      const ld: i32 = toI32(l) & 0xff
      r = ctSelect(0xffffffff, r ^ st[n], 0) ^ (((st[18 + la] + st[274 + lb]) ^ st[530 + lc]) + st[786 + ld])
      const ra: i32 = toI32(r >>> 24) & 0xff
      const rb: i32 = toI32(r >>> 16) & 0xff
      const rc: i32 = toI32(r >>> 8) & 0xff
      const rd: i32 = toI32(r) & 0xff
      l =
        ctSelect(0xffffffff, l ^ st[n + 1], 0) ^
        (((st[18 + ra] + st[274 + rb]) ^ st[530 + rc]) + st[786 + rd])
    }
    const t: u32 = r
    r = l
    l = t ^ st[17]
    st[i] = l
    st[i + 1] = r
  }
}

/**
 * `BF_set_key`'s key: the 18 expanded-key words into `expanded[0..17]`, and
 * the word P[0] is XORed with into `expanded[18]`, for `password` read as its
 * bytes to the first NUL and one NUL, repeated. `safety` is 0x10000 for `$2a$`
 * and 0 otherwise: for `$2a$` the key is also built with each byte
 * sign-extended, as the old bug built it, and if an 8-bit byte was
 * sign-extended into a word (`sign`) yet the two keys came out equal (`diff`
 * is 0), `expanded[18]` is bit 16, which flips it in P[0] as crypt_blowfish
 * flips it. All of it is computed without a branch on a password byte: only
 * the copy's length and the cycle position, which follow the password's length
 * and NULs, decide a load.
 */
const bcryptKeySchedule = (expanded: u32[], password: u8[], safety: u32): void => {
  if (expanded.length < 19) {
    return
  }
  // The key stream: at most 72 bytes of the password and zeros after, so the
  // cycle below reads a NUL at 72 at the latest without testing the length.
  // It is 128 long so that the position, masked to 7 bits, needs no check.
  const key: u8[] = new Array<u8>(128)
  for (let i: i32 = 0; i < toI32(password.length) && i < 72; i++) {
    key[i] = password[i]
  }
  let p: i32 = 0
  let sign: u32 = 0
  let diff: u32 = 0
  for (let i: i32 = 0; i < 18; i++) {
    let correct: u32 = 0
    let buggy: u32 = 0
    for (let j: i32 = 0; j < 4; j++) {
      const q: i32 = p & 0x7f
      const c: i32 = toI32(key[q])
      correct = (correct << 8) | toU32(c)
      buggy = (buggy << 8) | ((toU32(c) ^ 0x80) - 0x80)
      if (j !== 0) {
        sign |= buggy & 0x80
      }
      // The next position, or 0 after a NUL: 1 if c is nonzero, else 0.
      p = (p + 1) * ((c | -c) >>> 31)
    }
    diff |= correct ^ buggy
    expanded[i] = correct
  }
  diff |= diff >>> 16
  diff &= 0xffff
  diff += 0xffff
  sign <<= 9
  sign &= ~diff & safety
  expanded[18] = sign
  wipe(key)
}

/** `BF_set_key`: `bcryptKeySchedule` into `expanded`, and P XORed with it. */
const bcryptSetKey = (st: u32[], expanded: u32[], password: u8[], safety: u32): void => {
  bcryptKeySchedule(expanded, password, safety)
  if (st.length < 1042) {
    return
  }
  if (expanded.length < 19) {
    return
  }
  for (let i: i32 = 0; i < 18; i++) {
    st[i] ^= expanded[i]
  }
  st[0] ^= expanded[18]
}

/**
 * The 1042 words of `st` from `at` set to the state Blowfish starts from: P
 * then S0–S3, the digits of π (`BF_init_state`). The caller allocates `st`,
 * so that the wipe of it is a wipe of memory the hashing function made, which
 * a `std/threads` task may do.
 */
const bcryptInitState = (st: u32[], at: i32): void => {
  const init: u32[] = [
    // P
    0x243f6a88, 0x85a308d3, 0x13198a2e, 0x03707344, 0xa4093822, 0x299f31d0, 0x082efa98, 0xec4e6c89,
    0x452821e6, 0x38d01377, 0xbe5466cf, 0x34e90c6c, 0xc0ac29b7, 0xc97c50dd, 0x3f84d5b5, 0xb5470917,
    0x9216d5d9, 0x8979fb1b,
    // S0
    0xd1310ba6, 0x98dfb5ac, 0x2ffd72db, 0xd01adfb7, 0xb8e1afed, 0x6a267e96, 0xba7c9045, 0xf12c7f99,
    0x24a19947, 0xb3916cf7, 0x0801f2e2, 0x858efc16, 0x636920d8, 0x71574e69, 0xa458fea3, 0xf4933d7e,
    0x0d95748f, 0x728eb658, 0x718bcd58, 0x82154aee, 0x7b54a41d, 0xc25a59b5, 0x9c30d539, 0x2af26013,
    0xc5d1b023, 0x286085f0, 0xca417918, 0xb8db38ef, 0x8e79dcb0, 0x603a180e, 0x6c9e0e8b, 0xb01e8a3e,
    0xd71577c1, 0xbd314b27, 0x78af2fda, 0x55605c60, 0xe65525f3, 0xaa55ab94, 0x57489862, 0x63e81440,
    0x55ca396a, 0x2aab10b6, 0xb4cc5c34, 0x1141e8ce, 0xa15486af, 0x7c72e993, 0xb3ee1411, 0x636fbc2a,
    0x2ba9c55d, 0x741831f6, 0xce5c3e16, 0x9b87931e, 0xafd6ba33, 0x6c24cf5c, 0x7a325381, 0x28958677,
    0x3b8f4898, 0x6b4bb9af, 0xc4bfe81b, 0x66282193, 0x61d809cc, 0xfb21a991, 0x487cac60, 0x5dec8032,
    0xef845d5d, 0xe98575b1, 0xdc262302, 0xeb651b88, 0x23893e81, 0xd396acc5, 0x0f6d6ff3, 0x83f44239,
    0x2e0b4482, 0xa4842004, 0x69c8f04a, 0x9e1f9b5e, 0x21c66842, 0xf6e96c9a, 0x670c9c61, 0xabd388f0,
    0x6a51a0d2, 0xd8542f68, 0x960fa728, 0xab5133a3, 0x6eef0b6c, 0x137a3be4, 0xba3bf050, 0x7efb2a98,
    0xa1f1651d, 0x39af0176, 0x66ca593e, 0x82430e88, 0x8cee8619, 0x456f9fb4, 0x7d84a5c3, 0x3b8b5ebe,
    0xe06f75d8, 0x85c12073, 0x401a449f, 0x56c16aa6, 0x4ed3aa62, 0x363f7706, 0x1bfedf72, 0x429b023d,
    0x37d0d724, 0xd00a1248, 0xdb0fead3, 0x49f1c09b, 0x075372c9, 0x80991b7b, 0x25d479d8, 0xf6e8def7,
    0xe3fe501a, 0xb6794c3b, 0x976ce0bd, 0x04c006ba, 0xc1a94fb6, 0x409f60c4, 0x5e5c9ec2, 0x196a2463,
    0x68fb6faf, 0x3e6c53b5, 0x1339b2eb, 0x3b52ec6f, 0x6dfc511f, 0x9b30952c, 0xcc814544, 0xaf5ebd09,
    0xbee3d004, 0xde334afd, 0x660f2807, 0x192e4bb3, 0xc0cba857, 0x45c8740f, 0xd20b5f39, 0xb9d3fbdb,
    0x5579c0bd, 0x1a60320a, 0xd6a100c6, 0x402c7279, 0x679f25fe, 0xfb1fa3cc, 0x8ea5e9f8, 0xdb3222f8,
    0x3c7516df, 0xfd616b15, 0x2f501ec8, 0xad0552ab, 0x323db5fa, 0xfd238760, 0x53317b48, 0x3e00df82,
    0x9e5c57bb, 0xca6f8ca0, 0x1a87562e, 0xdf1769db, 0xd542a8f6, 0x287effc3, 0xac6732c6, 0x8c4f5573,
    0x695b27b0, 0xbbca58c8, 0xe1ffa35d, 0xb8f011a0, 0x10fa3d98, 0xfd2183b8, 0x4afcb56c, 0x2dd1d35b,
    0x9a53e479, 0xb6f84565, 0xd28e49bc, 0x4bfb9790, 0xe1ddf2da, 0xa4cb7e33, 0x62fb1341, 0xcee4c6e8,
    0xef20cada, 0x36774c01, 0xd07e9efe, 0x2bf11fb4, 0x95dbda4d, 0xae909198, 0xeaad8e71, 0x6b93d5a0,
    0xd08ed1d0, 0xafc725e0, 0x8e3c5b2f, 0x8e7594b7, 0x8ff6e2fb, 0xf2122b64, 0x8888b812, 0x900df01c,
    0x4fad5ea0, 0x688fc31c, 0xd1cff191, 0xb3a8c1ad, 0x2f2f2218, 0xbe0e1777, 0xea752dfe, 0x8b021fa1,
    0xe5a0cc0f, 0xb56f74e8, 0x18acf3d6, 0xce89e299, 0xb4a84fe0, 0xfd13e0b7, 0x7cc43b81, 0xd2ada8d9,
    0x165fa266, 0x80957705, 0x93cc7314, 0x211a1477, 0xe6ad2065, 0x77b5fa86, 0xc75442f5, 0xfb9d35cf,
    0xebcdaf0c, 0x7b3e89a0, 0xd6411bd3, 0xae1e7e49, 0x00250e2d, 0x2071b35e, 0x226800bb, 0x57b8e0af,
    0x2464369b, 0xf009b91e, 0x5563911d, 0x59dfa6aa, 0x78c14389, 0xd95a537f, 0x207d5ba2, 0x02e5b9c5,
    0x83260376, 0x6295cfa9, 0x11c81968, 0x4e734a41, 0xb3472dca, 0x7b14a94a, 0x1b510052, 0x9a532915,
    0xd60f573f, 0xbc9bc6e4, 0x2b60a476, 0x81e67400, 0x08ba6fb5, 0x571be91f, 0xf296ec6b, 0x2a0dd915,
    0xb6636521, 0xe7b9f9b6, 0xff34052e, 0xc5855664, 0x53b02d5d, 0xa99f8fa1, 0x08ba4799, 0x6e85076a,
    // S1
    0x4b7a70e9, 0xb5b32944, 0xdb75092e, 0xc4192623, 0xad6ea6b0, 0x49a7df7d, 0x9cee60b8, 0x8fedb266,
    0xecaa8c71, 0x699a17ff, 0x5664526c, 0xc2b19ee1, 0x193602a5, 0x75094c29, 0xa0591340, 0xe4183a3e,
    0x3f54989a, 0x5b429d65, 0x6b8fe4d6, 0x99f73fd6, 0xa1d29c07, 0xefe830f5, 0x4d2d38e6, 0xf0255dc1,
    0x4cdd2086, 0x8470eb26, 0x6382e9c6, 0x021ecc5e, 0x09686b3f, 0x3ebaefc9, 0x3c971814, 0x6b6a70a1,
    0x687f3584, 0x52a0e286, 0xb79c5305, 0xaa500737, 0x3e07841c, 0x7fdeae5c, 0x8e7d44ec, 0x5716f2b8,
    0xb03ada37, 0xf0500c0d, 0xf01c1f04, 0x0200b3ff, 0xae0cf51a, 0x3cb574b2, 0x25837a58, 0xdc0921bd,
    0xd19113f9, 0x7ca92ff6, 0x94324773, 0x22f54701, 0x3ae5e581, 0x37c2dadc, 0xc8b57634, 0x9af3dda7,
    0xa9446146, 0x0fd0030e, 0xecc8c73e, 0xa4751e41, 0xe238cd99, 0x3bea0e2f, 0x3280bba1, 0x183eb331,
    0x4e548b38, 0x4f6db908, 0x6f420d03, 0xf60a04bf, 0x2cb81290, 0x24977c79, 0x5679b072, 0xbcaf89af,
    0xde9a771f, 0xd9930810, 0xb38bae12, 0xdccf3f2e, 0x5512721f, 0x2e6b7124, 0x501adde6, 0x9f84cd87,
    0x7a584718, 0x7408da17, 0xbc9f9abc, 0xe94b7d8c, 0xec7aec3a, 0xdb851dfa, 0x63094366, 0xc464c3d2,
    0xef1c1847, 0x3215d908, 0xdd433b37, 0x24c2ba16, 0x12a14d43, 0x2a65c451, 0x50940002, 0x133ae4dd,
    0x71dff89e, 0x10314e55, 0x81ac77d6, 0x5f11199b, 0x043556f1, 0xd7a3c76b, 0x3c11183b, 0x5924a509,
    0xf28fe6ed, 0x97f1fbfa, 0x9ebabf2c, 0x1e153c6e, 0x86e34570, 0xeae96fb1, 0x860e5e0a, 0x5a3e2ab3,
    0x771fe71c, 0x4e3d06fa, 0x2965dcb9, 0x99e71d0f, 0x803e89d6, 0x5266c825, 0x2e4cc978, 0x9c10b36a,
    0xc6150eba, 0x94e2ea78, 0xa5fc3c53, 0x1e0a2df4, 0xf2f74ea7, 0x361d2b3d, 0x1939260f, 0x19c27960,
    0x5223a708, 0xf71312b6, 0xebadfe6e, 0xeac31f66, 0xe3bc4595, 0xa67bc883, 0xb17f37d1, 0x018cff28,
    0xc332ddef, 0xbe6c5aa5, 0x65582185, 0x68ab9802, 0xeecea50f, 0xdb2f953b, 0x2aef7dad, 0x5b6e2f84,
    0x1521b628, 0x29076170, 0xecdd4775, 0x619f1510, 0x13cca830, 0xeb61bd96, 0x0334fe1e, 0xaa0363cf,
    0xb5735c90, 0x4c70a239, 0xd59e9e0b, 0xcbaade14, 0xeecc86bc, 0x60622ca7, 0x9cab5cab, 0xb2f3846e,
    0x648b1eaf, 0x19bdf0ca, 0xa02369b9, 0x655abb50, 0x40685a32, 0x3c2ab4b3, 0x319ee9d5, 0xc021b8f7,
    0x9b540b19, 0x875fa099, 0x95f7997e, 0x623d7da8, 0xf837889a, 0x97e32d77, 0x11ed935f, 0x16681281,
    0x0e358829, 0xc7e61fd6, 0x96dedfa1, 0x7858ba99, 0x57f584a5, 0x1b227263, 0x9b83c3ff, 0x1ac24696,
    0xcdb30aeb, 0x532e3054, 0x8fd948e4, 0x6dbc3128, 0x58ebf2ef, 0x34c6ffea, 0xfe28ed61, 0xee7c3c73,
    0x5d4a14d9, 0xe864b7e3, 0x42105d14, 0x203e13e0, 0x45eee2b6, 0xa3aaabea, 0xdb6c4f15, 0xfacb4fd0,
    0xc742f442, 0xef6abbb5, 0x654f3b1d, 0x41cd2105, 0xd81e799e, 0x86854dc7, 0xe44b476a, 0x3d816250,
    0xcf62a1f2, 0x5b8d2646, 0xfc8883a0, 0xc1c7b6a3, 0x7f1524c3, 0x69cb7492, 0x47848a0b, 0x5692b285,
    0x095bbf00, 0xad19489d, 0x1462b174, 0x23820e00, 0x58428d2a, 0x0c55f5ea, 0x1dadf43e, 0x233f7061,
    0x3372f092, 0x8d937e41, 0xd65fecf1, 0x6c223bdb, 0x7cde3759, 0xcbee7460, 0x4085f2a7, 0xce77326e,
    0xa6078084, 0x19f8509e, 0xe8efd855, 0x61d99735, 0xa969a7aa, 0xc50c06c2, 0x5a04abfc, 0x800bcadc,
    0x9e447a2e, 0xc3453484, 0xfdd56705, 0x0e1e9ec9, 0xdb73dbd3, 0x105588cd, 0x675fda79, 0xe3674340,
    0xc5c43465, 0x713e38d8, 0x3d28f89e, 0xf16dff20, 0x153e21e7, 0x8fb03d4a, 0xe6e39f2b, 0xdb83adf7,
    // S2
    0xe93d5a68, 0x948140f7, 0xf64c261c, 0x94692934, 0x411520f7, 0x7602d4f7, 0xbcf46b2e, 0xd4a20068,
    0xd4082471, 0x3320f46a, 0x43b7d4b7, 0x500061af, 0x1e39f62e, 0x97244546, 0x14214f74, 0xbf8b8840,
    0x4d95fc1d, 0x96b591af, 0x70f4ddd3, 0x66a02f45, 0xbfbc09ec, 0x03bd9785, 0x7fac6dd0, 0x31cb8504,
    0x96eb27b3, 0x55fd3941, 0xda2547e6, 0xabca0a9a, 0x28507825, 0x530429f4, 0x0a2c86da, 0xe9b66dfb,
    0x68dc1462, 0xd7486900, 0x680ec0a4, 0x27a18dee, 0x4f3ffea2, 0xe887ad8c, 0xb58ce006, 0x7af4d6b6,
    0xaace1e7c, 0xd3375fec, 0xce78a399, 0x406b2a42, 0x20fe9e35, 0xd9f385b9, 0xee39d7ab, 0x3b124e8b,
    0x1dc9faf7, 0x4b6d1856, 0x26a36631, 0xeae397b2, 0x3a6efa74, 0xdd5b4332, 0x6841e7f7, 0xca7820fb,
    0xfb0af54e, 0xd8feb397, 0x454056ac, 0xba489527, 0x55533a3a, 0x20838d87, 0xfe6ba9b7, 0xd096954b,
    0x55a867bc, 0xa1159a58, 0xcca92963, 0x99e1db33, 0xa62a4a56, 0x3f3125f9, 0x5ef47e1c, 0x9029317c,
    0xfdf8e802, 0x04272f70, 0x80bb155c, 0x05282ce3, 0x95c11548, 0xe4c66d22, 0x48c1133f, 0xc70f86dc,
    0x07f9c9ee, 0x41041f0f, 0x404779a4, 0x5d886e17, 0x325f51eb, 0xd59bc0d1, 0xf2bcc18f, 0x41113564,
    0x257b7834, 0x602a9c60, 0xdff8e8a3, 0x1f636c1b, 0x0e12b4c2, 0x02e1329e, 0xaf664fd1, 0xcad18115,
    0x6b2395e0, 0x333e92e1, 0x3b240b62, 0xeebeb922, 0x85b2a20e, 0xe6ba0d99, 0xde720c8c, 0x2da2f728,
    0xd0127845, 0x95b794fd, 0x647d0862, 0xe7ccf5f0, 0x5449a36f, 0x877d48fa, 0xc39dfd27, 0xf33e8d1e,
    0x0a476341, 0x992eff74, 0x3a6f6eab, 0xf4f8fd37, 0xa812dc60, 0xa1ebddf8, 0x991be14c, 0xdb6e6b0d,
    0xc67b5510, 0x6d672c37, 0x2765d43b, 0xdcd0e804, 0xf1290dc7, 0xcc00ffa3, 0xb5390f92, 0x690fed0b,
    0x667b9ffb, 0xcedb7d9c, 0xa091cf0b, 0xd9155ea3, 0xbb132f88, 0x515bad24, 0x7b9479bf, 0x763bd6eb,
    0x37392eb3, 0xcc115979, 0x8026e297, 0xf42e312d, 0x6842ada7, 0xc66a2b3b, 0x12754ccc, 0x782ef11c,
    0x6a124237, 0xb79251e7, 0x06a1bbe6, 0x4bfb6350, 0x1a6b1018, 0x11caedfa, 0x3d25bdd8, 0xe2e1c3c9,
    0x44421659, 0x0a121386, 0xd90cec6e, 0xd5abea2a, 0x64af674e, 0xda86a85f, 0xbebfe988, 0x64e4c3fe,
    0x9dbc8057, 0xf0f7c086, 0x60787bf8, 0x6003604d, 0xd1fd8346, 0xf6381fb0, 0x7745ae04, 0xd736fccc,
    0x83426b33, 0xf01eab71, 0xb0804187, 0x3c005e5f, 0x77a057be, 0xbde8ae24, 0x55464299, 0xbf582e61,
    0x4e58f48f, 0xf2ddfda2, 0xf474ef38, 0x8789bdc2, 0x5366f9c3, 0xc8b38e74, 0xb475f255, 0x46fcd9b9,
    0x7aeb2661, 0x8b1ddf84, 0x846a0e79, 0x915f95e2, 0x466e598e, 0x20b45770, 0x8cd55591, 0xc902de4c,
    0xb90bace1, 0xbb8205d0, 0x11a86248, 0x7574a99e, 0xb77f19b6, 0xe0a9dc09, 0x662d09a1, 0xc4324633,
    0xe85a1f02, 0x09f0be8c, 0x4a99a025, 0x1d6efe10, 0x1ab93d1d, 0x0ba5a4df, 0xa186f20f, 0x2868f169,
    0xdcb7da83, 0x573906fe, 0xa1e2ce9b, 0x4fcd7f52, 0x50115e01, 0xa70683fa, 0xa002b5c4, 0x0de6d027,
    0x9af88c27, 0x773f8641, 0xc3604c06, 0x61a806b5, 0xf0177a28, 0xc0f586e0, 0x006058aa, 0x30dc7d62,
    0x11e69ed7, 0x2338ea63, 0x53c2dd94, 0xc2c21634, 0xbbcbee56, 0x90bcb6de, 0xebfc7da1, 0xce591d76,
    0x6f05e409, 0x4b7c0188, 0x39720a3d, 0x7c927c24, 0x86e3725f, 0x724d9db9, 0x1ac15bb4, 0xd39eb8fc,
    0xed545578, 0x08fca5b5, 0xd83d7cd3, 0x4dad0fc4, 0x1e50ef5e, 0xb161e6f8, 0xa28514d9, 0x6c51133c,
    0x6fd5c7e7, 0x56e14ec4, 0x362abfce, 0xddc6c837, 0xd79a3234, 0x92638212, 0x670efa8e, 0x406000e0,
    // S3
    0x3a39ce37, 0xd3faf5cf, 0xabc27737, 0x5ac52d1b, 0x5cb0679e, 0x4fa33742, 0xd3822740, 0x99bc9bbe,
    0xd5118e9d, 0xbf0f7315, 0xd62d1c7e, 0xc700c47b, 0xb78c1b6b, 0x21a19045, 0xb26eb1be, 0x6a366eb4,
    0x5748ab2f, 0xbc946e79, 0xc6a376d2, 0x6549c2c8, 0x530ff8ee, 0x468dde7d, 0xd5730a1d, 0x4cd04dc6,
    0x2939bbdb, 0xa9ba4650, 0xac9526e8, 0xbe5ee304, 0xa1fad5f0, 0x6a2d519a, 0x63ef8ce2, 0x9a86ee22,
    0xc089c2b8, 0x43242ef6, 0xa51e03aa, 0x9cf2d0a4, 0x83c061ba, 0x9be96a4d, 0x8fe51550, 0xba645bd6,
    0x2826a2f9, 0xa73a3ae1, 0x4ba99586, 0xef5562e9, 0xc72fefd3, 0xf752f7da, 0x3f046f69, 0x77fa0a59,
    0x80e4a915, 0x87b08601, 0x9b09e6ad, 0x3b3ee593, 0xe990fd5a, 0x9e34d797, 0x2cf0b7d9, 0x022b8b51,
    0x96d5ac3a, 0x017da67d, 0xd1cf3ed6, 0x7c7d2d28, 0x1f9f25cf, 0xadf2b89b, 0x5ad6b472, 0x5a88f54c,
    0xe029ac71, 0xe019a5e6, 0x47b0acfd, 0xed93fa9b, 0xe8d3c48d, 0x283b57cc, 0xf8d56629, 0x79132e28,
    0x785f0191, 0xed756055, 0xf7960e44, 0xe3d35e8c, 0x15056dd4, 0x88f46dba, 0x03a16125, 0x0564f0bd,
    0xc3eb9e15, 0x3c9057a2, 0x97271aec, 0xa93a072a, 0x1b3f6d9b, 0x1e6321f5, 0xf59c66fb, 0x26dcf319,
    0x7533d928, 0xb155fdf5, 0x03563482, 0x8aba3cbb, 0x28517711, 0xc20ad9f8, 0xabcc5167, 0xccad925f,
    0x4de81751, 0x3830dc8e, 0x379d5862, 0x9320f991, 0xea7a90c2, 0xfb3e7bce, 0x5121ce64, 0x774fbe32,
    0xa8b6e37e, 0xc3293d46, 0x48de5369, 0x6413e680, 0xa2ae0810, 0xdd6db224, 0x69852dfd, 0x09072166,
    0xb39a460a, 0x6445c0dd, 0x586cdecf, 0x1c20c8ae, 0x5bbef7dd, 0x1b588d40, 0xccd2017f, 0x6bb4e3bb,
    0xdda26a7e, 0x3a59ff45, 0x3e350a44, 0xbcb4cdd5, 0x72eacea8, 0xfa6484bb, 0x8d6612ae, 0xbf3c6f47,
    0xd29be463, 0x542f5d9e, 0xaec2771b, 0xf64e6370, 0x740e0d8d, 0xe75b1357, 0xf8721671, 0xaf537d5d,
    0x4040cb08, 0x4eb4e2cc, 0x34d2466a, 0x0115af84, 0xe1b00428, 0x95983a1d, 0x06b89fb4, 0xce6ea048,
    0x6f3f3b82, 0x3520ab82, 0x011a1d4b, 0x277227f8, 0x611560b1, 0xe7933fdc, 0xbb3a792b, 0x344525bd,
    0xa08839e1, 0x51ce794b, 0x2f32c9b7, 0xa01fbac9, 0xe01cc87e, 0xbcc7d1f6, 0xcf0111c3, 0xa1e8aac7,
    0x1a908749, 0xd44fbd9a, 0xd0dadecb, 0xd50ada38, 0x0339c32a, 0xc6913667, 0x8df9317c, 0xe0b12b4f,
    0xf79e59b7, 0x43f5bb3a, 0xf2d519ff, 0x27d9459c, 0xbf97222c, 0x15e6fc2a, 0x0f91fc71, 0x9b941525,
    0xfae59361, 0xceb69ceb, 0xc2a86459, 0x12baa8d1, 0xb6c1075e, 0xe3056a0c, 0x10d25065, 0xcb03a442,
    0xe0ec6e0e, 0x1698db3b, 0x4c98a0be, 0x3278e964, 0x9f1f9532, 0xe0d392df, 0xd3a0342b, 0x8971f21e,
    0x1b0a7441, 0x4ba3348c, 0xc5be7120, 0xc37632d8, 0xdf359f8d, 0x9b992f2e, 0xe60b6f47, 0x0fe3f11d,
    0xe54cda54, 0x1edad891, 0xce6279cf, 0xcd3e7e6f, 0x1618b166, 0xfd2c1d05, 0x848fd2c5, 0xf6fb2299,
    0xf523f357, 0xa6327623, 0x93a83531, 0x56cccd02, 0xacf08162, 0x5a75ebb5, 0x6e163697, 0x88d273cc,
    0xde966292, 0x81b949d0, 0x4c50901b, 0x71c65614, 0xe6c6c7bd, 0x327a140a, 0x45e1d006, 0xc3f27b9a,
    0xc9aa53fd, 0x62a80f00, 0xbb25bfe2, 0x35bdd2f6, 0x71126905, 0xb2040222, 0xb6cbcf7c, 0xcd769c2b,
    0x53113ec0, 0x1640e3d3, 0x38abbd60, 0x2547adf0, 0xba38209c, 0xf746ce76, 0x77afa1c5, 0x20756060,
    0x85cbfe4e, 0x8ae88dd8, 0x7aaaf9b0, 0x4cf9aa7e, 0x1948c25c, 0x02fb8a8c, 0x01c36ae4, 0xd6ebe1f9,
    0x90d4f869, 0xa65cdea0, 0x3f09252d, 0xc208e69f, 0xb74e6132, 0xce77e25b, 0x578fdfe3, 0x3ac372e6,
  ]
  if (at < 0) {
    return
  }
  for (let i: i32 = 0; i < toI32(init.length) && at + i < toI32(st.length); i++) {
    st[at + i] = init[i]
  }
}

/** The block `lr` into `st` at `at` and `at + 1`. */
const bcryptStore = (st: u32[], at: i32, lr: u32[]): void => {
  if (lr.length < 2) {
    return
  }
  if (at >= 0 && at + 1 < toI32(st.length)) {
    st[at] = lr[0]
    st[at + 1] = lr[1]
  }
}

/** P XORed with the expanded key: the first half of a cost round. */
const bcryptXorKey = (st: u32[], expanded: u32[]): void => {
  if (st.length < 18) {
    return
  }
  if (expanded.length < 18) {
    return
  }
  for (let i: i32 = 0; i < 18; i++) {
    st[i] ^= expanded[i]
  }
}

/** The 18 P words at `at` XORed with the salt words, repeated: the second half of a cost round. */
const bcryptXorSalt = (st: u32[], at: i32, s0: u32, s1: u32, s2: u32, s3: u32): void => {
  if (at < 0 || at + 17 >= toI32(st.length)) {
    return
  }
  for (let i: i32 = 0; i + 3 < 16; i += 4) {
    st[at + i] ^= s0
    st[at + i + 1] ^= s1
    st[at + i + 2] ^= s2
    st[at + i + 3] ^= s3
  }
  st[at + 16] ^= s0
  st[at + 17] ^= s1
}

/**
 * The hash itself, on the plain password: the 31 digest characters (`BF_crypt`
 * from the key schedule on) into `out` at 29, which the caller made and wipes.
 * The state, the expanded key, the block and the raw digest are wiped before
 * it returns.
 */
const bcryptExposed = (password: u8[], setting: BcryptSetting, out: u8[]): void => {
  const salt: u32[] = setting.salt
  if (salt.length < 4) {
    return
  }
  const s0: u32 = salt[0]
  const s1: u32 = salt[1]
  const s2: u32 = salt[2]
  const s3: u32 = salt[3]
  const st: u32[] = new Array<u32>(BCRYPT_STATE_WORDS)
  bcryptInitState(st, 0)
  const expanded: u32[] = new Array<u32>(19)
  const lr: u32[] = new Array<u32>(2)
  bcryptSetKey(st, expanded, password, setting.safety)

  // The salted expansion: each block is XORed with a salt half before it is
  // encrypted, the first half and the second in turn (`BF_crypt`'s two loops).
  for (let i: i32 = 0; i < BCRYPT_STATE_WORDS; i += 2) {
    const odd: boolean = (i & 2) !== 0
    lr[0] ^= odd ? s2 : s0
    lr[1] ^= odd ? s3 : s1
    bcryptEncrypt(st, lr)
    bcryptStore(st, i, lr)
  }

  // 2^cost rounds of the key, then the salt, re-keying the whole state.
  let rounds: u32 = toU32(1) << toU32(setting.cost)
  while (rounds !== 0) {
    bcryptXorKey(st, expanded)
    bcryptBody(st)
    bcryptXorSalt(st, 0, s0, s1, s2, s3)
    bcryptBody(st)
    rounds -= 1
  }

  // "OrpheanBeholderScryDoubt", each pair encrypted 64 times, big-endian.
  const digest: u8[] = new Array<u8>(24)
  bcryptMagic(st, lr, digest, 0, 0x4f727068, 0x65616e42)
  bcryptMagic(st, lr, digest, 8, 0x65686f6c, 0x64657253)
  bcryptMagic(st, lr, digest, 16, 0x63727944, 0x6f756274)
  // 23 of the 24 bytes, as the reference encodes them.
  bcryptEncodeInto(out, BCRYPT_SETTING_LENGTH, digest, 23)
  wipe(st)
  wipe(expanded)
  wipe(lr)
  wipe(digest)
}

/** One pair of the magic string, encrypted 64 times under `st`, into `dst` at `at` as eight big-endian bytes. */
const bcryptMagic = (st: u32[], lr: u32[], dst: u8[], at: i32, l: u32, r: u32): void => {
  lr[0] = l
  lr[1] = r
  for (let k: i32 = 0; k < 64; k++) {
    bcryptEncrypt(st, lr)
  }
  bcryptPutBlock(dst, at, lr[0], lr[1])
}

/** The block `l`, `r` into `dst` at `at` as eight big-endian bytes; nothing when it does not fit. */
const bcryptPutBlock = (dst: u8[], at: i32, l: u32, r: u32): void => {
  if (at < 0 || at + 7 >= toI32(dst.length)) {
    return
  }
  dst[at] = toU8(l >>> 24)
  dst[at + 1] = toU8((l >>> 16) & 0xff)
  dst[at + 2] = toU8((l >>> 8) & 0xff)
  dst[at + 3] = toU8(l & 0xff)
  dst[at + 4] = toU8(r >>> 24)
  dst[at + 5] = toU8((r >>> 16) & 0xff)
  dst[at + 6] = toU8((r >>> 8) & 0xff)
  dst[at + 7] = toU8(r & 0xff)
}

/**
 * The 60-byte hash of the plain password under `job`'s setting into `out`,
 * which the caller made and wipes: the 29-byte setting, then the digest.
 */
const bcryptHashInto = (password: u8[], job: BcryptJob, out: u8[]): void => {
  bcryptPut(out, 0, job.prefix)
  bcryptExposed(password, job.setting, out)
}

/**
 * The 60 bytes of the hash, for `exposeWith` on the password. They are the
 * hash `bcryptHash` returns, so they are not secret and are not wiped.
 */
const bcryptHashExposed = (password: u8[], job: BcryptJob): u8[] => {
  const out: u8[] = new Array<u8>(BCRYPT_HASH_LENGTH)
  bcryptHashInto(password, job, out)
  return out
}

/**
 * Whether the hash rebuilt from the plain password is `job.hash`, for
 * `exposeWith` on the password.
 */
const bcryptVerifyExposed = (password: u8[], job: BcryptJob): boolean => {
  const expected: u8[] = new Array<u8>(BCRYPT_HASH_LENGTH)
  bcryptHashInto(password, job, expected)
  return bcryptSameWiped(expected, job.hash)
}

/**
 * Whether the 60 bytes of `rebuilt` are `hash`'s: a constant-time compare.
 * `rebuilt` and the copy of `hash` made here are both wiped, so the answer is
 * all that leaves.
 */
const bcryptSameWiped = (rebuilt: u8[], hash: string): boolean => {
  const given: u8[] = new Array<u8>(BCRYPT_HASH_LENGTH)
  bcryptBytesOf(given, hash)
  const same: boolean = timingSafeEqual(rebuilt, given)
  wipe(rebuilt)
  wipe(given)
  return same
}

/**
 * The `$2b$` hash of `password` with a 16-byte `salt` and 2^`cost` rounds:
 * 60 characters, `$2b$`, the two-digit cost, `$`, the salt and the digest in
 * bcrypt's base64. The salt must come from a CSPRNG and be fresh for each
 * hash. An `Err` for a salt of another length or a cost outside 4–31.
 */
export const bcryptHash = (password: Secret<u8[]>, salt: u8[], cost: i32): Result<string, string> => {
  if (salt.length !== 16) {
    return Err("bcrypt: the salt is not 16 bytes")
  }
  if (cost < BCRYPT_MIN_COST || cost > BCRYPT_MAX_COST) {
    return Err("bcrypt: the cost is outside 4 to 31")
  }
  const setting: BcryptSetting = { salt: bcryptSaltWords(salt), cost: cost, safety: toU32(0) }
  const job: BcryptJob = { setting: setting, prefix: bcryptSettingOf(salt, cost), hash: "" }
  const out: u8[] = exposeWith(password, job, bcryptHashExposed)
  return Ok(String.fromBytes(out, 0, BCRYPT_HASH_LENGTH))
}

/**
 * Whether `hash` is `password`'s: `Ok(true)` or `Ok(false)`, decided by a
 * constant-time compare of all 60 characters with the hash rebuilt from the
 * password and `hash`'s own prefix, salt and cost. `$2a$`, `$2b$` and `$2y$`
 * are read; an `Err` names what makes `hash` not a bcrypt hash.
 */
export const bcryptVerify = (password: Secret<u8[]>, hash: string): Result<boolean, string> => {
  const parsed: Result<BcryptParsed, string> = bcryptParseHash(hash)
  if (parsed.isErr()) {
    return Err(parsed.error)
  }
  return Ok(bcryptVerifyOne(password, parsed.value, hash))
}

/** Whether `hash`, parsed as `parsed`, is `password`'s. */
const bcryptVerifyOne = (password: Secret<u8[]>, parsed: BcryptParsed, hash: string): boolean => {
  const job: BcryptJob = { setting: parsed.setting, prefix: parsed.prefix, hash: hash }
  return exposeWith(password, job, bcryptVerifyExposed)
}

/**
 * `hash` parsed for verifying: 60 characters, its setting well-formed and its
 * digest in bcrypt's base64, or an `Err` naming what is not.
 */
const bcryptParseHash = (hash: string): Result<BcryptParsed, string> => {
  if (hash.length !== 60) {
    return Err("bcrypt: a hash is 60 characters")
  }
  const parsed: Result<BcryptParsed, string> = bcryptParse(hash)
  if (parsed.isErr()) {
    return Err(parsed.error)
  }
  let alphabet: i32 = 0
  for (let i: i32 = 0; i < toI32(hash.length); i++) {
    if (i >= BCRYPT_SETTING_LENGTH) {
      alphabet |= bcryptSextetOf(toI32(hash.charCodeAt(i)))
    }
  }
  if (alphabet < 0) {
    return Err("bcrypt: the digest is not bcrypt base64")
  }
  return parsed
}

/** The 60 characters of a hash `bcryptParseHash` accepted, as bytes into `given`, which the caller made and wipes. */
const bcryptBytesOf = (given: u8[], hash: string): void => {
  for (let i: i32 = 0; i < toI32(given.length) && i < toI32(hash.length); i++) {
    given[i] = toU8(hash.charCodeAt(i))
  }
}

// ---------------------------------------------------------------------------
// The batch, two to six lanes on one thread. Up to six independent hashes
// share one `Secret<u32[]>`: the lane in slot s has its Blowfish state at
// 1042s (0–6251), its expanded key at 6252 + 18s and its `$2a$` safety word at
// 6360 + s. The lanes a caller gives are packed into slots 0 to w - 1, so a
// batch of w passwords runs the w-lane kernel whatever positions they came in.
// One exposeWith per password XORs that lane's key in, and one more runs the
// expansion, the 2^cost rounds and the magic string. The cost rounds, all but
// 713 of a hash's 2^(cost+1) × 521 + 713 blocks, run on all w lanes at once
// with their encryption chains interleaved round by round, so the S-box loads
// of one lane overlap the others' and the core is not left waiting on one
// chain's latency; the expansion and the magic string run lane by lane.
// ---------------------------------------------------------------------------

/** The most lanes a batch runs. */
const BCRYPT_BATCH_LANES: i32 = 6
/** Where the six expanded keys of 18 start in the batch state, after the six Blowfish states. */
const BCRYPT_BATCH_KEYS: i32 = 6252
/** Where the six safety words start, after the keys. */
const BCRYPT_BATCH_SAFETY: i32 = 6360
/** Words in the batch state: six Blowfish states, six expanded keys of 18 and six safety words. */
const BCRYPT_BATCH_WORDS: i32 = 6366

/**
 * What the batch kernel reads besides the state, slot by slot: each slot's
 * four salt words (slot s at 4s), each slot's `$2a$` safety word, the shared
 * cost, the number of slots that run, each slot's 29-character setting and,
 * for verifying, each slot's hash to compare with.
 */
interface BcryptBatch {
  salts: u32[]
  safety: u32[]
  cost: i32
  width: i32
  prefixes: u8[][]
  hashes: string[]
}

/** The six states set to π and each slot's safety word stored, for `exposeWith` on the fresh batch state. */
const bcryptInitN = (st: u32[], batch: BcryptBatch): i32 => {
  if (st.length < 6366) {
    return 0
  }
  const safety: u32[] = batch.safety
  for (let k: i32 = 0; k < BCRYPT_BATCH_LANES; k++) {
    bcryptInitState(st, k * BCRYPT_STATE_WORDS)
    st[BCRYPT_BATCH_SAFETY + k] = k < toI32(safety.length) ? safety[k] : 0
  }
  return 0
}

/**
 * Word `arg & 31` of `bcryptKeySchedule` for `password`, with the `$2a$`
 * safety when bit 5 of `arg` is set. The schedule is built in a fresh array
 * and wiped here, so the one word is all that leaves the `exposeWith`.
 */
const bcryptKeyWord = (password: u8[], arg: i32): u32 => {
  const expanded: u32[] = new Array<u32>(19)
  const safety: u32 = (arg & 32) !== 0 ? 0x10000 : 0
  bcryptKeySchedule(expanded, password, safety)
  const k: i32 = arg & 31
  const word: u32 = k < 19 ? expanded[k] : 0
  wipe(expanded)
  return word
}

/**
 * The key of the lane in slot `slot` into the batch state: P XORed with it
 * as `bcryptSetKey` XORs it, and the 18 words kept for the cost rounds. Each
 * word is one `exposeWith` on the password, since the state is what this
 * function is exposing and a `Secret` cannot be handed into it otherwise.
 */
const bcryptLoadLane = (st: u32[], password: Secret<u8[]>, slot: i32): i32 => {
  if (st.length < 6366) {
    return 0
  }
  if (slot < 0 || slot >= BCRYPT_BATCH_LANES) {
    return 0
  }
  const at: i32 = slot * BCRYPT_STATE_WORDS
  const kept: i32 = slot * 18 + BCRYPT_BATCH_KEYS
  const flag: i32 = st[BCRYPT_BATCH_SAFETY + slot] !== 0 ? 32 : 0
  for (let k: i32 = 0; k < 18; k++) {
    const word: u32 = exposeWith(password, k | flag, bcryptKeyWord)
    st[at + k] ^= word
    st[kept + k] = word
  }
  st[at] ^= exposeWith(password, 18 | flag, bcryptKeyWord)
  return 0
}

/** `bcryptLoadLane` for slot 0, in the shape `exposeWith` calls. */
const bcryptLoadLane0 = (st: u32[], password: Secret<u8[]>): i32 => bcryptLoadLane(st, password, 0)

/** `bcryptLoadLane` for slot 1. */
const bcryptLoadLane1 = (st: u32[], password: Secret<u8[]>): i32 => bcryptLoadLane(st, password, 1)

/** `bcryptLoadLane` for slot 2. */
const bcryptLoadLane2 = (st: u32[], password: Secret<u8[]>): i32 => bcryptLoadLane(st, password, 2)

/** `bcryptLoadLane` for slot 3. */
const bcryptLoadLane3 = (st: u32[], password: Secret<u8[]>): i32 => bcryptLoadLane(st, password, 3)

/** `bcryptLoadLane` for slot 4. */
const bcryptLoadLane4 = (st: u32[], password: Secret<u8[]>): i32 => bcryptLoadLane(st, password, 4)

/** `bcryptLoadLane` for slot 5. */
const bcryptLoadLane5 = (st: u32[], password: Secret<u8[]>): i32 => bcryptLoadLane(st, password, 5)

/** `password` into slot `slot` of the batch `state`. */
const bcryptLoadSlot = (state: Secret<u32[]>, password: Secret<u8[]>, slot: i32): void => {
  if (slot === 0) {
    exposeWith(state, password, bcryptLoadLane0)
  } else if (slot === 1) {
    exposeWith(state, password, bcryptLoadLane1)
  } else if (slot === 2) {
    exposeWith(state, password, bcryptLoadLane2)
  } else if (slot === 3) {
    exposeWith(state, password, bcryptLoadLane3)
  } else if (slot === 4) {
    exposeWith(state, password, bcryptLoadLane4)
  } else if (slot === 5) {
    exposeWith(state, password, bcryptLoadLane5)
  }
}

// The cost-round kernels, one per width. Each is `bcryptBody4`'s text with
// the lane count changed (bench/crypto/bcrypt/gen-body.mjs writes them), not
// one loop over a lane count: the lanes' l and r must live in registers and
// their loads be scheduled together, which a loop over an array of lanes
// does not give.

/** `bcryptBody4`'s interleave on two lanes. */
const bcryptBody2 = (st: u32[]): void => {
  if (st.length < 2084) {
    return
  }
  let l0: u32 = 0
  let r0: u32 = 0
  let l1: u32 = 0
  let r1: u32 = 0
  for (let i: i32 = 0; i + 1 < 1042; i += 2) {
    l0 ^= st[0]
    l1 ^= st[1042]
    for (let n: i32 = 1; n < 17; n += 2) {
      const l0a: i32 = toI32(l0 >>> 24) & 0xff
      const l0b: i32 = toI32(l0 >>> 16) & 0xff
      const l0c: i32 = toI32(l0 >>> 8) & 0xff
      const l0d: i32 = toI32(l0) & 0xff
      const l1a: i32 = toI32(l1 >>> 24) & 0xff
      const l1b: i32 = toI32(l1 >>> 16) & 0xff
      const l1c: i32 = toI32(l1 >>> 8) & 0xff
      const l1d: i32 = toI32(l1) & 0xff
      r0 ^= st[n] ^ (((st[18 + l0a] + st[274 + l0b]) ^ st[530 + l0c]) + st[786 + l0d])
      r1 ^= st[1042 + n] ^ (((st[1060 + l1a] + st[1316 + l1b]) ^ st[1572 + l1c]) + st[1828 + l1d])
      const r0a: i32 = toI32(r0 >>> 24) & 0xff
      const r0b: i32 = toI32(r0 >>> 16) & 0xff
      const r0c: i32 = toI32(r0 >>> 8) & 0xff
      const r0d: i32 = toI32(r0) & 0xff
      const r1a: i32 = toI32(r1 >>> 24) & 0xff
      const r1b: i32 = toI32(r1 >>> 16) & 0xff
      const r1c: i32 = toI32(r1 >>> 8) & 0xff
      const r1d: i32 = toI32(r1) & 0xff
      l0 ^= st[n + 1] ^ (((st[18 + r0a] + st[274 + r0b]) ^ st[530 + r0c]) + st[786 + r0d])
      l1 ^= st[1042 + n + 1] ^ (((st[1060 + r1a] + st[1316 + r1b]) ^ st[1572 + r1c]) + st[1828 + r1d])
    }
    const t0: u32 = r0
    r0 = l0
    l0 = t0 ^ st[17]
    st[i] = l0
    st[i + 1] = r0
    const t1: u32 = r1
    r1 = l1
    l1 = t1 ^ st[1059]
    st[1042 + i] = l1
    st[1042 + i + 1] = r1
  }
}

/** `bcryptBody4`'s interleave on three lanes. */
const bcryptBody3 = (st: u32[]): void => {
  if (st.length < 3126) {
    return
  }
  let l0: u32 = 0
  let r0: u32 = 0
  let l1: u32 = 0
  let r1: u32 = 0
  let l2: u32 = 0
  let r2: u32 = 0
  for (let i: i32 = 0; i + 1 < 1042; i += 2) {
    l0 ^= st[0]
    l1 ^= st[1042]
    l2 ^= st[2084]
    for (let n: i32 = 1; n < 17; n += 2) {
      const l0a: i32 = toI32(l0 >>> 24) & 0xff
      const l0b: i32 = toI32(l0 >>> 16) & 0xff
      const l0c: i32 = toI32(l0 >>> 8) & 0xff
      const l0d: i32 = toI32(l0) & 0xff
      const l1a: i32 = toI32(l1 >>> 24) & 0xff
      const l1b: i32 = toI32(l1 >>> 16) & 0xff
      const l1c: i32 = toI32(l1 >>> 8) & 0xff
      const l1d: i32 = toI32(l1) & 0xff
      const l2a: i32 = toI32(l2 >>> 24) & 0xff
      const l2b: i32 = toI32(l2 >>> 16) & 0xff
      const l2c: i32 = toI32(l2 >>> 8) & 0xff
      const l2d: i32 = toI32(l2) & 0xff
      r0 ^= st[n] ^ (((st[18 + l0a] + st[274 + l0b]) ^ st[530 + l0c]) + st[786 + l0d])
      r1 ^= st[1042 + n] ^ (((st[1060 + l1a] + st[1316 + l1b]) ^ st[1572 + l1c]) + st[1828 + l1d])
      r2 ^= st[2084 + n] ^ (((st[2102 + l2a] + st[2358 + l2b]) ^ st[2614 + l2c]) + st[2870 + l2d])
      const r0a: i32 = toI32(r0 >>> 24) & 0xff
      const r0b: i32 = toI32(r0 >>> 16) & 0xff
      const r0c: i32 = toI32(r0 >>> 8) & 0xff
      const r0d: i32 = toI32(r0) & 0xff
      const r1a: i32 = toI32(r1 >>> 24) & 0xff
      const r1b: i32 = toI32(r1 >>> 16) & 0xff
      const r1c: i32 = toI32(r1 >>> 8) & 0xff
      const r1d: i32 = toI32(r1) & 0xff
      const r2a: i32 = toI32(r2 >>> 24) & 0xff
      const r2b: i32 = toI32(r2 >>> 16) & 0xff
      const r2c: i32 = toI32(r2 >>> 8) & 0xff
      const r2d: i32 = toI32(r2) & 0xff
      l0 ^= st[n + 1] ^ (((st[18 + r0a] + st[274 + r0b]) ^ st[530 + r0c]) + st[786 + r0d])
      l1 ^= st[1042 + n + 1] ^ (((st[1060 + r1a] + st[1316 + r1b]) ^ st[1572 + r1c]) + st[1828 + r1d])
      l2 ^= st[2084 + n + 1] ^ (((st[2102 + r2a] + st[2358 + r2b]) ^ st[2614 + r2c]) + st[2870 + r2d])
    }
    const t0: u32 = r0
    r0 = l0
    l0 = t0 ^ st[17]
    st[i] = l0
    st[i + 1] = r0
    const t1: u32 = r1
    r1 = l1
    l1 = t1 ^ st[1059]
    st[1042 + i] = l1
    st[1042 + i + 1] = r1
    const t2: u32 = r2
    r2 = l2
    l2 = t2 ^ st[2101]
    st[2084 + i] = l2
    st[2084 + i + 1] = r2
  }
}

/**
 * `bcryptBody` on all four lanes at once: each lane's state re-encrypted in
 * place, the four encryption chains interleaved round by round so that one
 * lane's S-box loads overlap the others' instead of waiting on their own. The
 * hot loop of the batch: 2^(cost+1) calls of 521 blocks per lane.
 */
const bcryptBody4 = (st: u32[]): void => {
  if (st.length < 4168) {
    return
  }
  let l0: u32 = 0
  let r0: u32 = 0
  let l1: u32 = 0
  let r1: u32 = 0
  let l2: u32 = 0
  let r2: u32 = 0
  let l3: u32 = 0
  let r3: u32 = 0
  for (let i: i32 = 0; i + 1 < 1042; i += 2) {
    l0 ^= st[0]
    l1 ^= st[1042]
    l2 ^= st[2084]
    l3 ^= st[3126]
    for (let n: i32 = 1; n < 17; n += 2) {
      const l0a: i32 = toI32(l0 >>> 24) & 0xff
      const l0b: i32 = toI32(l0 >>> 16) & 0xff
      const l0c: i32 = toI32(l0 >>> 8) & 0xff
      const l0d: i32 = toI32(l0) & 0xff
      const l1a: i32 = toI32(l1 >>> 24) & 0xff
      const l1b: i32 = toI32(l1 >>> 16) & 0xff
      const l1c: i32 = toI32(l1 >>> 8) & 0xff
      const l1d: i32 = toI32(l1) & 0xff
      const l2a: i32 = toI32(l2 >>> 24) & 0xff
      const l2b: i32 = toI32(l2 >>> 16) & 0xff
      const l2c: i32 = toI32(l2 >>> 8) & 0xff
      const l2d: i32 = toI32(l2) & 0xff
      const l3a: i32 = toI32(l3 >>> 24) & 0xff
      const l3b: i32 = toI32(l3 >>> 16) & 0xff
      const l3c: i32 = toI32(l3 >>> 8) & 0xff
      const l3d: i32 = toI32(l3) & 0xff
      r0 ^= st[n] ^ (((st[18 + l0a] + st[274 + l0b]) ^ st[530 + l0c]) + st[786 + l0d])
      r1 ^= st[1042 + n] ^ (((st[1060 + l1a] + st[1316 + l1b]) ^ st[1572 + l1c]) + st[1828 + l1d])
      r2 ^= st[2084 + n] ^ (((st[2102 + l2a] + st[2358 + l2b]) ^ st[2614 + l2c]) + st[2870 + l2d])
      r3 ^= st[3126 + n] ^ (((st[3144 + l3a] + st[3400 + l3b]) ^ st[3656 + l3c]) + st[3912 + l3d])
      const r0a: i32 = toI32(r0 >>> 24) & 0xff
      const r0b: i32 = toI32(r0 >>> 16) & 0xff
      const r0c: i32 = toI32(r0 >>> 8) & 0xff
      const r0d: i32 = toI32(r0) & 0xff
      const r1a: i32 = toI32(r1 >>> 24) & 0xff
      const r1b: i32 = toI32(r1 >>> 16) & 0xff
      const r1c: i32 = toI32(r1 >>> 8) & 0xff
      const r1d: i32 = toI32(r1) & 0xff
      const r2a: i32 = toI32(r2 >>> 24) & 0xff
      const r2b: i32 = toI32(r2 >>> 16) & 0xff
      const r2c: i32 = toI32(r2 >>> 8) & 0xff
      const r2d: i32 = toI32(r2) & 0xff
      const r3a: i32 = toI32(r3 >>> 24) & 0xff
      const r3b: i32 = toI32(r3 >>> 16) & 0xff
      const r3c: i32 = toI32(r3 >>> 8) & 0xff
      const r3d: i32 = toI32(r3) & 0xff
      l0 ^= st[n + 1] ^ (((st[18 + r0a] + st[274 + r0b]) ^ st[530 + r0c]) + st[786 + r0d])
      l1 ^= st[1042 + n + 1] ^ (((st[1060 + r1a] + st[1316 + r1b]) ^ st[1572 + r1c]) + st[1828 + r1d])
      l2 ^= st[2084 + n + 1] ^ (((st[2102 + r2a] + st[2358 + r2b]) ^ st[2614 + r2c]) + st[2870 + r2d])
      l3 ^= st[3126 + n + 1] ^ (((st[3144 + r3a] + st[3400 + r3b]) ^ st[3656 + r3c]) + st[3912 + r3d])
    }
    const t0: u32 = r0
    r0 = l0
    l0 = t0 ^ st[17]
    st[i] = l0
    st[i + 1] = r0
    const t1: u32 = r1
    r1 = l1
    l1 = t1 ^ st[1059]
    st[1042 + i] = l1
    st[1042 + i + 1] = r1
    const t2: u32 = r2
    r2 = l2
    l2 = t2 ^ st[2101]
    st[2084 + i] = l2
    st[2084 + i + 1] = r2
    const t3: u32 = r3
    r3 = l3
    l3 = t3 ^ st[3143]
    st[3126 + i] = l3
    st[3126 + i + 1] = r3
  }
}

/** `bcryptBody4`'s interleave on five lanes. */
const bcryptBody5 = (st: u32[]): void => {
  if (st.length < 5210) {
    return
  }
  let l0: u32 = 0
  let r0: u32 = 0
  let l1: u32 = 0
  let r1: u32 = 0
  let l2: u32 = 0
  let r2: u32 = 0
  let l3: u32 = 0
  let r3: u32 = 0
  let l4: u32 = 0
  let r4: u32 = 0
  for (let i: i32 = 0; i + 1 < 1042; i += 2) {
    l0 ^= st[0]
    l1 ^= st[1042]
    l2 ^= st[2084]
    l3 ^= st[3126]
    l4 ^= st[4168]
    for (let n: i32 = 1; n < 17; n += 2) {
      const l0a: i32 = toI32(l0 >>> 24) & 0xff
      const l0b: i32 = toI32(l0 >>> 16) & 0xff
      const l0c: i32 = toI32(l0 >>> 8) & 0xff
      const l0d: i32 = toI32(l0) & 0xff
      const l1a: i32 = toI32(l1 >>> 24) & 0xff
      const l1b: i32 = toI32(l1 >>> 16) & 0xff
      const l1c: i32 = toI32(l1 >>> 8) & 0xff
      const l1d: i32 = toI32(l1) & 0xff
      const l2a: i32 = toI32(l2 >>> 24) & 0xff
      const l2b: i32 = toI32(l2 >>> 16) & 0xff
      const l2c: i32 = toI32(l2 >>> 8) & 0xff
      const l2d: i32 = toI32(l2) & 0xff
      const l3a: i32 = toI32(l3 >>> 24) & 0xff
      const l3b: i32 = toI32(l3 >>> 16) & 0xff
      const l3c: i32 = toI32(l3 >>> 8) & 0xff
      const l3d: i32 = toI32(l3) & 0xff
      const l4a: i32 = toI32(l4 >>> 24) & 0xff
      const l4b: i32 = toI32(l4 >>> 16) & 0xff
      const l4c: i32 = toI32(l4 >>> 8) & 0xff
      const l4d: i32 = toI32(l4) & 0xff
      r0 ^= st[n] ^ (((st[18 + l0a] + st[274 + l0b]) ^ st[530 + l0c]) + st[786 + l0d])
      r1 ^= st[1042 + n] ^ (((st[1060 + l1a] + st[1316 + l1b]) ^ st[1572 + l1c]) + st[1828 + l1d])
      r2 ^= st[2084 + n] ^ (((st[2102 + l2a] + st[2358 + l2b]) ^ st[2614 + l2c]) + st[2870 + l2d])
      r3 ^= st[3126 + n] ^ (((st[3144 + l3a] + st[3400 + l3b]) ^ st[3656 + l3c]) + st[3912 + l3d])
      r4 ^= st[4168 + n] ^ (((st[4186 + l4a] + st[4442 + l4b]) ^ st[4698 + l4c]) + st[4954 + l4d])
      const r0a: i32 = toI32(r0 >>> 24) & 0xff
      const r0b: i32 = toI32(r0 >>> 16) & 0xff
      const r0c: i32 = toI32(r0 >>> 8) & 0xff
      const r0d: i32 = toI32(r0) & 0xff
      const r1a: i32 = toI32(r1 >>> 24) & 0xff
      const r1b: i32 = toI32(r1 >>> 16) & 0xff
      const r1c: i32 = toI32(r1 >>> 8) & 0xff
      const r1d: i32 = toI32(r1) & 0xff
      const r2a: i32 = toI32(r2 >>> 24) & 0xff
      const r2b: i32 = toI32(r2 >>> 16) & 0xff
      const r2c: i32 = toI32(r2 >>> 8) & 0xff
      const r2d: i32 = toI32(r2) & 0xff
      const r3a: i32 = toI32(r3 >>> 24) & 0xff
      const r3b: i32 = toI32(r3 >>> 16) & 0xff
      const r3c: i32 = toI32(r3 >>> 8) & 0xff
      const r3d: i32 = toI32(r3) & 0xff
      const r4a: i32 = toI32(r4 >>> 24) & 0xff
      const r4b: i32 = toI32(r4 >>> 16) & 0xff
      const r4c: i32 = toI32(r4 >>> 8) & 0xff
      const r4d: i32 = toI32(r4) & 0xff
      l0 ^= st[n + 1] ^ (((st[18 + r0a] + st[274 + r0b]) ^ st[530 + r0c]) + st[786 + r0d])
      l1 ^= st[1042 + n + 1] ^ (((st[1060 + r1a] + st[1316 + r1b]) ^ st[1572 + r1c]) + st[1828 + r1d])
      l2 ^= st[2084 + n + 1] ^ (((st[2102 + r2a] + st[2358 + r2b]) ^ st[2614 + r2c]) + st[2870 + r2d])
      l3 ^= st[3126 + n + 1] ^ (((st[3144 + r3a] + st[3400 + r3b]) ^ st[3656 + r3c]) + st[3912 + r3d])
      l4 ^= st[4168 + n + 1] ^ (((st[4186 + r4a] + st[4442 + r4b]) ^ st[4698 + r4c]) + st[4954 + r4d])
    }
    const t0: u32 = r0
    r0 = l0
    l0 = t0 ^ st[17]
    st[i] = l0
    st[i + 1] = r0
    const t1: u32 = r1
    r1 = l1
    l1 = t1 ^ st[1059]
    st[1042 + i] = l1
    st[1042 + i + 1] = r1
    const t2: u32 = r2
    r2 = l2
    l2 = t2 ^ st[2101]
    st[2084 + i] = l2
    st[2084 + i + 1] = r2
    const t3: u32 = r3
    r3 = l3
    l3 = t3 ^ st[3143]
    st[3126 + i] = l3
    st[3126 + i + 1] = r3
    const t4: u32 = r4
    r4 = l4
    l4 = t4 ^ st[4185]
    st[4168 + i] = l4
    st[4168 + i + 1] = r4
  }
}

/** `bcryptBody4`'s interleave on six lanes. */
const bcryptBody6 = (st: u32[]): void => {
  if (st.length < 6252) {
    return
  }
  let l0: u32 = 0
  let r0: u32 = 0
  let l1: u32 = 0
  let r1: u32 = 0
  let l2: u32 = 0
  let r2: u32 = 0
  let l3: u32 = 0
  let r3: u32 = 0
  let l4: u32 = 0
  let r4: u32 = 0
  let l5: u32 = 0
  let r5: u32 = 0
  for (let i: i32 = 0; i + 1 < 1042; i += 2) {
    l0 ^= st[0]
    l1 ^= st[1042]
    l2 ^= st[2084]
    l3 ^= st[3126]
    l4 ^= st[4168]
    l5 ^= st[5210]
    for (let n: i32 = 1; n < 17; n += 2) {
      const l0a: i32 = toI32(l0 >>> 24) & 0xff
      const l0b: i32 = toI32(l0 >>> 16) & 0xff
      const l0c: i32 = toI32(l0 >>> 8) & 0xff
      const l0d: i32 = toI32(l0) & 0xff
      const l1a: i32 = toI32(l1 >>> 24) & 0xff
      const l1b: i32 = toI32(l1 >>> 16) & 0xff
      const l1c: i32 = toI32(l1 >>> 8) & 0xff
      const l1d: i32 = toI32(l1) & 0xff
      const l2a: i32 = toI32(l2 >>> 24) & 0xff
      const l2b: i32 = toI32(l2 >>> 16) & 0xff
      const l2c: i32 = toI32(l2 >>> 8) & 0xff
      const l2d: i32 = toI32(l2) & 0xff
      const l3a: i32 = toI32(l3 >>> 24) & 0xff
      const l3b: i32 = toI32(l3 >>> 16) & 0xff
      const l3c: i32 = toI32(l3 >>> 8) & 0xff
      const l3d: i32 = toI32(l3) & 0xff
      const l4a: i32 = toI32(l4 >>> 24) & 0xff
      const l4b: i32 = toI32(l4 >>> 16) & 0xff
      const l4c: i32 = toI32(l4 >>> 8) & 0xff
      const l4d: i32 = toI32(l4) & 0xff
      const l5a: i32 = toI32(l5 >>> 24) & 0xff
      const l5b: i32 = toI32(l5 >>> 16) & 0xff
      const l5c: i32 = toI32(l5 >>> 8) & 0xff
      const l5d: i32 = toI32(l5) & 0xff
      r0 ^= st[n] ^ (((st[18 + l0a] + st[274 + l0b]) ^ st[530 + l0c]) + st[786 + l0d])
      r1 ^= st[1042 + n] ^ (((st[1060 + l1a] + st[1316 + l1b]) ^ st[1572 + l1c]) + st[1828 + l1d])
      r2 ^= st[2084 + n] ^ (((st[2102 + l2a] + st[2358 + l2b]) ^ st[2614 + l2c]) + st[2870 + l2d])
      r3 ^= st[3126 + n] ^ (((st[3144 + l3a] + st[3400 + l3b]) ^ st[3656 + l3c]) + st[3912 + l3d])
      r4 ^= st[4168 + n] ^ (((st[4186 + l4a] + st[4442 + l4b]) ^ st[4698 + l4c]) + st[4954 + l4d])
      r5 ^= st[5210 + n] ^ (((st[5228 + l5a] + st[5484 + l5b]) ^ st[5740 + l5c]) + st[5996 + l5d])
      const r0a: i32 = toI32(r0 >>> 24) & 0xff
      const r0b: i32 = toI32(r0 >>> 16) & 0xff
      const r0c: i32 = toI32(r0 >>> 8) & 0xff
      const r0d: i32 = toI32(r0) & 0xff
      const r1a: i32 = toI32(r1 >>> 24) & 0xff
      const r1b: i32 = toI32(r1 >>> 16) & 0xff
      const r1c: i32 = toI32(r1 >>> 8) & 0xff
      const r1d: i32 = toI32(r1) & 0xff
      const r2a: i32 = toI32(r2 >>> 24) & 0xff
      const r2b: i32 = toI32(r2 >>> 16) & 0xff
      const r2c: i32 = toI32(r2 >>> 8) & 0xff
      const r2d: i32 = toI32(r2) & 0xff
      const r3a: i32 = toI32(r3 >>> 24) & 0xff
      const r3b: i32 = toI32(r3 >>> 16) & 0xff
      const r3c: i32 = toI32(r3 >>> 8) & 0xff
      const r3d: i32 = toI32(r3) & 0xff
      const r4a: i32 = toI32(r4 >>> 24) & 0xff
      const r4b: i32 = toI32(r4 >>> 16) & 0xff
      const r4c: i32 = toI32(r4 >>> 8) & 0xff
      const r4d: i32 = toI32(r4) & 0xff
      const r5a: i32 = toI32(r5 >>> 24) & 0xff
      const r5b: i32 = toI32(r5 >>> 16) & 0xff
      const r5c: i32 = toI32(r5 >>> 8) & 0xff
      const r5d: i32 = toI32(r5) & 0xff
      l0 ^= st[n + 1] ^ (((st[18 + r0a] + st[274 + r0b]) ^ st[530 + r0c]) + st[786 + r0d])
      l1 ^= st[1042 + n + 1] ^ (((st[1060 + r1a] + st[1316 + r1b]) ^ st[1572 + r1c]) + st[1828 + r1d])
      l2 ^= st[2084 + n + 1] ^ (((st[2102 + r2a] + st[2358 + r2b]) ^ st[2614 + r2c]) + st[2870 + r2d])
      l3 ^= st[3126 + n + 1] ^ (((st[3144 + r3a] + st[3400 + r3b]) ^ st[3656 + r3c]) + st[3912 + r3d])
      l4 ^= st[4168 + n + 1] ^ (((st[4186 + r4a] + st[4442 + r4b]) ^ st[4698 + r4c]) + st[4954 + r4d])
      l5 ^= st[5210 + n + 1] ^ (((st[5228 + r5a] + st[5484 + r5b]) ^ st[5740 + r5c]) + st[5996 + r5d])
    }
    const t0: u32 = r0
    r0 = l0
    l0 = t0 ^ st[17]
    st[i] = l0
    st[i + 1] = r0
    const t1: u32 = r1
    r1 = l1
    l1 = t1 ^ st[1059]
    st[1042 + i] = l1
    st[1042 + i + 1] = r1
    const t2: u32 = r2
    r2 = l2
    l2 = t2 ^ st[2101]
    st[2084 + i] = l2
    st[2084 + i + 1] = r2
    const t3: u32 = r3
    r3 = l3
    l3 = t3 ^ st[3143]
    st[3126 + i] = l3
    st[3126 + i + 1] = r3
    const t4: u32 = r4
    r4 = l4
    l4 = t4 ^ st[4185]
    st[4168 + i] = l4
    st[4168 + i + 1] = r4
    const t5: u32 = r5
    r5 = l5
    l5 = t5 ^ st[5227]
    st[5210 + i] = l5
    st[5210 + i + 1] = r5
  }
}

/** The cost-round kernel for `width` lanes, slots 0 to `width` - 1. */
const bcryptBodyN = (st: u32[], width: i32): void => {
  if (width === 2) {
    bcryptBody2(st)
  } else if (width === 3) {
    bcryptBody3(st)
  } else if (width === 4) {
    bcryptBody4(st)
  } else if (width === 5) {
    bcryptBody5(st)
  } else if (width === 6) {
    bcryptBody6(st)
  }
}

/** `bcryptEncrypt` under the state at `at`: one block, `lr[0]` and `lr[1]` in place. */
const bcryptEncryptAt = (st: u32[], at: i32, lr: u32[]): void => {
  if (at < 0 || at + BCRYPT_STATE_WORDS > toI32(st.length)) {
    return
  }
  if (lr.length < 2) {
    return
  }
  let l: u32 = lr[0] ^ st[at]
  let r: u32 = lr[1]
  for (let n: i32 = 1; n < 17; n += 2) {
    const la: i32 = toI32(l >>> 24) & 0xff
    const lb: i32 = toI32(l >>> 16) & 0xff
    const lc: i32 = toI32(l >>> 8) & 0xff
    const ld: i32 = toI32(l) & 0xff
    r ^= st[at + n] ^ (((st[at + 18 + la] + st[at + 274 + lb]) ^ st[at + 530 + lc]) + st[at + 786 + ld])
    const ra: i32 = toI32(r >>> 24) & 0xff
    const rb: i32 = toI32(r >>> 16) & 0xff
    const rc: i32 = toI32(r >>> 8) & 0xff
    const rd: i32 = toI32(r) & 0xff
    l ^= st[at + n + 1] ^ (((st[at + 18 + ra] + st[at + 274 + rb]) ^ st[at + 530 + rc]) + st[at + 786 + rd])
  }
  lr[0] = r ^ st[at + 17]
  lr[1] = l
}

/** Each running slot's P XORed with its kept expanded key, as `bcryptXorKey`. */
const bcryptXorKeyN = (st: u32[], width: i32): void => {
  if (st.length < 6366) {
    return
  }
  for (let k: i32 = 0; k < width && k < BCRYPT_BATCH_LANES; k++) {
    const at: i32 = k * BCRYPT_STATE_WORDS
    const kept: i32 = k * 18 + BCRYPT_BATCH_KEYS
    for (let i: i32 = 0; i < 18; i++) {
      st[at + i] ^= st[kept + i]
    }
  }
}

/** Each running slot's P XORed with its salt words, as `bcryptXorSalt`. */
const bcryptXorSaltN = (st: u32[], salts: u32[], width: i32): void => {
  if (salts.length < 24) {
    return
  }
  for (let k: i32 = 0; k < width && k < BCRYPT_BATCH_LANES; k++) {
    bcryptXorSalt(
      st,
      k * BCRYPT_STATE_WORDS,
      salts[k * 4],
      salts[k * 4 + 1],
      salts[k * 4 + 2],
      salts[k * 4 + 3]
    )
  }
}

/**
 * The salted expansion of the state at `at`, `BF_crypt`'s first pass: each
 * block XORed with the salt words `salts[4k..]` in turn, encrypted, and
 * written over P and the S-boxes.
 */
const bcryptExpandAt = (st: u32[], at: i32, salts: u32[], k: i32, lr: u32[]): void => {
  if (lr.length < 2 || 4 * k + 3 >= toI32(salts.length)) {
    return
  }
  lr[0] = 0
  lr[1] = 0
  for (let i: i32 = 0; i < BCRYPT_STATE_WORDS; i += 2) {
    const half: i32 = (i & 2) !== 0 ? 2 : 0
    lr[0] ^= salts[4 * k + half]
    lr[1] ^= salts[4 * k + half + 1]
    bcryptEncryptAt(st, at, lr)
    if (at + i + 1 < toI32(st.length)) {
      st[at + i] = lr[0]
      st[at + i + 1] = lr[1]
    }
  }
}

/** `bcryptMagic` under the state at `at`: one pair of the magic string, into `dst` at `to`. */
const bcryptMagicAt = (st: u32[], at: i32, lr: u32[], dst: u8[], to: i32, l: u32, r: u32): void => {
  if (lr.length < 2) {
    return
  }
  lr[0] = l
  lr[1] = r
  for (let n: i32 = 0; n < 64; n++) {
    bcryptEncryptAt(st, at, lr)
  }
  bcryptPutBlock(dst, to, lr[0], lr[1])
}

/**
 * The batch's hash, on the batch state with its keys loaded: the salted
 * expansion, 2^cost rounds and the magic string on slots 0 to `width` - 1,
 * and the 31 digest characters of slot k into `digests` at 31k, which the
 * caller made and wipes. The block and digest copies are wiped here.
 */
const bcryptEksN = (st: u32[], salts: u32[], cost: i32, width: i32, digests: u8[]): void => {
  if (st.length < 6366 || salts.length < 24 || width < 1 || width > BCRYPT_BATCH_LANES) {
    return
  }
  const lr: u32[] = new Array<u32>(2)
  for (let k: i32 = 0; k < width; k++) {
    bcryptExpandAt(st, k * BCRYPT_STATE_WORDS, salts, k, lr)
  }

  let rounds: u32 = toU32(1) << toU32(cost)
  while (rounds !== 0) {
    bcryptXorKeyN(st, width)
    bcryptBodyN(st, width)
    bcryptXorSaltN(st, salts, width)
    bcryptBodyN(st, width)
    rounds -= 1
  }

  const digest: u8[] = new Array<u8>(24)
  for (let k: i32 = 0; k < width; k++) {
    const at: i32 = k * BCRYPT_STATE_WORDS
    bcryptMagicAt(st, at, lr, digest, 0, 0x4f727068, 0x65616e42)
    bcryptMagicAt(st, at, lr, digest, 8, 0x65686f6c, 0x64657253)
    bcryptMagicAt(st, at, lr, digest, 16, 0x63727944, 0x6f756274)
    bcryptEncodeInto(digests, 31 * k, digest, 23)
  }
  wipe(lr)
  wipe(digest)
}

/**
 * The running slots' 60-byte hashes, slot k at 60k, for `exposeWith` on the
 * loaded batch state. They are the hashes `bcryptHashN` returns, so they are
 * not secret and are not wiped; the digest characters they are joined from
 * are wiped here.
 */
const bcryptHashNExposed = (st: u32[], batch: BcryptBatch): u8[] => {
  const out: u8[] = new Array<u8>(BCRYPT_BATCH_LANES * BCRYPT_HASH_LENGTH)
  const digests: u8[] = new Array<u8>(31 * BCRYPT_BATCH_LANES)
  bcryptEksN(st, batch.salts, batch.cost, batch.width, digests)
  for (let k: i32 = 0; k < batch.width && k < toI32(batch.prefixes.length); k++) {
    bcryptJoin(out, BCRYPT_HASH_LENGTH * k, batch.prefixes[k], digests, k)
  }
  wipe(digests)
  return out
}

/**
 * Bit k set for each running slot whose rebuilt hash is `batch.hashes[k]`,
 * for `exposeWith` on the loaded batch state. The digest characters are built
 * and wiped here, so the bits are all that leaves.
 */
const bcryptVerifyNExposed = (st: u32[], batch: BcryptBatch): i32 => {
  const digests: u8[] = new Array<u8>(31 * BCRYPT_BATCH_LANES)
  bcryptEksN(st, batch.salts, batch.cost, batch.width, digests)
  let same: i32 = 0
  for (
    let k: i32 = 0;
    k < batch.width && k < toI32(batch.prefixes.length) && k < toI32(batch.hashes.length);
    k++
  ) {
    if (bcryptJoinedOk(batch.prefixes[k], digests, k, batch.hashes[k])) {
      same |= 1 << k
    }
  }
  wipe(digests)
  return same
}

/**
 * The batch `state` set up: the six states set to π, the safety words stored
 * and the password of caller lane `lanes[s]` loaded into slot s for each of
 * the `batch.width` slots. A lane no slot names is not read.
 */
const bcryptLoadN = (
  state: Secret<u32[]>,
  p0: Secret<u8[]>,
  p1: Secret<u8[]> | null,
  p2: Secret<u8[]> | null,
  p3: Secret<u8[]> | null,
  p4: Secret<u8[]> | null,
  p5: Secret<u8[]> | null,
  lanes: i32[],
  batch: BcryptBatch
): void => {
  exposeWith(state, batch, bcryptInitN)
  for (let s: i32 = 0; s < batch.width && s < toI32(lanes.length); s++) {
    const k: i32 = lanes[s]
    if (k === 0) {
      bcryptLoadSlot(state, p0, s)
    } else if (k === 1 && p1 !== null) {
      bcryptLoadSlot(state, p1, s)
    } else if (k === 2 && p2 !== null) {
      bcryptLoadSlot(state, p2, s)
    } else if (k === 3 && p3 !== null) {
      bcryptLoadSlot(state, p3, s)
    } else if (k === 4 && p4 !== null) {
      bcryptLoadSlot(state, p4, s)
    } else if (k === 5 && p5 !== null) {
      bcryptLoadSlot(state, p5, s)
    }
  }
}

/** Slot k's 60-byte hash out of the batch's `all`, as a string. */
const bcryptLaneString = (all: u8[], k: i32): string =>
  String.fromBytes(all, BCRYPT_HASH_LENGTH * k, BCRYPT_HASH_LENGTH * (k + 1))

/** Bit k set for each lane given: lane 0 always, lanes 1–5 when not null. */
const bcryptMaskOf = (
  p1: Secret<u8[]> | null,
  p2: Secret<u8[]> | null,
  p3: Secret<u8[]> | null,
  p4: Secret<u8[]> | null,
  p5: Secret<u8[]> | null
): i32 => {
  let mask: i32 = 1
  if (p1 !== null) {
    mask |= 2
  }
  if (p2 !== null) {
    mask |= 4
  }
  if (p3 !== null) {
    mask |= 8
  }
  if (p4 !== null) {
    mask |= 16
  }
  if (p5 !== null) {
    mask |= 32
  }
  return mask
}

/** The lanes whose bit is set in `mask`, lowest first: the caller lane each slot runs. */
const bcryptSlotsOf = (mask: i32): i32[] => {
  const lanes: i32[] = []
  for (let k: i32 = 0; k < BCRYPT_BATCH_LANES; k++) {
    if ((mask & (1 << k)) !== 0) {
      lanes.push(k)
    }
  }
  return lanes
}

/**
 * The `$2b$` hashes of up to six passwords at once, each as `bcryptHash`
 * makes it: lane k with the 16 bytes of `salts` at 16k and 2^`cost` rounds.
 * Lane 0 is always hashed; a null lane gives "" and its salt bytes are not
 * read. The w lanes given run as one computation on one thread with their
 * cost rounds interleaved, whatever positions they are in; one lane runs as
 * `bcryptHash`. Which w is fastest per hash depends on the core
 * (`bcryptCalibrate` measures it). An `Err` for `salts` of another length
 * than 96 or a cost outside 4–31.
 */
export const bcryptHashN = (
  p0: Secret<u8[]>,
  p1: Secret<u8[]> | null,
  p2: Secret<u8[]> | null,
  p3: Secret<u8[]> | null,
  p4: Secret<u8[]> | null,
  p5: Secret<u8[]> | null,
  salts: u8[],
  cost: i32
): Result<string[], string> => {
  if (salts.length !== 96) {
    return Err("bcrypt: the salts are not 96 bytes")
  }
  if (cost < BCRYPT_MIN_COST || cost > BCRYPT_MAX_COST) {
    return Err("bcrypt: the cost is outside 4 to 31")
  }
  const mask: i32 = bcryptMaskOf(p1, p2, p3, p4, p5)
  const lanes: i32[] = bcryptSlotsOf(mask)
  if (lanes.length === 1) {
    const one: Result<string, string> = bcryptHash(p0, bcryptSaltOf(salts, 0), cost)
    if (one.isErr()) {
      return Err(one.error)
    }
    return Ok([one.value, "", "", "", "", ""])
  }
  const words: u32[] = new Array<u32>(24)
  const prefixes: u8[][] = []
  for (let s: i32 = 0; s < toI32(lanes.length); s++) {
    prefixes.push(bcryptBatchSalt(words, salts, lanes[s], s, cost))
  }
  const none: string[] = []
  const batch: BcryptBatch = {
    salts: words,
    safety: new Array<u32>(BCRYPT_BATCH_LANES),
    cost: cost,
    width: toI32(lanes.length),
    prefixes: prefixes,
    hashes: none,
  }
  const state: Secret<u32[]> = secret(new Array<u32>(BCRYPT_BATCH_WORDS))
  bcryptLoadN(state, p0, p1, p2, p3, p4, p5, lanes, batch)
  const all: u8[] = exposeWith(state, batch, bcryptHashNExposed)
  wipe(state)
  // Slot s ran the s-th lane given, so the given lanes take the slots in order.
  const out: string[] = []
  let s: i32 = 0
  for (let k: i32 = 0; k < BCRYPT_BATCH_LANES; k++) {
    if ((mask & (1 << k)) !== 0) {
      out.push(bcryptLaneString(all, s))
      s++
    } else {
      out.push("")
    }
  }
  return Ok(out)
}

/**
 * `bcryptHashN` for up to four passwords, `salts` 64 bytes: the same hashes,
 * four strings. An `Err` for `salts` of another length than 64 or a cost
 * outside 4–31.
 */
export const bcryptHash4 = (
  p0: Secret<u8[]>,
  p1: Secret<u8[]> | null,
  p2: Secret<u8[]> | null,
  p3: Secret<u8[]> | null,
  salts: u8[],
  cost: i32
): Result<string[], string> => {
  if (salts.length !== 64) {
    return Err("bcrypt: the salts are not 64 bytes")
  }
  const wide: u8[] = new Array<u8>(96)
  for (let i: i32 = 0; i < 64 && i < toI32(salts.length); i++) {
    wide[i] = salts[i]
  }
  const made: Result<string[], string> = bcryptHashN(p0, p1, p2, p3, null, null, wide, cost)
  if (made.isErr()) {
    return Err(made.error)
  }
  const six: string[] = made.value
  const out: string[] = []
  for (let k: i32 = 0; k < 4 && k < toI32(six.length); k++) {
    out.push(six[k])
  }
  return Ok(out)
}

/** Lane `k`'s salt from the 96 bytes of `salts` into `words` at 4s as four words, and its 29-byte setting. */
const bcryptBatchSalt = (words: u32[], salts: u8[], k: i32, s: i32, cost: i32): u8[] => {
  const salt: u8[] = bcryptSaltOf(salts, k)
  const four: u32[] = bcryptSaltWords(salt)
  for (let j: i32 = 0; j < 4 && j < toI32(four.length) && 4 * s + j < toI32(words.length); j++) {
    words[4 * s + j] = four[j]
  }
  return bcryptSettingOf(salt, cost)
}

/** The 16 salt bytes of lane `k` from the bytes of a batch. */
const bcryptSaltOf = (salts: u8[], k: i32): u8[] => {
  const salt: u8[] = new Array<u8>(16)
  for (let j: i32 = 0; j < 16 && 16 * k + j < toI32(salts.length); j++) {
    salt[j] = salts[16 * k + j]
  }
  return salt
}

/** The 60 bytes of slot `k`'s hash into `out` at `at`: its 29-byte setting, then its 31 digest characters from the batch's. */
const bcryptJoin = (out: u8[], at: i32, prefix: u8[], digests: u8[], k: i32): void => {
  bcryptPut(out, at, prefix)
  const o: i32 = at + BCRYPT_SETTING_LENGTH
  for (
    let j: i32 = 0;
    j < 31 && 31 * k + j < toI32(digests.length) && o + j >= 0 && o + j < toI32(out.length);
    j++
  ) {
    out[o + j] = digests[31 * k + j]
  }
}

/**
 * Whether each of `hashes` (six strings) is its lane's password's, as
 * `bcryptVerify` decides it: lane 0 always, a null lane `false` and its
 * string not read. Lanes are grouped by the cost their hash names and each
 * group of two or more runs as one interleaved computation; a group of one
 * runs as `bcryptVerify`. A malformed hash in any given lane makes the whole
 * call an `Err` naming the lane ("bcrypt: lane 2: …") before any hashing, so
 * one bad row in a batch cannot be read as a wrong password.
 */
export const bcryptVerifyN = (
  p0: Secret<u8[]>,
  p1: Secret<u8[]> | null,
  p2: Secret<u8[]> | null,
  p3: Secret<u8[]> | null,
  p4: Secret<u8[]> | null,
  p5: Secret<u8[]> | null,
  hashes: string[]
): Result<boolean[], string> => {
  if (hashes.length !== 6) {
    return Err("bcrypt: a batch is six hashes")
  }
  const mask: i32 = bcryptMaskOf(p1, p2, p3, p4, p5)
  const lanes: BcryptParsed[] = []
  for (let k: i32 = 0; k < BCRYPT_BATCH_LANES && k < toI32(hashes.length); k++) {
    if ((mask & (1 << k)) !== 0) {
      const parsed: Result<BcryptParsed, string> = bcryptParseHash(hashes[k])
      if (parsed.isErr()) {
        const why: string = parsed.error.startsWith("bcrypt: ") ? parsed.error.substring(8) : parsed.error
        return Err(`bcrypt: lane ${k}: ${why}`)
      }
      lanes.push(parsed.value)
    } else {
      lanes.push({
        setting: { salt: new Array<u32>(4), cost: toI32(0), safety: toU32(0) },
        prefix: new Array<u8>(0),
      })
    }
  }
  const ok: boolean[] = [false, false, false, false, false, false]
  let done: i32 = ~mask & 63
  for (
    let k: i32 = 0;
    k < BCRYPT_BATCH_LANES && k < toI32(lanes.length) && k < toI32(hashes.length) && k < toI32(ok.length);
    k++
  ) {
    if ((done & (1 << k)) === 0) {
      const cost: i32 = lanes[k].setting.cost
      let group: i32 = 0
      for (let j: i32 = k; j < BCRYPT_BATCH_LANES && j < toI32(lanes.length); j++) {
        if ((done & (1 << j)) === 0 && lanes[j].setting.cost === cost) {
          group |= 1 << j
        }
      }
      done |= group
      if (group === 1 << k) {
        const one: boolean = bcryptLaneOk(p0, p1, p2, p3, p4, p5, k, lanes[k], hashes[k])
        if (k < toI32(ok.length)) {
          ok[k] = one
        }
      } else {
        bcryptVerifyGroup(p0, p1, p2, p3, p4, p5, group, lanes, hashes, ok)
      }
    }
  }
  return Ok(ok)
}

/**
 * `bcryptVerifyN` for up to four passwords and four hashes: the same
 * answers, four of them, and the same lane errors.
 */
export const bcryptVerify4 = (
  p0: Secret<u8[]>,
  p1: Secret<u8[]> | null,
  p2: Secret<u8[]> | null,
  p3: Secret<u8[]> | null,
  hashes: string[]
): Result<boolean[], string> => {
  if (hashes.length !== 4) {
    return Err("bcrypt: a batch is four hashes")
  }
  const six: string[] = []
  for (let k: i32 = 0; k < toI32(hashes.length); k++) {
    six.push(hashes[k])
  }
  six.push("")
  six.push("")
  const said: Result<boolean[], string> = bcryptVerifyN(p0, p1, p2, p3, null, null, six)
  if (said.isErr()) {
    return Err(said.error)
  }
  const all: boolean[] = said.value
  const out: boolean[] = []
  for (let k: i32 = 0; k < 4 && k < toI32(all.length); k++) {
    out.push(all[k])
  }
  return Ok(out)
}

/** Whether lane `k`'s password, hashed alone with `lane`'s setting, gives `hash`. */
const bcryptLaneOk = (
  p0: Secret<u8[]>,
  p1: Secret<u8[]> | null,
  p2: Secret<u8[]> | null,
  p3: Secret<u8[]> | null,
  p4: Secret<u8[]> | null,
  p5: Secret<u8[]> | null,
  k: i32,
  lane: BcryptParsed,
  hash: string
): boolean => {
  if (k === 0) {
    return bcryptVerifyOne(p0, lane, hash)
  }
  if (k === 1 && p1 !== null) {
    return bcryptVerifyOne(p1, lane, hash)
  }
  if (k === 2 && p2 !== null) {
    return bcryptVerifyOne(p2, lane, hash)
  }
  if (k === 3 && p3 !== null) {
    return bcryptVerifyOne(p3, lane, hash)
  }
  if (k === 4 && p4 !== null) {
    return bcryptVerifyOne(p4, lane, hash)
  }
  if (k === 5 && p5 !== null) {
    return bcryptVerifyOne(p5, lane, hash)
  }
  return false
}

/** Whether slot `k`'s hash joined from `prefix` and the batch's digests is `hash`. */
const bcryptJoinedOk = (prefix: u8[], digests: u8[], k: i32, hash: string): boolean => {
  const joined: u8[] = new Array<u8>(BCRYPT_HASH_LENGTH)
  bcryptJoin(joined, 0, prefix, digests, k)
  return bcryptSameWiped(joined, hash)
}

/** One interleaved run for the lanes in `group`, all of one cost, each lane's answer into `ok`. */
const bcryptVerifyGroup = (
  p0: Secret<u8[]>,
  p1: Secret<u8[]> | null,
  p2: Secret<u8[]> | null,
  p3: Secret<u8[]> | null,
  p4: Secret<u8[]> | null,
  p5: Secret<u8[]> | null,
  group: i32,
  lanes: BcryptParsed[],
  hashes: string[],
  ok: boolean[]
): void => {
  const words: u32[] = new Array<u32>(24)
  const safety: u32[] = new Array<u32>(BCRYPT_BATCH_LANES)
  const prefixes: u8[][] = []
  // Copies, so no callee is handed the caller's `hashes` (the thread rule).
  const given: string[] = []
  const slots: i32[] = bcryptSlotsOf(group)
  let cost: i32 = 0
  for (let s: i32 = 0; s < toI32(slots.length) && s < toI32(safety.length); s++) {
    const k: i32 = slots[s]
    if (k >= 0 && k < toI32(lanes.length) && k < toI32(hashes.length)) {
      const lane: BcryptParsed = lanes[k]
      const hash: string = hashes[k]
      const setting: BcryptSetting = lane.setting
      cost = setting.cost
      safety[s] = setting.safety
      for (let j: i32 = 0; j < 4 && j < toI32(setting.salt.length); j++) {
        words[4 * s + j] = setting.salt[j]
      }
      given.push(hash)
      prefixes.push(lane.prefix)
    }
  }
  const batch: BcryptBatch = {
    salts: words,
    safety: safety,
    cost: cost,
    width: toI32(prefixes.length),
    prefixes: prefixes,
    hashes: given,
  }
  const state: Secret<u32[]> = secret(new Array<u32>(BCRYPT_BATCH_WORDS))
  bcryptLoadN(state, p0, p1, p2, p3, p4, p5, slots, batch)
  const same: i32 = exposeWith(state, batch, bcryptVerifyNExposed)
  wipe(state)
  for (let s: i32 = 0; s < toI32(slots.length); s++) {
    const k: i32 = slots[s]
    if (k >= 0 && k < toI32(ok.length)) {
      ok[k] = (same & (1 << s)) !== 0
    }
  }
}

/** Throwaway passwords hashed when calibrating: one byte each, not secret, wiped all the same. */
const bcryptCalibrateKey = (k: i32): Secret<u8[]> => secret([toU8(0x41 + k)])

/** Nanoseconds of one cost-4 `bcryptHashN` of `width` throwaway passwords, the least of a few runs. */
const bcryptCalibrateTime = (width: i32): i64 => {
  const salts: u8[] = new Array<u8>(96)
  let best: i64 = 0
  for (let run: i32 = 0; run < 3; run++) {
    const p0: Secret<u8[]> = bcryptCalibrateKey(0)
    const p1: Secret<u8[]> | null = width > 1 ? bcryptCalibrateKey(1) : null
    const p2: Secret<u8[]> | null = width > 2 ? bcryptCalibrateKey(2) : null
    const p3: Secret<u8[]> | null = width > 3 ? bcryptCalibrateKey(3) : null
    const p4: Secret<u8[]> | null = width > 4 ? bcryptCalibrateKey(4) : null
    const p5: Secret<u8[]> | null = width > 5 ? bcryptCalibrateKey(5) : null
    const start: i64 = monotonicNanos()
    const made: Result<string[], string> = bcryptHashN(p0, p1, p2, p3, p4, p5, salts, BCRYPT_MIN_COST)
    const took: i64 = monotonicNanos() - start
    if (made.isOk() && (run === 0 || took < best)) {
      best = took
    }
    wipe(p0)
    if (p1 !== null) {
      wipe(p1)
    }
    if (p2 !== null) {
      wipe(p2)
    }
    if (p3 !== null) {
      wipe(p3)
    }
    if (p4 !== null) {
      wipe(p4)
    }
    if (p5 !== null) {
      wipe(p5)
    }
  }
  return best
}

/**
 * The batch width, 1 to 6, that hashes fastest per password on this core:
 * each width timed on throwaway passwords at cost 4, the least time of a few
 * runs divided by the width. It measures rather than guesses, since the best
 * width turns on the core's load ports, its registers and what else is
 * running, and it keeps nothing between calls, so call it once, at startup,
 * and keep the answer. A few tens of milliseconds of one core.
 */
export const bcryptCalibrate = (): i32 => {
  let best: i32 = 1
  let bestTime: i64 = bcryptCalibrateTime(1)
  for (let w: i32 = 2; w <= BCRYPT_BATCH_LANES; w++) {
    const took: i64 = bcryptCalibrateTime(w)
    // took / w < bestTime / best, without dividing.
    if (took * toI64(best) < bestTime * toI64(w)) {
      best = w
      bestTime = took
    }
  }
  return best
}
