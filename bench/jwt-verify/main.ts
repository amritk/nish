// An HS256 token's verification in nanoseconds a token, and the base64url
// decode inside it, under bench/crypto/README.md's program contract.
// bench/jwt-verify/run.mjs builds it with `--profile speed` and runs
//
//   main <kernel> <shape> <iterations>
//
//   verify         `JwtVerifier.verify` on the token's bytes: the dot scan,
//                  the header decoded and checked, the signature decoded, the
//                  HMAC resumed from the key's midstates and compared in
//                  constant time, the claims decoded and checked
//   midstate       the HMAC alone, as a server holding `HmacSha256` keyed once
//                  runs it: both keyed hashers copied into working ones with
//                  `hmacCopySha256`, the signing input absorbed, the digest
//                  compared with `timingSafeEqualAt` against the token's tag
//   decode-server  the token's three segments decoded a byte at a time by an
//                  if-chain sextet into buffers the caller owns: the decoder
//                  std/crypto/jwt.ts and a server's token code both write
//   decode-std     the same segments, each already a string, by
//                  `nish/crypto/base64url`'s `base64urlDecode`
//   decode-old     the same by ./old.ts, `base64urlDecode` as main had it,
//                  frozen by freeze.mjs
//
//   <shape>  0  a session token: `{"sub","role","iat","exp"}`, 64 bytes of claims,
//               a 123-byte signing input and a 167-byte token
//            1  a token with 319 bytes of claims (issuer, audience, scopes),
//               a 463-byte signing input and a 507-byte token
//
// Each iteration takes the next of sixteen tokens signed before the clock
// starts, each for its own `iat`, so the input changes every iteration. Each
// prints a checksum of what every iteration answered on stdout (the verdict
// and the decoded claims, the tag compared, the decoded bytes) and the timed
// loop's nanoseconds on stderr.
import { base64urlDecode } from "nish/crypto/base64url"
import { timingSafeEqualAt } from "nish/crypto/ct"
import { HmacSha256, hmacCopySha256 } from "nish/crypto/hmac"
import { JWT_ALG_HS256, JWT_OK, JwtKey, JwtVerifier, jwtHmacKey, jwtSignString } from "nish/crypto/jwt"
import { Secret, secret, wipe } from "nish:secret"
import { Args, foldStart, inputs, now, parseArgs, report } from "../crypto/lib/gen"
import { b64aDecode } from "./old"

/** How many tokens a run cycles through. */
const TOKENS: i32 = 16
/** The clock every token is checked at: inside each token's `[iat, exp)`. */
const NOW: i64 = 1700000100

/** One byte into FNV-1a 32, as ../crypto/lib/gen folds. */
const jvStep = (h: u32, b: i32): u32 => (h ^ toU32(b & 255)) * 16777619

/**
 * `bytes[0 .. len)` folded into `sum`: their position-weighted sum, then that
 * sum's four bytes by FNV-1a. A byte-at-a-time FNV chain costs a multiply's
 * latency a byte, as much as decoding it, and would hide the decoder; the
 * weighted sum vectorizes and still tells a byte out of place.
 */
const jvFoldTo = (sum: u32, bytes: u8[], len: i32): u32 => {
  let w: u32 = 0
  for (let i: i32 = 0; i < len && i < toI32(bytes.length); i++) {
    w = w + toU32(bytes[i]) * toU32(i + 1)
  }
  return jvStep(jvStep(jvStep(jvStep(sum, toI32(w)), toI32(w >> 8)), toI32(w >> 16)), toI32(w >> 24))
}

/** The claims of token `t` in `shape`. */
const claimsOf = (shape: i32, t: i32): string => {
  const iat: i32 = 1700000000 + t
  if (shape === 0) {
    return `{"sub":"${123456 + t}","role":"user","iat":${iat},"exp":${iat + 2592000}}`
  }
  return (
    `{"iss":"https://auth.example.com/realms/production","sub":"${123456 + t}",` +
    `"aud":"https://api.example.com","iat":${iat},"nbf":${iat},"exp":${iat + 2592000},` +
    `"jti":"0b8e6f1c-3d2a-4f5e-9a7b-1000${10000000 + t}","name":"Ada Lovelace",` +
    `"email":"ada.lovelace@example.com","scope":"read:articles write:articles read:profile write:comments"}`
  )
}

/** The bytes of `text`, which is ASCII, as a token is. */
const asciiBytes = (text: string): u8[] => {
  const out: u8[] = new Array<u8>(toI32(text.length))
  for (let i: i32 = 0; i < toI32(out.length); i++) {
    out[i] = toU8(text.charCodeAt(i))
  }
  return out
}

/** The sextet `c` spells, or -1: a branch a range, since a token is public. */
const serverSextet = (c: i32): i32 => {
  if (c >= 65 && c <= 90) {
    return c - 65
  }
  if (c >= 97 && c <= 122) {
    return c - 71
  }
  if (c >= 48 && c <= 57) {
    return c + 4
  }
  if (c === 45) {
    return 62
  }
  if (c === 95) {
    return 63
  }
  return -1
}

/**
 * `src[off .. off + len)` decoded into `out` from 0: the byte count, or -1 for
 * a length of 1 mod 4, a byte outside the alphabet, stray low bits or more
 * bytes than `out` holds. The loop is std/crypto/jwt.ts's `jwtDecode`; the
 * range is checked once, up front, as the server checks `off + len` before it
 * decodes, so that the loop carries no per-character test of its own.
 */
const serverDecode = (src: u8[], off: i32, len: i32, out: u8[]): i32 => {
  if (off < 0 || len < 0 || off > toI32(src.length) - len) {
    return -1
  }
  const tail: i32 = len & 3
  if (tail === 1) {
    return -1
  }
  const size: i32 = (len >> 2) * 3 + (tail === 0 ? 0 : tail - 1)
  if (size > toI32(out.length)) {
    return -1
  }
  let acc: i32 = 0
  let bits: i32 = 0
  let at: i32 = 0
  for (let i: i32 = 0; i < len; i += 1) {
    const v: i32 = serverSextet(toI32(src[off + i]))
    if (v < 0) {
      return -1
    }
    acc = ((acc << 6) | v) & 0xffffff
    bits += 6
    if (bits >= 8 && at >= 0 && at < toI32(out.length)) {
      bits -= 8
      out[at] = toU8((acc >> bits) & 255)
      at += 1
    }
  }
  if ((acc & ((1 << bits) - 1)) !== 0) {
    return -1
  }
  return at
}

/** One signed token: its bytes, where its dots are, and its segments as strings. */
class Token {
  bytes: u8[]
  d1: i32
  d2: i32
  header: string
  payload: string
  signature: string
  constructor(text: string) {
    this.bytes = asciiBytes(text)
    this.d1 = toI32(text.indexOf("."))
    this.d2 = toI32(text.indexOf(".", this.d1 + 1))
    this.header = text.slice(0, this.d1)
    this.payload = text.slice(this.d1 + 1, this.d2)
    this.signature = text.slice(this.d2 + 1)
  }
}

/** The 32-byte key every token is signed under, drawn by ../crypto/lib/gen, in a fresh array. */
const keyBytes = (a: Args): u8[] => {
  const drawn: u8[] = inputs("jwt-verify", a.size, 32, 0, 0, 0).key
  const out: u8[] = new Array<u8>(toI32(drawn.length))
  for (let i: i32 = 0; i < toI32(out.length); i++) {
    out[i] = drawn[i]
  }
  return out
}

/** The run's tokens, signed under `key`. */
const tokensOf = (a: Args, key: JwtKey): Token[] => {
  const out: Token[] = []
  for (let t: i32 = 0; t < TOKENS; t++) {
    const text: string | null = jwtSignString(key, claimsOf(a.size, t))
    if (text === null) {
      panic("jwt-verify: a token failed to sign")
    }
    out.push(new Token(text))
  }
  return out
}

const verifyLoop = (a: Args, key: JwtKey, tokens: Token[]): i32 => {
  const verifier: JwtVerifier = new JwtVerifier(toI32(1024))
  if (a.size === 1) {
    // A token that names its audience is refused unless the verifier names
    // one; a server that issues these pins both.
    verifier.issuer = "https://auth.example.com/realms/production"
    verifier.audience = "https://api.example.com"
  }
  let sum: u32 = foldStart()
  const started: i64 = now()
  for (let i: i32 = 0; i < a.iterations; i++) {
    const tok: Token = tokens[i % TOKENS]
    const verdict: i32 = verifier.verify(key, tok.bytes, toI32(0), toI32(tok.bytes.length), NOW)
    if (verdict !== JWT_OK) {
      writeError(`jwt-verify: a token answered ${verdict}\n`)
      return 1
    }
    sum = jvStep(jvFoldTo(sum, verifier.claims, verifier.claimsLen), toI32(verifier.iat))
  }
  report(sum, started)
  return 0
}

const midstateLoop = (a: Args, raw: u8[], tokens: Token[]): i32 => {
  const keyed: HmacSha256 = new HmacSha256(raw)
  const work: HmacSha256 = new HmacSha256(raw)
  const sigs: u8[][] = []
  for (let t: i32 = 0; t < TOKENS; t++) {
    const s: u8[] | null = base64urlDecode(tokens[t].signature)
    if (s === null) {
      panic("jwt-verify: a signature failed to decode")
    }
    sigs.push(s)
  }
  let sum: u32 = foldStart()
  const started: i64 = now()
  for (let i: i32 = 0; i < a.iterations; i++) {
    const tok: Token = tokens[i % TOKENS]
    hmacCopySha256(keyed.inner, work.inner)
    hmacCopySha256(keyed.outer, work.outer)
    work.update(tok.bytes, toI32(0), tok.d2)
    const tag: u8[] = work.digest()
    if (!timingSafeEqualAt(tag, toI32(0), sigs[i % TOKENS], toI32(0), toI32(32))) {
      writeError("jwt-verify: a tag failed to compare\n")
      return 1
    }
    sum = jvFoldTo(sum, tag, toI32(32))
  }
  report(sum, started)
  return 0
}

const decodeServerLoop = (a: Args, tokens: Token[]): i32 => {
  const out: u8[] = new Array<u8>(toI32(1024))
  let sum: u32 = foldStart()
  const started: i64 = now()
  for (let i: i32 = 0; i < a.iterations; i++) {
    const tok: Token = tokens[i % TOKENS]
    const src: u8[] = tok.bytes
    const h: i32 = serverDecode(src, toI32(0), tok.d1, out)
    sum = jvFoldTo(jvStep(sum, h), out, h)
    const p: i32 = serverDecode(src, tok.d1 + 1, tok.d2 - tok.d1 - 1, out)
    sum = jvFoldTo(jvStep(sum, p), out, p)
    const s: i32 = serverDecode(src, tok.d2 + 1, toI32(src.length) - tok.d2 - 1, out)
    sum = jvFoldTo(jvStep(sum, s), out, s)
  }
  report(sum, started)
  return 0
}

/** `bytes` folded with its length first, as the server loop folds a count; null folds -1. */
const foldDecoded = (sum: u32, bytes: u8[] | null): u32 => {
  if (bytes === null) {
    return jvStep(sum, -1)
  }
  return jvFoldTo(jvStep(sum, toI32(bytes.length)), bytes, toI32(bytes.length))
}

const decodeStdLoop = (a: Args, tokens: Token[]): i32 => {
  let sum: u32 = foldStart()
  const started: i64 = now()
  for (let i: i32 = 0; i < a.iterations; i++) {
    using _scope = arena()
    const tok: Token = tokens[i % TOKENS]
    sum = foldDecoded(sum, base64urlDecode(tok.header))
    sum = foldDecoded(sum, base64urlDecode(tok.payload))
    sum = foldDecoded(sum, base64urlDecode(tok.signature))
  }
  report(sum, started)
  return 0
}

const decodeOldLoop = (a: Args, tokens: Token[]): i32 => {
  let sum: u32 = foldStart()
  const started: i64 = now()
  for (let i: i32 = 0; i < a.iterations; i++) {
    using _scope = arena()
    const tok: Token = tokens[i % TOKENS]
    sum = foldDecoded(sum, b64aDecode(tok.header))
    sum = foldDecoded(sum, b64aDecode(tok.payload))
    sum = foldDecoded(sum, b64aDecode(tok.signature))
  }
  report(sum, started)
  return 0
}

export const main = (): i32 => {
  const a: Args | null = parseArgs("jwt-verify")
  if (a === null) {
    return 2
  }
  if (a.size > 1) {
    writeError(`jwt-verify: no shape ${a.size}\n`)
    return 2
  }
  const keySecret: Secret<u8[]> = secret(keyBytes(a))
  const key: JwtKey | null = jwtHmacKey(JWT_ALG_HS256, keySecret)
  wipe(keySecret)
  if (key === null) {
    return 1
  }
  const tokens: Token[] = tokensOf(a, key)
  if (a.kernel === "verify") {
    return verifyLoop(a, key, tokens)
  }
  if (a.kernel === "midstate") {
    return midstateLoop(a, keyBytes(a), tokens)
  }
  if (a.kernel === "decode-server") {
    return decodeServerLoop(a, tokens)
  }
  if (a.kernel === "decode-std") {
    return decodeStdLoop(a, tokens)
  }
  if (a.kernel === "decode-old") {
    return decodeOldLoop(a, tokens)
  }
  writeError(`jwt-verify: no kernel ${a.kernel}\n`)
  return 2
}
