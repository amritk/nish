/**
 * Fuzz target: JWS compact verification and signing (std/crypto/jwt.ts).
 *
 * Byte 0 picks the key and the verifier's settings; the rest is the token.
 * Bits 0-1 choose the key: an HS256 key (RFC 7515 A.1's), the ES256 key of
 * A.3, the EdDSA key of RFC 8037 A.2, or the HS256 key again. Bit 2 names an
 * issuer, an audience and a subject; bit 3 clears `requireExp`; bit 4 sets a
 * `typ` of `JWT`; bit 5 a leeway of 60 seconds.
 *
 * The token is verified twice through one verifier, and `peekKid` reads it
 * too. The answers are checked: `verify` answers `JWT_OK` or one of the
 * `JWT_ERR_*` codes, the same code both times; after `JWT_OK` the claims are
 * a non-empty window of the verifier's buffer; and `peekKid` answers -1 or a
 * length that fits its room. Then the token bytes are signed as claims under
 * the HS256 key; when they are one JSON object `jwtSign` mints a token, which
 * is verified: it may fail on its claims' values, but never on its form,
 * header, algorithm or signature. A refusal is a code; a panic, or answers
 * that disagree, is a crash.
 */
import { base64urlDecode } from "nish/crypto/base64url"
import {
  JWT_ALG_ES256,
  JWT_ALG_HS256,
  JWT_ERR_ALG,
  JWT_ERR_FORMAT,
  JWT_ERR_HEADER,
  JWT_ERR_SIGNATURE,
  JWT_ERR_SIZE,
  JWT_ERR_TYPE,
  JWT_MAX_TOKEN,
  JWT_OK,
  JwtKey,
  JwtVerifier,
  jwtEcKey,
  jwtEd25519Key,
  jwtHmacKey,
  jwtSign,
} from "nish/crypto/jwt"
import { Secret, secret, wipe } from "nish:secret"

const HS_KEY: string = "AyM1SysPpbyDfgZld3umj1qzKObwVMkoqQ-EstJQLr_T-1qS0gZH75aKtMN3Yj0iPS4hcgUuTwjAzZr1Z9CAow"
const EC_X: string = "f83OJ3D2xF1Bg8vub9tLe1gHMzV76e8Tus9uPHvRVEU"
const EC_Y: string = "x_FEzRu9m36HLN_tue659LNpXW6pCyStikYjKIWI5a0"
const ED_X: string = "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo"

/** 2017-07-14, inside every corpus token's lifetime. */
const NOW: i64 = 1500000000

const decoded = (text: string): u8[] => {
  const d: u8[] | null = base64urlDecode(text)
  if (d === null) {
    panic("jwt: a key literal does not decode")
  }
  return d
}

const keyFor = (which: i32): JwtKey => {
  let key: JwtKey | null = null
  if (which === 1) {
    const point: u8[] = [toU8(4)]
    const x: u8[] = decoded(EC_X)
    const y: u8[] = decoded(EC_Y)
    for (let i: i32 = 0; i < toI32(x.length); i += 1) {
      point.push(x[i])
    }
    for (let i: i32 = 0; i < toI32(y.length); i += 1) {
      point.push(y[i])
    }
    key = jwtEcKey(JWT_ALG_ES256, point)
  } else if (which === 2) {
    key = jwtEd25519Key(decoded(ED_X))
  } else {
    const raw: Secret<u8[]> = secret(decoded(HS_KEY))
    key = jwtHmacKey(JWT_ALG_HS256, raw)
    wipe(raw)
  }
  if (key === null) {
    panic("jwt: a corpus key does not load")
  }
  return key
}

const known = (code: i32): boolean => code <= JWT_OK && code >= JWT_ERR_TYPE

export const fuzzOne = (data: u8[]): void => {
  const len: i32 = toI32(data.length)
  if (len < 1) {
    return
  }
  const mode: i32 = toI32(data[0])
  const key: JwtKey = keyFor(mode & 3)
  const v: JwtVerifier = new JwtVerifier(JWT_MAX_TOKEN)
  if ((mode & 4) !== 0) {
    v.issuer = "joe"
    v.audience = "api"
    v.subject = "ana"
  }
  if ((mode & 8) !== 0) {
    v.requireExp = false
  }
  if ((mode & 16) !== 0) {
    v.typ = "JWT"
  }
  if ((mode & 32) !== 0) {
    v.leeway = toI64(60)
  }

  const first: i32 = v.verify(key, data, toI32(1), len - 1, NOW)
  if (!known(first)) {
    panic(`jwt: verify answered ${first}, no code`)
  }
  if (first === JWT_OK && (v.claimsLen <= 0 || v.claimsLen > toI32(v.claims.length))) {
    panic(`jwt: JWT_OK with ${v.claimsLen} bytes of claims`)
  }
  const second: i32 = v.verify(key, data, toI32(1), len - 1, NOW)
  if (second !== first) {
    panic(`jwt: one token answered ${first}, then ${second}`)
  }
  const room: u8[] = new Array<u8>(16)
  const kid: i32 = v.peekKid(data, toI32(1), len - 1, room)
  if (kid < -1 || kid > toI32(room.length)) {
    panic(`jwt: peekKid answered ${kid}`)
  }

  if (len > 4096) {
    key.wipe()
    return
  }
  const claims: u8[] = new Array<u8>(len - 1)
  for (let i: i32 = 1; i < len && i < toI32(data.length); i += 1) {
    claims[i - 1] = data[i]
  }
  const hs: JwtKey = keyFor(0)
  const minted: string | null = jwtSign(hs, claims)
  if (minted === null) {
    // Claims that are not one JSON object are not signed.
    hs.wipe()
    key.wipe()
    return
  }
  const back: i32 = new JwtVerifier(JWT_MAX_TOKEN).verifyString(hs, minted, NOW)
  if (back === JWT_ERR_SIZE || back === JWT_ERR_FORMAT || back === JWT_ERR_HEADER || back === JWT_ERR_ALG || back === JWT_ERR_SIGNATURE) {
    panic(`jwt: a token jwtSign minted answered ${back}`)
  }
  hs.wipe()
  key.wipe()
}
