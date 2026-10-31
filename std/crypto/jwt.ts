/**
 * `nish/crypto/jwt` — JSON Web Tokens in the JWS compact serialization: verify
 * one and check its claims, or sign one. RFC 7519 (JWT), RFC 7515 (JWS),
 * RFC 7518 (the HS, RS and ES algorithms), RFC 8037 (EdDSA) and the RFC 8725
 * best current practice.
 *
 *     import { JWT_ALG_HS256, JWT_MAX_TOKEN, JWT_OK, JwtVerifier, jwtHmacKey, jwtSignString } from "nish/crypto/jwt";
 *
 *     const key = jwtHmacKey(JWT_ALG_HS256, secretKey);       // once; null for a short key
 *     const v = new JwtVerifier(JWT_MAX_TOKEN);               // once, per thread
 *     v.issuer = "https://issuer.example";
 *     v.audience = "api";
 *     v.leeway = toI64(30);
 *     if (key !== null && v.verifyString(key, token, now) === JWT_OK) {
 *       // v.claims[0 .. v.claimsLen) is the payload's JSON; v.exp, v.nbf, v.iat are read
 *     }
 *     const minted: string | null = key === null ? null : jwtSignString(key, "{\"sub\":\"ana\"}");
 *
 * **The key decides the algorithm, never the token.** A `JwtKey` is made for
 * one algorithm, and a token verifies only when its header's `alg` is that
 * algorithm's name, spelled exactly. `none` names no key, so a token that
 * says it is unsigned is refused like any other mismatch (`JWT_ERR_ALG`); an
 * `HS256` header in front of an RSA key is refused before any MAC is taken,
 * so an RSA public key can never be used as an HMAC secret (RFC 8725 §2.1,
 * §3.1). The header must hold `alg` exactly once, as a string; `typ` and `kid`
 * at most once, as strings; and no `crit` and no `b64` (RFC 7515 §4.1.11,
 * RFC 7797), since this verifier understands no extension and a header that
 * names one must be refused. Other header members are skipped.
 *
 * **Nothing in the payload is read before the signature holds.** The verifier
 * reads the header, decodes the signature and checks it, and only then decodes
 * and parses the claims. The claims are then checked against the clock and the
 * verifier's settings:
 *
 * - `exp` (RFC 7519 §4.1.4): the token is good while `now - leeway < exp`.
 *   A token with no `exp` is refused unless `requireExp` is cleared.
 * - `nbf` (§4.1.5): good once `nbf <= now + leeway`.
 * - `iat` (§4.1.6): refused when it is later than `now + leeway`.
 * - `iss`, `sub` (§4.1.1, §4.1.2): when the verifier names one, the token must
 *   carry it, spelled exactly.
 * - `aud` (§4.1.3): one string or an array of strings. When the verifier names
 *   an audience, one of them must be it. A token that carries `aud` is refused
 *   by a verifier that names none, as §4.1.3 requires.
 *
 * Each registered claim may appear once; the time claims are integers
 * (seconds since 1970). `now` is the caller's, so a test passes its own clock.
 *
 * **Bounded once made.** A `JwtVerifier` holds its decode buffers, its
 * tokenizer and its results, sized once from the largest token it takes
 * (`JWT_MAX_TOKEN` by default, 8 KiB); a longer token is refused before a
 * byte is decoded. An HS token is checked against `HmacKey`'s pads, keyed
 * once when the key was made, through `hmacKeyedVerify`, and the tag is
 * compared in constant time: an HS verify allocates nothing past its arena
 * block. An RS, ES or EdDSA verify allocates the signed input's copy and
 * whatever the public-key check itself allocates (bignums, points), which
 * the caller's scope releases. One verifier is one thread's: it is not safe
 * to share while a `verify` runs.
 *
 * **Base64url is strict**, as `nish/crypto/base64url`: no padding, no
 * whitespace, no character outside `A-Z a-z 0-9 - _`, and no stray bits in the
 * last character, so each token has one spelling. The token itself is public,
 * so the decoder here branches freely.
 *
 * **Signing** covers HS256/384/512, ES256 and EdDSA, the algorithms the
 * standard library holds a signer for; `jwtSign` answers `null` for an RS or
 * ES384 key, which can verify only. The header written is
 * `{"alg":"…","typ":"JWT"}`, with a `kid` when one is given.
 *
 * **Secrets.** An HMAC key and a private key are `Secret<u8[]>`
 * (`nish:secret`). A `JwtKey` copies what it is handed and the caller still
 * owns, and wipes, its own; `JwtKey.wipe()` zeroes the key's copy and its HMAC
 * pads. The threat model and what was checked are in
 * `docs/security/crypto-jwt.md`.
 *
 * Private names carry the `jwt` prefix because a `std/` module's private
 * functions share the importing program's flat symbol namespace
 * (`docs/wp26-stdlib.md` §3e).
 */
import {
  HMAC_SHA256,
  HMAC_SHA384,
  HMAC_SHA512,
  HmacKey,
  hmacKeyedInto,
  hmacKeyedVerify,
} from "nish/crypto/hmac"
import {
  RSA_HASH_SHA256,
  RSA_HASH_SHA384,
  RSA_HASH_SHA512,
  RsaPublicKey,
  rsaParsePublicKey,
  rsaVerifyPkcs1v15,
} from "nish/crypto/rsa"
import {
  P256_POINT_SIZE,
  P256_SIGNATURE_SIZE,
  p256PublicKey,
  p256SignSha256,
  p256VerifySha256,
} from "nish/crypto/p256"
import { P384_POINT_SIZE, P384_SIGNATURE_SIZE, p384VerifySha384 } from "nish/crypto/p384"
import { ed25519PublicKey, ed25519Sign, ed25519Verify } from "nish/crypto/ed25519"
import { base64urlEncode } from "nish/crypto/base64url"
import { Secret, expose, secret, wipe } from "nish:secret"

/** HMAC with SHA-256 (RFC 7518 §3.2). */
export const JWT_ALG_HS256: i32 = 1
/** HMAC with SHA-384. */
export const JWT_ALG_HS384: i32 = 2
/** HMAC with SHA-512. */
export const JWT_ALG_HS512: i32 = 3
/** RSASSA-PKCS1-v1_5 with SHA-256 (RFC 7518 §3.3). */
export const JWT_ALG_RS256: i32 = 4
/** RSASSA-PKCS1-v1_5 with SHA-384. */
export const JWT_ALG_RS384: i32 = 5
/** RSASSA-PKCS1-v1_5 with SHA-512. */
export const JWT_ALG_RS512: i32 = 6
/** ECDSA on P-256 with SHA-256 (RFC 7518 §3.4). */
export const JWT_ALG_ES256: i32 = 7
/** ECDSA on P-384 with SHA-384. */
export const JWT_ALG_ES384: i32 = 8
/** Ed25519 (RFC 8037 §3.1). */
export const JWT_ALG_EDDSA: i32 = 9

/** The token verified and every claim check passed. */
export const JWT_OK: i32 = 0
/** The token is longer than the verifier takes, or its window is outside its array. */
export const JWT_ERR_SIZE: i32 = -1
/** Not three base64url parts joined by two dots. */
export const JWT_ERR_FORMAT: i32 = -2
/** The header is not a JSON object, repeats a member, or names `crit` or `b64`. */
export const JWT_ERR_HEADER: i32 = -3
/** The header's `alg` is missing, is not a string, or is not the key's algorithm (`none` included). */
export const JWT_ERR_ALG: i32 = -4
/** The signature is the wrong length or does not verify. */
export const JWT_ERR_SIGNATURE: i32 = -5
/** The payload is not a JSON object, repeats or mistypes a registered claim, or lacks `exp`. */
export const JWT_ERR_CLAIMS: i32 = -6
/** `exp` has passed. */
export const JWT_ERR_EXPIRED: i32 = -7
/** `nbf` has not come. */
export const JWT_ERR_NOT_YET: i32 = -8
/** `iat` is in the future. */
export const JWT_ERR_IAT: i32 = -9
/** `iss` is missing or not the verifier's issuer. */
export const JWT_ERR_ISSUER: i32 = -10
/** `aud` does not name the verifier's audience, or is present when the verifier names none. */
export const JWT_ERR_AUDIENCE: i32 = -11
/** `sub` is missing or not the verifier's subject. */
export const JWT_ERR_SUBJECT: i32 = -12
/** The header's `typ` is not the verifier's `typ`. */
export const JWT_ERR_TYPE: i32 = -13

/** The longest token a default `JwtVerifier` takes, in bytes. */
export const JWT_MAX_TOKEN: i32 = 8192
/** The longest token any `JwtVerifier` takes: 1 MiB. */
export const JWT_MAX_TOKEN_LIMIT: i32 = 1048576

/** The longest signature: an 8192-bit RSA modulus. */
const JWT_MAX_SIGNATURE: i32 = 1024
/** How deep a header or a payload may nest. */
const JWT_MAX_DEPTH: i32 = 32
/** The largest leeway, in seconds: about 68 years, which `now ± leeway` cannot overflow. */
const JWT_MAX_LEEWAY: i64 = 2147483647
/** The latest `now`: 2^62 seconds, so `now + leeway` stays inside `i64`. */
const JWT_MAX_NOW: i64 = 1073741824 * 1073741824 * 4
const JWT_DOT: i32 = 46

/** The `alg` header value for `alg`, `""` for no algorithm this module knows. */
export const jwtAlgName = (alg: i32): string => {
  if (alg === JWT_ALG_HS256) {
    return "HS256"
  }
  if (alg === JWT_ALG_HS384) {
    return "HS384"
  }
  if (alg === JWT_ALG_HS512) {
    return "HS512"
  }
  if (alg === JWT_ALG_RS256) {
    return "RS256"
  }
  if (alg === JWT_ALG_RS384) {
    return "RS384"
  }
  if (alg === JWT_ALG_RS512) {
    return "RS512"
  }
  if (alg === JWT_ALG_ES256) {
    return "ES256"
  }
  if (alg === JWT_ALG_ES384) {
    return "ES384"
  }
  if (alg === JWT_ALG_EDDSA) {
    return "EdDSA"
  }
  return ""
}

/** Whether `alg` is one of the HS algorithms, checked with an HMAC key. */
const jwtIsHmac = (alg: i32): boolean =>
  alg === JWT_ALG_HS256 || alg === JWT_ALG_HS384 || alg === JWT_ALG_HS512

/** The signature length `alg` gives under `key`, in bytes. */
const jwtSignatureSize = (key: JwtKey): i32 => {
  const alg: i32 = key.alg
  const hmac: HmacKey | null = key.hmac
  if (hmac !== null) {
    return hmac.size()
  }
  const rsa: RsaPublicKey | null = key.rsa
  if (rsa !== null) {
    return (rsa.bits + 7) >> 3
  }
  if (alg === JWT_ALG_ES256) {
    return P256_SIGNATURE_SIZE
  }
  if (alg === JWT_ALG_ES384) {
    return P384_SIGNATURE_SIZE
  }
  return 64
}

const jwtCopy = (a: u8[]): u8[] => jwtSlice(a, toI32(0), toI32(a.length))

const jwtLength = (a: u8[]): i32 => toI32(a.length)

/**
 * A key for one algorithm: what verifies its tokens and, for a key that can,
 * signs them. Make one with `jwtHmacKey`, `jwtRsaKey`, `jwtRsaKeyParts`,
 * `jwtEcKey`, `jwtEd25519Key`, `jwtEs256SigningKey` or
 * `jwtEd25519SigningKey`; `wipe()` it when it is done with. An HS key holds
 * its HMAC work hashers, so a key is one thread's, like a `JwtVerifier`: give
 * each worker its own.
 */
export class JwtKey {
  /** An HS key's pads, keyed once; `null` for any other. */
  readonly hmac: HmacKey | null
  /** An RS key; `null` for any other. */
  readonly rsa: RsaPublicKey | null
  /** An ES key's uncompressed point or an EdDSA key's 32 bytes; empty for HS and RS. */
  readonly pub: u8[]
  /** An ES256 or EdDSA signing key's private scalar or seed; empty for any other. */
  readonly priv: Secret<u8[]>
  /** The one algorithm this key verifies, `JWT_ALG_*`. */
  readonly alg: i32
  /** Whether `jwtSign` signs with this key. */
  readonly canSign: boolean
  /** Whether the key is in use: `wipe()` clears it, and a wiped key signs and verifies nothing. */
  live: boolean

  constructor(
    alg: i32,
    hmac: HmacKey | null,
    rsa: RsaPublicKey | null,
    pub: u8[],
    priv: Secret<u8[]>,
    canSign: boolean
  ) {
    this.alg = alg
    this.hmac = hmac
    this.rsa = rsa
    this.pub = pub
    this.priv = secret(expose(priv, jwtCopy))
    this.canSign = canSign
    this.live = true
  }

  /**
   * Zero the key's private copy and its HMAC pads. It neither signs nor
   * verifies after: its zeroed secret is one anyone could hold.
   */
  wipe(): void {
    this.live = false
    wipe(this.priv)
    const hmac: HmacKey | null = this.hmac
    if (hmac !== null) {
      hmac.wipe()
    }
  }
}

/** A key with no private half: the private slot is an empty array, made and wiped here. */
const jwtPublicKey = (
  alg: i32,
  hmac: HmacKey | null,
  rsa: RsaPublicKey | null,
  pub: u8[],
  canSign: boolean
): JwtKey => {
  const none: Secret<u8[]> = secret(new Array<u8>(0))
  const key = new JwtKey(alg, hmac, rsa, pub, none, canSign)
  wipe(none)
  return key
}

/**
 * An HS256, HS384 or HS512 key that verifies and signs. RFC 7518 §3.2 asks for
 * a key at least as long as the hash, so a shorter one answers `null`, as does
 * an `alg` that is not HS. The pads are keyed once, here; `key` stays the
 * caller's to wipe.
 */
export const jwtHmacKey = (alg: i32, key: Secret<u8[]>): JwtKey | null => {
  let hash: i32 = 0
  let size: i32 = 0
  if (alg === JWT_ALG_HS256) {
    hash = HMAC_SHA256
    size = 32
  } else if (alg === JWT_ALG_HS384) {
    hash = HMAC_SHA384
    size = 48
  } else if (alg === JWT_ALG_HS512) {
    hash = HMAC_SHA512
    size = 64
  } else {
    return null
  }
  if (expose(key, jwtLength) < size) {
    return null
  }
  return jwtPublicKey(alg, new HmacKey(hash, key), null, new Array<u8>(0), true)
}

/**
 * An RS256, RS384 or RS512 key from the DER of a PKCS#1 `RSAPublicKey`
 * (`rsaParsePublicKey`'s input). A key that does not parse, a modulus below
 * 2048 bits (RFC 7518 §3.3) or an `alg` that is not RS answers `null`.
 */
export const jwtRsaKey = (alg: i32, der: u8[]): JwtKey | null => {
  if (alg !== JWT_ALG_RS256 && alg !== JWT_ALG_RS384 && alg !== JWT_ALG_RS512) {
    return null
  }
  const rsa: RsaPublicKey | null = rsaParsePublicKey(der)
  if (rsa === null || rsa.bits < 2048) {
    return null
  }
  return jwtPublicKey(alg, null, rsa, new Array<u8>(0), false)
}

/** Appends a DER length. */
const jwtDerLength = (out: u8[], n: i32): void => {
  if (n < 128) {
    out.push(toU8(n))
  } else if (n < 256) {
    out.push(toU8(0x81))
    out.push(toU8(n))
  } else {
    out.push(toU8(0x82))
    out.push(toU8(n >> 8))
    out.push(toU8(n & 255))
  }
}

/** Appends `v` as a DER INTEGER: leading zero bytes dropped, one put back when the top bit is set. */
const jwtDerInteger = (out: u8[], v: u8[]): void => {
  let start: i32 = 0
  const last: i32 = toI32(v.length) - 1
  for (let i: i32 = 0; i < last && i < toI32(v.length); i += 1) {
    if (toI32(v[i]) !== 0) {
      break
    }
    start = i + 1
  }
  const pad: boolean = start < toI32(v.length) && (toI32(v[start]) & 0x80) !== 0
  out.push(toU8(2))
  jwtDerLength(out, toI32(v.length) - start + (pad ? 1 : 0))
  if (pad) {
    out.push(toU8(0))
  }
  for (let i: i32 = start; i >= 0 && i < toI32(v.length); i += 1) {
    out.push(v[i])
  }
}

/**
 * An RS key from its big-endian modulus and exponent, as a JWK's `n` and `e`
 * spell them once base64url-decoded (RFC 7518 §6.3.1). The same checks as
 * `jwtRsaKey`; parts too long for any key this module takes answer `null`.
 */
export const jwtRsaKeyParts = (alg: i32, n: u8[], e: u8[]): JwtKey | null => {
  if (toI32(n.length) > 2048 || toI32(e.length) > 8 || toI32(n.length) === 0 || toI32(e.length) === 0) {
    return null
  }
  const body: u8[] = []
  jwtDerInteger(body, n)
  jwtDerInteger(body, e)
  const der: u8[] = [toU8(0x30)]
  jwtDerLength(der, toI32(body.length))
  for (let i: i32 = 0; i < toI32(body.length); i += 1) {
    der.push(body[i])
  }
  return jwtRsaKey(alg, der)
}

/**
 * An ES256 or ES384 verifying key from its uncompressed point, `04 ‖ x ‖ y`
 * (65 or 97 bytes). A point of the wrong length or form answers `null`; one
 * off the curve makes every verification fail.
 */
export const jwtEcKey = (alg: i32, point: u8[]): JwtKey | null => {
  let size: i32 = 0
  if (alg === JWT_ALG_ES256) {
    size = P256_POINT_SIZE
  } else if (alg === JWT_ALG_ES384) {
    size = P384_POINT_SIZE
  }
  if (size === 0 || toI32(point.length) !== size || toI32(point[0]) !== 4) {
    return null
  }
  return jwtPublicKey(alg, null, null, jwtCopy(point), false)
}

/** An EdDSA (Ed25519) verifying key from its 32 bytes (RFC 8037 §2's `x`); another length answers `null`. */
export const jwtEd25519Key = (pub: u8[]): JwtKey | null => {
  if (toI32(pub.length) !== 32) {
    return null
  }
  return jwtPublicKey(JWT_ALG_EDDSA, null, null, jwtCopy(pub), false)
}

/**
 * An ES256 key that signs and verifies, from its 32-byte private scalar. A
 * scalar `p256PublicKey` refuses answers `null`. The key keeps a copy;
 * `priv` stays the caller's to wipe.
 */
export const jwtEs256SigningKey = (priv: Secret<u8[]>): JwtKey | null => {
  const pub: u8[] | null = p256PublicKey(priv)
  if (pub === null) {
    return null
  }
  return new JwtKey(JWT_ALG_ES256, null, null, pub, priv, true)
}

/**
 * An EdDSA key that signs and verifies, from its 32-byte seed (RFC 8037 §2's
 * `d`). A seed of another length answers `null`. The key keeps a copy; `seed`
 * stays the caller's to wipe.
 */
export const jwtEd25519SigningKey = (seed: Secret<u8[]>): JwtKey | null => {
  const pub: u8[] | null = ed25519PublicKey(seed)
  if (pub === null) {
    return null
  }
  return new JwtKey(JWT_ALG_EDDSA, null, null, pub, seed, true)
}

// ---- base64url --------------------------------------------------------------

/** The sextet `c` spells, or -1. */
const jwtSextet = (c: i32): i32 => {
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
 * Decodes the unpadded base64url `src[off .. off + len)` into `out` from 0 and
 * answers the byte count, or -1 for a length of 1 mod 4, a character outside
 * the alphabet, stray low bits in the last character, or more bytes than
 * `out` holds.
 */
const jwtDecode = (src: u8[], off: i32, len: i32, out: u8[]): i32 => {
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
    const v: i32 = jwtSextet(toI32(src[off + i]))
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

// ---- JSON -------------------------------------------------------------------
//
// The header and the claims are read by `JwtJson`, a pull reader of RFC 8259
// written for this module, rather than by `nish/json-tokenizer`: that one
// steps over blanks and string runs with `nish/bytes`'s scan kernels, which
// `std/crypto` keeps out of (docs/security/bytes.md, BYTES-2). This one reads
// a byte at a time. It answers the token kinds `jwt.ts` asks about and one
// error, `JWT_JSON_ERR`; it has no string or number limits of its own, since
// the window it reads is a decoded token part of at most `maxToken` bytes.

/** The top-level value is complete and only blanks follow it. */
const JWT_JSON_END: i32 = 0
const JWT_JSON_OBJECT_BEGIN: i32 = 1
const JWT_JSON_OBJECT_END: i32 = 2
const JWT_JSON_ARRAY_BEGIN: i32 = 3
const JWT_JSON_ARRAY_END: i32 = 4
/** A member's name and its colon; the value is the next token. */
const JWT_JSON_KEY: i32 = 5
const JWT_JSON_STRING: i32 = 6
const JWT_JSON_NUMBER: i32 = 7
/** `true`, `false` or `null`. */
const JWT_JSON_LITERAL: i32 = 8
/** Anything RFC 8259 refuses, the window ending inside a value, or a container past the depth. */
const JWT_JSON_ERR: i32 = -1

/** What `next()` reads at the cursor. */
const JWT_JSON_WANT_VALUE: i32 = 0
const JWT_JSON_WANT_VALUE_OR_CLOSE: i32 = 1
const JWT_JSON_WANT_KEY: i32 = 2
const JWT_JSON_WANT_KEY_OR_CLOSE: i32 = 3
const JWT_JSON_WANT_COMMA_OR_CLOSE: i32 = 4
const JWT_JSON_WANT_NOTHING: i32 = 5

/** What the depth stack holds for an open container. */
const JWT_JSON_IN_OBJECT: i32 = 1
const JWT_JSON_IN_ARRAY: i32 = 2

const JWT_CH_TAB: i32 = 9
const JWT_CH_NEWLINE: i32 = 10
const JWT_CH_RETURN: i32 = 13
const JWT_CH_SPACE: i32 = 32
const JWT_CH_QUOTE: i32 = 34
const JWT_CH_PLUS: i32 = 43
const JWT_CH_COMMA: i32 = 44
const JWT_CH_MINUS: i32 = 45
const JWT_CH_DOT: i32 = 46
const JWT_CH_0: i32 = 48
const JWT_CH_9: i32 = 57
const JWT_CH_COLON: i32 = 58
const JWT_CH_OPEN_BRACKET: i32 = 91
const JWT_CH_BACKSLASH: i32 = 92
const JWT_CH_CLOSE_BRACKET: i32 = 93
const JWT_CH_OPEN_BRACE: i32 = 123
const JWT_CH_CLOSE_BRACE: i32 = 125

/** The value of hex digit `b`, or `-1`. */
const jwtHexValue = (b: i32): i32 => {
  if (b >= 48 && b <= 57) {
    return b - 48
  }
  if (b >= 65 && b <= 70) {
    return b - 55
  }
  if (b >= 97 && b <= 102) {
    return b - 87
  }
  return -1
}

/** How many bytes code point `cp` takes in UTF-8. */
const jwtUtf8Width = (cp: i32): i32 => {
  if (cp < 0x80) {
    return 1
  }
  if (cp < 0x800) {
    return 2
  }
  if (cp < 0x10000) {
    return 3
  }
  return 4
}

/** Byte `k` of the `width`-byte UTF-8 form of `cp`. */
const jwtUtf8Byte = (cp: i32, width: i32, k: i32): i32 => {
  if (width === 1) {
    return cp
  }
  let lead: i32 = 0xf0
  if (width === 2) {
    lead = 0xc0
  } else if (width === 3) {
    lead = 0xe0
  }
  const shift: i32 = (width - 1 - k) * 6
  const tail: i32 = 0x80
  return k === 0 ? lead | (cp >> shift) : tail | ((cp >> shift) & 0x3f)
}

/**
 * A pull reader of one JSON value in `src[off, off + len)`, a token per
 * `next()`, as strict as RFC 8259: UTF-8 checked, every escape and surrogate
 * pair checked, no control byte in a string, no trailing bytes. Keys and
 * strings compare decoded (`keyEquals`), so an escaped name is the name.
 */
class JwtJson {
  /** The current integer's value, negated, when `integral` holds. */
  value: i64
  src: u8[]
  readonly stack: u8[]
  pos: i32
  end: i32
  depth: i32
  want: i32
  kind: i32
  failed: i32
  /** The current token's bytes, `src[tokStart, tokEnd)`; a string's and a key's include their quotes. */
  tokStart: i32
  tokEnd: i32
  /** The current key's or string's length once decoded. */
  textBytes: i32
  /** Whether the current number has no fraction or exponent and fits an `i64`. */
  integral: boolean

  /** A reader for values nested at most `maxDepth` containers deep; `reset` gives it a window. */
  constructor(src: u8[], maxDepth: i32) {
    this.value = toI64(0)
    this.src = src
    this.stack = new Array<u8>(maxDepth)
    this.pos = 0
    this.end = 0
    this.depth = 0
    this.want = JWT_JSON_WANT_VALUE
    this.kind = JWT_JSON_ERR
    this.failed = JWT_JSON_ERR
    this.tokStart = 0
    this.tokEnd = 0
    this.textBytes = 0
    this.integral = false
  }

  /** Starts over on `src[off, off + len)`; a window outside `src` fails the first `next()`. */
  reset(src: u8[], off: i32, len: i32): void {
    this.src = src
    this.pos = off
    this.end = off + len
    this.depth = 0
    this.want = JWT_JSON_WANT_VALUE
    this.kind = JWT_JSON_ERR
    this.failed = off < 0 || len < 0 || len > toI32(src.length) - off ? JWT_JSON_ERR : 0
    this.integral = false
  }

  /** The byte at `i`, or `-1` past the window. */
  at(i: i32): i32 {
    return i >= 0 && i < this.end && i < toI32(this.src.length) ? toI32(this.src[i]) : -1
  }

  /** Fails the reader for good. */
  fail(): i32 {
    this.failed = JWT_JSON_ERR
    this.kind = JWT_JSON_ERR
    return JWT_JSON_ERR
  }

  /** Steps over the four blanks RFC 8259 §2 allows. */
  skipBlanks(): void {
    let b: i32 = this.at(this.pos)
    while (b === JWT_CH_SPACE || b === JWT_CH_TAB || b === JWT_CH_NEWLINE || b === JWT_CH_RETURN) {
      this.pos += 1
      b = this.at(this.pos)
    }
  }

  /** The token after the current one, or `JWT_JSON_ERR`, answered again on every later call. */
  next(): i32 {
    if (this.failed !== 0) {
      return this.failed
    }
    this.skipBlanks()
    const want: i32 = this.want
    const b: i32 = this.at(this.pos)
    if (want === JWT_JSON_WANT_NOTHING) {
      if (b >= 0) {
        return this.fail()
      }
      this.kind = JWT_JSON_END
      return JWT_JSON_END
    }
    if (want === JWT_JSON_WANT_COMMA_OR_CLOSE) {
      if (b === JWT_CH_COMMA) {
        this.pos += 1
        this.skipBlanks()
        return toI32(this.stack[this.depth - 1]) === JWT_JSON_IN_OBJECT ? this.readKey() : this.readValue()
      }
      return this.readClose(b)
    }
    if (want === JWT_JSON_WANT_KEY_OR_CLOSE) {
      return b === JWT_CH_CLOSE_BRACE ? this.readClose(b) : this.readKey()
    }
    if (want === JWT_JSON_WANT_KEY) {
      return this.readKey()
    }
    if (want === JWT_JSON_WANT_VALUE_OR_CLOSE && b === JWT_CH_CLOSE_BRACKET) {
      return this.readClose(b)
    }
    return this.readValue()
  }

  /** `b`, the closer of the innermost container, popped. */
  readClose(b: i32): i32 {
    if (this.depth === 0) {
      return this.fail()
    }
    const inObject: boolean = toI32(this.stack[this.depth - 1]) === JWT_JSON_IN_OBJECT
    if (b !== (inObject ? JWT_CH_CLOSE_BRACE : JWT_CH_CLOSE_BRACKET)) {
      return this.fail()
    }
    this.tokStart = this.pos
    this.pos += 1
    this.tokEnd = this.pos
    this.depth -= 1
    this.afterValue()
    this.kind = inObject ? JWT_JSON_OBJECT_END : JWT_JSON_ARRAY_END
    return this.kind
  }

  /** What follows a complete value: nothing at the top, else a comma or a closer. */
  afterValue(): void {
    this.want = this.depth === 0 ? JWT_JSON_WANT_NOTHING : JWT_JSON_WANT_COMMA_OR_CLOSE
  }

  /** A member's name, its blanks and its colon. */
  readKey(): i32 {
    if (this.at(this.pos) !== JWT_CH_QUOTE || !this.scanString()) {
      return this.fail()
    }
    this.skipBlanks()
    if (this.at(this.pos) !== JWT_CH_COLON) {
      return this.fail()
    }
    this.pos += 1
    this.want = JWT_JSON_WANT_VALUE
    this.kind = JWT_JSON_KEY
    return JWT_JSON_KEY
  }

  /** A value at the cursor: an opener, a string, a number or a literal. */
  readValue(): i32 {
    const b: i32 = this.at(this.pos)
    if (b === JWT_CH_OPEN_BRACE || b === JWT_CH_OPEN_BRACKET) {
      if (this.depth >= toI32(this.stack.length)) {
        return this.fail()
      }
      const inObject: boolean = b === JWT_CH_OPEN_BRACE
      this.stack[this.depth] = toU8(inObject ? JWT_JSON_IN_OBJECT : JWT_JSON_IN_ARRAY)
      this.depth += 1
      this.tokStart = this.pos
      this.pos += 1
      this.tokEnd = this.pos
      this.want = inObject ? JWT_JSON_WANT_KEY_OR_CLOSE : JWT_JSON_WANT_VALUE_OR_CLOSE
      this.kind = inObject ? JWT_JSON_OBJECT_BEGIN : JWT_JSON_ARRAY_BEGIN
      return this.kind
    }
    let k: i32 = JWT_JSON_ERR
    if (b === JWT_CH_QUOTE) {
      k = this.scanString() ? JWT_JSON_STRING : JWT_JSON_ERR
    } else if (b === JWT_CH_MINUS || (b >= JWT_CH_0 && b <= JWT_CH_9)) {
      k = this.scanNumber() ? JWT_JSON_NUMBER : JWT_JSON_ERR
    } else if (this.scanWord("true") || this.scanWord("false") || this.scanWord("null")) {
      k = JWT_JSON_LITERAL
    }
    if (k < 0) {
      return this.fail()
    }
    this.afterValue()
    this.kind = k
    return k
  }

  /** Whether `word` is at the cursor, stepped over if so. */
  scanWord(word: string): boolean {
    const n: i32 = toI32(word.length)
    for (let i: i32 = 0; i < n; i += 1) {
      if (this.at(this.pos + i) !== toI32(word.charCodeAt(i))) {
        return false
      }
    }
    this.tokStart = this.pos
    this.pos += n
    this.tokEnd = this.pos
    return true
  }

  /** The digits at the cursor, accumulated negated into `value`; how many, and `integral` cleared on overflow. */
  scanDigits(bound: i64): i32 {
    const ten: i64 = toI64(10)
    let n: i32 = 0
    let b: i32 = this.at(this.pos)
    while (b >= JWT_CH_0 && b <= JWT_CH_9) {
      const digit: i64 = toI64(b - JWT_CH_0)
      if (this.integral) {
        if (this.value < (bound + digit) / ten) {
          this.integral = false
        } else {
          this.value = this.value * ten - digit
        }
      }
      n += 1
      this.pos += 1
      b = this.at(this.pos)
    }
    return n
  }

  /**
   * A number of RFC 8259 §6: `-? (0 | [1-9][0-9]*) (. [0-9]+)? ([eE] [+-]? [0-9]+)?`.
   * `integral` says whether it has neither fraction nor exponent and fits an
   * `i64` for its sign; accumulating negated reaches -2^63, where a positive
   * number stops at 2^63 - 1.
   */
  scanNumber(): boolean {
    this.tokStart = this.pos
    const negative: boolean = this.at(this.pos) === JWT_CH_MINUS
    if (negative) {
      this.pos += 1
    }
    // -2^63 has no literal (NL2055): -2^31 shifted up 32 bits. A bare literal
    // would be a double under Node, where an `i64` is a BigInt.
    const min: i64 = toI64(-2147483648) << toI64(32)
    const bound: i64 = negative ? min : min + toI64(1)
    this.value = toI64(0)
    this.integral = true
    const first: i32 = this.at(this.pos)
    if (first === JWT_CH_0) {
      this.pos += 1
    } else if (this.scanDigits(bound) === 0) {
      return false
    }
    if (this.at(this.pos) === JWT_CH_DOT) {
      this.pos += 1
      this.integral = false
      if (this.scanDigits(bound) === 0) {
        return false
      }
    }
    const e: i32 = this.at(this.pos)
    if (e === 101 || e === 69) {
      this.pos += 1
      this.integral = false
      const sign: i32 = this.at(this.pos)
      if (sign === JWT_CH_PLUS || sign === JWT_CH_MINUS) {
        this.pos += 1
      }
      if (this.scanDigits(bound) === 0) {
        return false
      }
    }
    this.tokEnd = this.pos
    return true
  }

  /**
   * The code point of the escape at `i` (a backslash), a surrogate pair
   * joined, or `-1` for one RFC 8259 §7 refuses or a lone surrogate.
   */
  escapeCodePoint(i: i32): i32 {
    const c: i32 = this.at(i + 1)
    if (c === JWT_CH_QUOTE || c === JWT_CH_BACKSLASH || c === 47) {
      return c
    }
    if (c === 98) {
      return 8
    }
    if (c === 102) {
      return 12
    }
    if (c === 110) {
      return JWT_CH_NEWLINE
    }
    if (c === 114) {
      return JWT_CH_RETURN
    }
    if (c === 116) {
      return JWT_CH_TAB
    }
    if (c !== 117) {
      return -1
    }
    const hi: i32 = this.hex4(i + 2)
    if (hi < 0 || (hi >= 0xdc00 && hi <= 0xdfff)) {
      return -1
    }
    if (hi < 0xd800 || hi > 0xdbff) {
      return hi
    }
    if (this.at(i + 6) !== JWT_CH_BACKSLASH || this.at(i + 7) !== 117) {
      return -1
    }
    const lo: i32 = this.hex4(i + 8)
    if (lo < 0xdc00 || lo > 0xdfff) {
      return -1
    }
    const plane: i32 = 0x10000
    return plane + ((hi - 0xd800) << 10) + (lo - 0xdc00)
  }

  /** The four hex digits at `i` as a number, or `-1`. */
  hex4(i: i32): i32 {
    let v: i32 = 0
    for (let k: i32 = 0; k < 4; k += 1) {
      const d: i32 = jwtHexValue(this.at(i + k))
      if (d < 0) {
        return -1
      }
      v = (v << 4) | d
    }
    return v
  }

  /** How many bytes the escape at `i` takes, given the code point it decodes to. */
  escapeLength(i: i32, cp: i32): i32 {
    if (this.at(i + 1) !== 117) {
      return 2
    }
    return cp >= 0x10000 ? 12 : 6
  }

  /**
   * How many continuation bytes the lead byte at `i` takes, checked against
   * RFC 3629 §4 (no overlong form, no surrogate, nothing past U+10FFFF), or
   * `-1`.
   */
  utf8Tail(i: i32): i32 {
    const b: i32 = this.at(i)
    let n: i32 = 0
    let lo: i32 = 0x80
    let hi: i32 = 0xbf
    if (b >= 0xc2 && b <= 0xdf) {
      n = 1
    } else if (b >= 0xe0 && b <= 0xef) {
      n = 2
      lo = b === 0xe0 ? 0xa0 : 0x80
      hi = b === 0xed ? 0x9f : 0xbf
    } else if (b >= 0xf0 && b <= 0xf4) {
      n = 3
      lo = b === 0xf0 ? 0x90 : 0x80
      hi = b === 0xf4 ? 0x8f : 0xbf
    } else {
      return -1
    }
    const second: i32 = this.at(i + 1)
    if (second < lo || second > hi) {
      return -1
    }
    for (let k: i32 = 2; k <= n; k += 1) {
      const c: i32 = this.at(i + k)
      if (c < 0x80 || c > 0xbf) {
        return -1
      }
    }
    return n
  }

  /** The string at the cursor, checked, stepped over, its decoded length in `textBytes`. */
  scanString(): boolean {
    this.tokStart = this.pos
    let i: i32 = this.pos + 1
    let decoded: i32 = 0
    while (true) {
      const b: i32 = this.at(i)
      if (b < 0x20) {
        // A control byte, or `-1`: the window ended inside the string.
        return false
      }
      if (b === JWT_CH_QUOTE) {
        break
      }
      if (b === JWT_CH_BACKSLASH) {
        const cp: i32 = this.escapeCodePoint(i)
        if (cp < 0) {
          return false
        }
        decoded += jwtUtf8Width(cp)
        i += this.escapeLength(i, cp)
      } else if (b < 0x80) {
        decoded += 1
        i += 1
      } else {
        const tail: i32 = this.utf8Tail(i)
        if (tail < 0) {
          return false
        }
        decoded += tail + 1
        i += tail + 1
      }
    }
    this.pos = i + 1
    this.tokEnd = this.pos
    this.textBytes = decoded
    return true
  }

  /** Whether the current token is a key or a string. */
  isText(): boolean {
    return this.kind === JWT_JSON_KEY || this.kind === JWT_JSON_STRING
  }

  /** The current key's or string's length once decoded, or `-1`. */
  stringLength(): i32 {
    return this.isText() ? this.textBytes : -1
  }

  /**
   * Whether the current key or string, decoded, is exactly `name`'s bytes;
   * `false` when the token is neither. Under Node, `charCodeAt` is a UTF-16
   * code unit, so only an ASCII name answers as it does natively, as with
   * `nish/json-tokenizer`'s `keyEquals`.
   */
  keyEquals(name: string): boolean {
    const n: i32 = toI32(name.length)
    if (!this.isText() || n !== this.textBytes) {
      return false
    }
    const end: i32 = this.tokEnd - 1
    let i: i32 = this.tokStart + 1
    let o: i32 = 0
    while (i < end) {
      const b: i32 = this.at(i)
      if (b !== JWT_CH_BACKSLASH) {
        if (o >= n || b !== toI32(name.charCodeAt(o))) {
          return false
        }
        o += 1
        i += 1
        continue
      }
      const cp: i32 = this.escapeCodePoint(i)
      const width: i32 = jwtUtf8Width(cp)
      for (let k: i32 = 0; k < width; k += 1) {
        if (o >= n || jwtUtf8Byte(cp, width, k) !== toI32(name.charCodeAt(o))) {
          return false
        }
        o += 1
      }
      i += this.escapeLength(i, cp)
    }
    return o === n
  }

  /**
   * Writes the current key's or string's decoded bytes to `out` from `at` and
   * answers how many; `-1`, writing nothing, when the token is neither or
   * `out` has too little room.
   */
  stringInto(out: u8[], at: i32): i32 {
    if (!this.isText() || at < 0 || at > toI32(out.length) - this.textBytes) {
      return -1
    }
    const end: i32 = this.tokEnd - 1
    let i: i32 = this.tokStart + 1
    let o: i32 = at
    while (i < end) {
      const b: i32 = this.at(i)
      if (b !== JWT_CH_BACKSLASH) {
        if (o >= 0 && o < toI32(out.length)) {
          out[o] = toU8(b)
        }
        o += 1
        i += 1
        continue
      }
      const cp: i32 = this.escapeCodePoint(i)
      const width: i32 = jwtUtf8Width(cp)
      for (let k: i32 = 0; k < width; k += 1) {
        if (o >= 0 && o < toI32(out.length)) {
          out[o] = toU8(jwtUtf8Byte(cp, width, k))
        }
        o += 1
      }
      i += this.escapeLength(i, cp)
    }
    return o - at
  }

  /** Whether the current token is a number without fraction or exponent that fits an `i64`. */
  isInteger(): boolean {
    return this.kind === JWT_JSON_NUMBER && this.integral
  }

  /** The current number as an `i64` when `isInteger()` holds, else `0`. */
  numberI64(): i64 {
    if (!this.isInteger()) {
      return toI64(0)
    }
    return this.at(this.tokStart) === JWT_CH_MINUS ? this.value : -this.value
  }

  /**
   * Steps over the value the current token starts: after a key, its value;
   * after an opener, everything through its closer; after a scalar or a
   * closer, nothing. Answers the kind of the last token read, or `JWT_JSON_ERR`.
   */
  skipValue(): i32 {
    if (this.failed !== 0) {
      return this.failed
    }
    let k: i32 = this.kind
    if (k === JWT_JSON_KEY) {
      k = this.next()
    }
    if (k !== JWT_JSON_OBJECT_BEGIN && k !== JWT_JSON_ARRAY_BEGIN) {
      return k
    }
    const outer: i32 = this.depth - 1
    while (true) {
      k = this.next()
      if (k < 0 || this.depth === outer) {
        return k
      }
    }
  }
}

// ---- verify -----------------------------------------------------------------

/** `v` held to `[lo, hi]`. */
const jwtClamp = (v: i64, lo: i64, hi: i64): i64 => {
  if (v < lo) {
    return lo
  }
  return v > hi ? hi : v
}

/** The bytes `[off, off + len)` of `src` as a fresh array. */
const jwtSlice = (src: u8[], off: i32, len: i32): u8[] => {
  const out: u8[] = new Array<u8>(len)
  for (let i: i32 = 0; i < len && i < toI32(out.length); i += 1) {
    out[i] = src[off + i]
  }
  return out
}

/**
 * Whether `sig[0 .. sigLen)` is `key`'s public-key signature over
 * `src[off .. off + len)`. The verifiers take whole arrays, so the message and
 * the signature are copied, and the RSA, P-256, P-384 and Ed25519 verifiers
 * store allocations of their own, which no arena block may release around
 * (NL2424): a public-key verify allocates, and the collector takes it back.
 * Only HMAC verifies allocation-free (`hmacKeyedVerify`).
 */
const jwtVerifyPublic = (key: JwtKey, src: u8[], off: i32, len: i32, sig: u8[], sigLen: i32): boolean => {
  const msg: u8[] = jwtSlice(src, off, len)
  const s: u8[] = jwtSlice(sig, 0, sigLen)
  const alg: i32 = key.alg
  const rsa: RsaPublicKey | null = key.rsa
  if (rsa !== null) {
    let hash: i32 = RSA_HASH_SHA512
    if (alg === JWT_ALG_RS256) {
      hash = RSA_HASH_SHA256
    } else if (alg === JWT_ALG_RS384) {
      hash = RSA_HASH_SHA384
    }
    return rsaVerifyPkcs1v15(rsa, hash, msg, s)
  }
  if (alg === JWT_ALG_ES256) {
    return p256VerifySha256(key.pub, msg, s)
  }
  if (alg === JWT_ALG_ES384) {
    return p384VerifySha384(key.pub, msg, s)
  }
  if (alg === JWT_ALG_EDDSA) {
    return ed25519Verify(key.pub, msg, s)
  }
  return false
}

/**
 * Verifies compact JWS tokens and checks their claims, reusing its buffers:
 * make one per thread and call `verify` per token. The settings are public
 * fields, read on every `verify`. After `JWT_OK`, `claims[0 .. claimsLen)`
 * is the payload's JSON for the caller's own claims, and `exp`, `nbf` and
 * `iat` hold the time claims when `hasExp`, `hasNbf` and `hasIat` say so.
 */
export class JwtVerifier {
  /** Seconds of clock skew allowed to `exp`, `nbf` and `iat`; held to `[0, 2^31 - 1]`. */
  leeway: i64
  /** The `iss` a token must carry, or `null` for any. */
  issuer: string | null
  /** The audience a token's `aud` must name, or `null` to refuse a token with any `aud`. */
  audience: string | null
  /** The `sub` a token must carry, or `null` for any. */
  subject: string | null
  /** The header `typ` a token must carry (RFC 8725 §3.11), or `null` for any. */
  typ: string | null
  /** The decoded payload of the last token, `claimsLen` bytes of it valid after `JWT_OK`. */
  readonly claims: u8[]
  exp: i64
  nbf: i64
  iat: i64
  readonly part: u8[]
  readonly sig: u8[]
  readonly text: u8[]
  readonly tok: JwtJson
  /** The largest token taken, in bytes. */
  readonly maxToken: i32
  claimsLen: i32
  /** Whether a token without `exp` is refused; on by default. */
  requireExp: boolean
  hasExp: boolean
  hasNbf: boolean
  hasIat: boolean

  /** A verifier for tokens of up to `maxToken` bytes; outside `[16, JWT_MAX_TOKEN_LIMIT]` panics. */
  constructor(maxToken: i32) {
    if (maxToken < 16 || maxToken > JWT_MAX_TOKEN_LIMIT) {
      panic("JwtVerifier: maxToken outside [16, JWT_MAX_TOKEN_LIMIT]")
    }
    this.leeway = toI64(0)
    this.issuer = null
    this.audience = null
    this.subject = null
    this.typ = null
    this.requireExp = true
    this.maxToken = maxToken
    const decoded: i32 = (maxToken >> 2) * 3 + 2
    this.claims = new Array<u8>(decoded)
    this.claimsLen = 0
    this.exp = toI64(0)
    this.nbf = toI64(0)
    this.iat = toI64(0)
    this.hasExp = false
    this.hasNbf = false
    this.hasIat = false
    this.part = new Array<u8>(decoded)
    this.sig = new Array<u8>(JWT_MAX_SIGNATURE)
    this.text = new Array<u8>(maxToken)
    this.tok = new JwtJson(this.part, JWT_MAX_DEPTH)
  }

  /**
   * `verify` on the bytes of `token`, copied into the verifier's own buffer
   * first (a string's UTF-8 bytes); a token longer than `maxToken` is refused
   * before the copy.
   */
  verifyString(key: JwtKey, token: string, now: i64): i32 {
    if (toI32(token.length) > this.maxToken) {
      return JWT_ERR_SIZE
    }
    const n: i32 = toI32(token.length)
    const text: u8[] = this.text
    for (let i: i32 = 0; i < n && i < toI32(text.length); i += 1) {
      const c: i32 = toI32(token.charCodeAt(i))
      // No token character is above 0x7F; where a string holds UTF-16 code
      // units, cutting one to its low byte could make it a base64url one.
      if (c > 0x7f) {
        return JWT_ERR_FORMAT
      }
      text[i] = toU8(c)
    }
    return this.verify(key, text, toI32(0), n, now)
  }

  /**
   * Verifies the token `src[off .. off + len)` under `key` and checks its
   * claims at `now` (seconds since 1970): `JWT_OK`, or the first
   * `JWT_ERR_*` that applies, in the order the module comment lists.
   */
  verify(key: JwtKey, src: u8[], off: i32, len: i32, now: i64): i32 {
    this.claimsLen = 0
    this.hasExp = false
    this.hasNbf = false
    this.hasIat = false
    if (len < 0 || len > this.maxToken || off < 0 || off > toI32(src.length) - len) {
      return JWT_ERR_SIZE
    }
    let d1: i32 = -1
    let d2: i32 = -1
    for (let i: i32 = off; i < off + len && i < toI32(src.length); i += 1) {
      if (toI32(src[i]) === JWT_DOT) {
        if (d1 < 0) {
          d1 = i
        } else if (d2 < 0) {
          d2 = i
        } else {
          return JWT_ERR_FORMAT
        }
      }
    }
    if (d2 < 0) {
      return JWT_ERR_FORMAT
    }
    const part: u8[] = this.part
    const headerLen: i32 = jwtDecode(src, off, d1 - off, part)
    if (headerLen <= 0) {
      return JWT_ERR_FORMAT
    }
    const header: i32 = this.checkHeader(key, headerLen)
    if (header !== JWT_OK) {
      return header
    }
    const sigText: i32 = off + len - d2 - 1
    const sigSize: i32 = jwtSignatureSize(key)
    if (sigText > ((JWT_MAX_SIGNATURE + 2) / 3) * 4) {
      return JWT_ERR_SIGNATURE
    }
    const sig: u8[] = this.sig
    const sigLen: i32 = jwtDecode(src, d2 + 1, sigText, sig)
    if (sigLen < 0) {
      return JWT_ERR_FORMAT
    }
    if (sigLen !== sigSize) {
      return JWT_ERR_SIGNATURE
    }
    const hmac: HmacKey | null = key.hmac
    // The check follows the algorithm: an HS name with an HMAC key, any other name without one.
    if (!key.live || jwtIsHmac(key.alg) !== (hmac !== null)) {
      return JWT_ERR_SIGNATURE
    }
    const good: boolean =
      hmac !== null
        ? hmacKeyedVerify(hmac, src, off, d2 - off, sig, 0)
        : jwtVerifyPublic(key, src, off, d2 - off, sig, sigLen)
    if (!good) {
      return JWT_ERR_SIGNATURE
    }
    const claims: u8[] = this.claims
    const claimsLen: i32 = jwtDecode(src, d1 + 1, d2 - d1 - 1, claims)
    if (claimsLen < 0) {
      return JWT_ERR_FORMAT
    }
    return this.checkClaims(claimsLen, jwtClamp(now, toI64(0), toI64(JWT_MAX_NOW)))
  }

  /** The header in `part[0 .. len)` checked against `key`'s algorithm and the verifier's `typ`. */
  checkHeader(key: JwtKey, len: i32): i32 {
    const tok: JwtJson = this.tok
    tok.reset(this.part, toI32(0), len)
    if (tok.next() !== JWT_JSON_OBJECT_BEGIN) {
      return JWT_ERR_HEADER
    }
    let seenAlg: boolean = false
    let seenTyp: boolean = false
    let seenKid: boolean = false
    let typOk: boolean = false
    const name: string = jwtAlgName(key.alg)
    const typ: string | null = this.typ
    while (true) {
      const k: i32 = tok.next()
      if (k === JWT_JSON_OBJECT_END) {
        break
      }
      if (k !== JWT_JSON_KEY) {
        return JWT_ERR_HEADER
      }
      if (tok.keyEquals("alg")) {
        if (seenAlg) {
          return JWT_ERR_HEADER
        }
        seenAlg = true
        if (tok.next() !== JWT_JSON_STRING || !tok.keyEquals(name)) {
          return JWT_ERR_ALG
        }
      } else if (tok.keyEquals("typ") || tok.keyEquals("kid")) {
        const isTyp: boolean = tok.keyEquals("typ")
        if ((isTyp && seenTyp) || (!isTyp && seenKid)) {
          return JWT_ERR_HEADER
        }
        if (tok.next() !== JWT_JSON_STRING) {
          return JWT_ERR_HEADER
        }
        if (isTyp) {
          seenTyp = true
          typOk = typ !== null && tok.keyEquals(typ)
        } else {
          seenKid = true
        }
      } else if (tok.keyEquals("crit") || tok.keyEquals("b64")) {
        return JWT_ERR_HEADER
      } else if (tok.skipValue() < 0) {
        return JWT_ERR_HEADER
      }
    }
    if (tok.next() !== JWT_JSON_END) {
      return JWT_ERR_HEADER
    }
    if (!seenAlg) {
      return JWT_ERR_ALG
    }
    if (typ !== null && !typOk) {
      return JWT_ERR_TYPE
    }
    return JWT_OK
  }

  /** The payload in `claims[0 .. len)` parsed and checked at `now`. */
  checkClaims(len: i32, now: i64): i32 {
    const tok: JwtJson = this.tok
    tok.reset(this.claims, toI32(0), len)
    if (tok.next() !== JWT_JSON_OBJECT_BEGIN) {
      return JWT_ERR_CLAIMS
    }
    const issuer: string | null = this.issuer
    const audience: string | null = this.audience
    const subject: string | null = this.subject
    let hasIss: boolean = false
    let hasSub: boolean = false
    let hasAud: boolean = false
    let issOk: boolean = false
    let subOk: boolean = false
    let audOk: boolean = false
    while (true) {
      const k: i32 = tok.next()
      if (k === JWT_JSON_OBJECT_END) {
        break
      }
      if (k !== JWT_JSON_KEY) {
        return JWT_ERR_CLAIMS
      }
      if (tok.keyEquals("exp") || tok.keyEquals("nbf") || tok.keyEquals("iat")) {
        let which: i32 = 2
        let seen: boolean = this.hasIat
        if (tok.keyEquals("exp")) {
          which = 0
          seen = this.hasExp
        } else if (tok.keyEquals("nbf")) {
          which = 1
          seen = this.hasNbf
        }
        if (seen || tok.next() !== JWT_JSON_NUMBER || !tok.isInteger()) {
          return JWT_ERR_CLAIMS
        }
        const v: i64 = tok.numberI64()
        if (which === 0) {
          this.exp = v
          this.hasExp = true
        } else if (which === 1) {
          this.nbf = v
          this.hasNbf = true
        } else {
          this.iat = v
          this.hasIat = true
        }
      } else if (tok.keyEquals("iss") || tok.keyEquals("sub")) {
        const isIss: boolean = tok.keyEquals("iss")
        if ((isIss && hasIss) || (!isIss && hasSub) || tok.next() !== JWT_JSON_STRING) {
          return JWT_ERR_CLAIMS
        }
        if (isIss) {
          hasIss = true
          issOk = issuer !== null && tok.keyEquals(issuer)
        } else {
          hasSub = true
          subOk = subject !== null && tok.keyEquals(subject)
        }
      } else if (tok.keyEquals("aud")) {
        if (hasAud) {
          return JWT_ERR_CLAIMS
        }
        hasAud = true
        const v: i32 = tok.next()
        if (v === JWT_JSON_STRING) {
          audOk = audience !== null && tok.keyEquals(audience)
        } else if (v === JWT_JSON_ARRAY_BEGIN) {
          while (true) {
            const e: i32 = tok.next()
            if (e === JWT_JSON_ARRAY_END) {
              break
            }
            if (e !== JWT_JSON_STRING) {
              return JWT_ERR_CLAIMS
            }
            if (audience !== null && tok.keyEquals(audience)) {
              audOk = true
            }
          }
        } else {
          return JWT_ERR_CLAIMS
        }
      } else if (tok.skipValue() < 0) {
        return JWT_ERR_CLAIMS
      }
    }
    if (tok.next() !== JWT_JSON_END) {
      return JWT_ERR_CLAIMS
    }
    if (this.requireExp && !this.hasExp) {
      return JWT_ERR_CLAIMS
    }
    const leeway: i64 = jwtClamp(this.leeway, toI64(0), toI64(JWT_MAX_LEEWAY))
    if (this.hasExp && !(now - leeway < this.exp)) {
      return JWT_ERR_EXPIRED
    }
    if (this.hasNbf && this.nbf > now + leeway) {
      return JWT_ERR_NOT_YET
    }
    if (this.hasIat && this.iat > now + leeway) {
      return JWT_ERR_IAT
    }
    if (issuer !== null && !issOk) {
      return JWT_ERR_ISSUER
    }
    if (hasAud ? !audOk : audience !== null) {
      return JWT_ERR_AUDIENCE
    }
    if (subject !== null && !subOk) {
      return JWT_ERR_SUBJECT
    }
    this.claimsLen = len
    return JWT_OK
  }

  /**
   * The header's `kid` of the token `src[off .. off + len)`, written at
   * `out[0 ..)`: its length, or -1 when the token is malformed, has no `kid`
   * or its `kid` does not fit `out`. This reads the header **before** any
   * signature is checked, so it only chooses which key to verify with; the
   * `kid` proves nothing until `verify` answers `JWT_OK` under that key.
   */
  peekKid(src: u8[], off: i32, len: i32, out: u8[]): i32 {
    if (len < 0 || len > this.maxToken || off < 0 || off > toI32(src.length) - len) {
      return -1
    }
    let d1: i32 = -1
    for (let i: i32 = off; i < off + len && i < toI32(src.length) && d1 < 0; i += 1) {
      if (toI32(src[i]) === JWT_DOT) {
        d1 = i
      }
    }
    if (d1 < 0) {
      return -1
    }
    const n: i32 = jwtDecode(src, off, d1 - off, this.part)
    if (n <= 0) {
      return -1
    }
    const tok: JwtJson = this.tok
    tok.reset(this.part, toI32(0), n)
    if (tok.next() !== JWT_JSON_OBJECT_BEGIN) {
      return -1
    }
    while (true) {
      const k: i32 = tok.next()
      if (k !== JWT_JSON_KEY) {
        return -1
      }
      if (tok.keyEquals("kid")) {
        if (tok.next() !== JWT_JSON_STRING || tok.stringLength() > toI32(out.length)) {
          return -1
        }
        return tok.stringInto(out, toI32(0))
      }
      if (tok.skipValue() < 0) {
        return -1
      }
    }
  }
}

// ---- sign -------------------------------------------------------------------

/** Whether `src[0 .. len)` is one JSON object and nothing more. */
const jwtIsObject = (src: u8[]): boolean => {
  const tok = new JwtJson(src, JWT_MAX_DEPTH)
  tok.reset(src, toI32(0), toI32(src.length))
  if (tok.next() !== JWT_JSON_OBJECT_BEGIN || tok.skipValue() !== JWT_JSON_OBJECT_END) {
    return false
  }
  return tok.next() === JWT_JSON_END
}

/** Whether `kid` is 1 to 256 printable ASCII characters without `"` or `\`, so it needs no JSON escape. */
const jwtKidFits = (kid: string): boolean => {
  if (kid.length === 0 || kid.length > 256) {
    return false
  }
  for (let i: i32 = 0; i < toI32(kid.length); i += 1) {
    const c: i32 = toI32(kid.charCodeAt(i))
    if (c < 0x20 || c > 0x7e || c === 34 || c === 92) {
      return false
    }
  }
  return true
}

/** Whether every code unit of `text` is ASCII, so `jwtBytesOf` keeps it whole. */
const jwtIsAscii = (text: string): boolean => {
  for (let i: i32 = 0; i < toI32(text.length); i += 1) {
    if (toI32(text.charCodeAt(i)) > 0x7f) {
      return false
    }
  }
  return true
}

/** The code units of `text` as bytes; the caller has checked they are ASCII. */
const jwtBytesOf = (text: string): u8[] => {
  const n: i32 = toI32(text.length)
  const out: u8[] = new Array<u8>(n)
  for (let i: i32 = 0; i < n && i < toI32(out.length); i += 1) {
    out[i] = toU8(text.charCodeAt(i))
  }
  return out
}

/**
 * A compact JWS over the JSON object `claims`, signed with `key`, with a
 * `kid` header member when `kid` is not `null`. Answers `null` when `key`
 * cannot sign (RS, ES384 or a verify-only key), when `claims` is not one JSON
 * object, or when `kid` is empty, longer than 256 bytes, or holds a byte that
 * would need a JSON escape. The claims are signed as given: this function
 * neither adds nor checks any claim.
 */
export const jwtSignKid = (key: JwtKey, kid: string | null, claims: u8[]): string | null => {
  if (!key.canSign || !key.live || !jwtIsObject(claims)) {
    return null
  }
  let header: string = '{"alg":"' + jwtAlgName(key.alg) + '"'
  if (kid !== null) {
    if (!jwtKidFits(kid)) {
      return null
    }
    header = header + ',"kid":"' + kid + '"'
  }
  header = header + ',"typ":"JWT"}'
  const input: string = base64urlEncode(jwtBytesOf(header)) + "." + base64urlEncode(claims)
  const msg: u8[] = jwtBytesOf(input)
  const hmac: HmacKey | null = key.hmac
  let sig: u8[] | null = null
  if (hmac !== null) {
    const tag: u8[] = new Array<u8>(hmac.size())
    hmacKeyedInto(hmac, msg, 0, toI32(msg.length), tag, 0)
    sig = tag
  } else if (key.alg === JWT_ALG_ES256) {
    sig = p256SignSha256(key.priv, msg)
  } else if (key.alg === JWT_ALG_EDDSA) {
    sig = ed25519Sign(key.priv, msg)
  }
  if (sig === null) {
    return null
  }
  return input + "." + base64urlEncode(sig)
}

/** `jwtSignKid` with no `kid`. */
export const jwtSign = (key: JwtKey, claims: u8[]): string | null => jwtSignKid(key, null, claims)

/**
 * `jwtSign` over the bytes of the string `claims`. Answers `null` for claims
 * outside ASCII, as `verifyString` refuses them: escape such text (`\u00e9`)
 * or pass its UTF-8 bytes to `jwtSign`.
 */
export const jwtSignString = (key: JwtKey, claims: string): string | null =>
  jwtIsAscii(claims) ? jwtSignKid(key, null, jwtBytesOf(claims)) : null
