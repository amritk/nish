// `JwtVerifier.verify`'s refusal paths that the `crypto_jwt` tokens leave
// unread: the base64url decoder (`jwtDecode`) on the header, the signature and
// the payload, the signature's text and buffer limits, and the JSON reader's
// failures in the header and the claims. Each token is built here and MACed
// with `hmacSha256` under one 32-byte key, so a payload refusal is the
// payload's, never the signature's. `jwtSlice` is reached through ES256 and
// EdDSA keys, whose verify copies the message and the signature out of the
// token; it refuses no window `verify` lets through, and the last checks show
// those copies verifying a token's own bytes at an offset inside a larger
// array.
import { Suite } from "nish/testing";
import { base64urlEncode } from "nish/crypto/base64url";
import { hmacSha256 } from "nish/crypto/hmac";
import {
  JWT_ALG_EDDSA,
  JWT_ALG_ES256,
  JWT_ALG_HS256,
  JWT_ERR_CLAIMS,
  JWT_ERR_FORMAT,
  JWT_ERR_HEADER,
  JWT_ERR_SIGNATURE,
  JWT_MAX_TOKEN,
  JWT_OK,
  JwtKey,
  JwtVerifier,
  jwtEd25519SigningKey,
  jwtEs256SigningKey,
  jwtHmacKey,
  jwtSignString,
} from "nish/crypto/jwt";
import { Secret, secret, wipe } from "nish:secret";

const NOW: i64 = 1700000000;
const HEADER: string = "{\"alg\":\"HS256\"}";
const ALPHABET: string = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

const bytesOf = (text: string): u8[] => {
  const out: u8[] = [];
  for (let i: i32 = 0; i < toI32(text.length); i++) {
    out.push(toU8(text.charCodeAt(i)));
  }
  return out;
};

const keyBytes = (): u8[] => {
  const out: u8[] = [];
  for (let i: i32 = 0; i < 32; i++) {
    out.push(toU8(i + 1));
  }
  return out;
};

/** `header.payload` as written, MACed under `keyBytes()`: the signature always verifies. */
const signed = (header: string, payload: string): string => {
  const input: string = header + "." + payload;
  return input + "." + base64urlEncode(hmacSha256(keyBytes(), bytesOf(input)));
};

/** A token whose header and claims are the JSON texts given. */
const token = (header: string, claims: string): string => signed(base64urlEncode(bytesOf(header)), base64urlEncode(bytesOf(claims)));

/** `text` with its last base64url character's low bit set: bits the decoder must find zero. */
const strayBit = (text: string): string => {
  const last: i32 = ALPHABET.indexOf(text.substring(toI32(text.length) - 1));
  return text.substring(0, toI32(text.length) - 1) + ALPHABET.substring(last | 1, (last | 1) + 1);
};

/** Where the last `.` of `text` is. */
const lastDot = (text: string): i32 => {
  let at: i32 = -1;
  for (let i: i32 = 0; i < toI32(text.length); i++) {
    if (toI32(text.charCodeAt(i)) === 46) {
      at = i;
    }
  }
  return at;
};

/** `verifyString`'s answer, as text for `eqStr`. */
const codeOf = (v: JwtVerifier, key: JwtKey, tok: string): string => `${v.verifyString(key, tok, NOW)}`;

const want = (c: i32): string => `${c}`;

const repeat = (s: string, n: i32): string => {
  let out: string = "";
  for (let i: i32 = 0; i < n; i++) {
    out = out + s;
  }
  return out;
};

export const main = (): i32 => {
  const t = new Suite("nish/crypto/jwt refusals");
  const raw: Secret<u8[]> = secret(keyBytes());
  const keyOrNull: JwtKey | null = jwtHmacKey(JWT_ALG_HS256, raw);
  wipe(raw);
  if (keyOrNull === null) {
    t.fail("jwtHmacKey takes a 32-byte key", "null");
    return t.done();
  }
  const key: JwtKey = keyOrNull;
  const v = new JwtVerifier(JWT_MAX_TOKEN);
  const claims: string = "{\"exp\":4102444800}";
  const good: string = token(HEADER, claims);
  t.eqStr("a well-formed token verifies", codeOf(v, key, good), want(JWT_OK));

  // The header's base64url.
  const h64: string = base64urlEncode(bytesOf(HEADER));
  const p64: string = base64urlEncode(bytesOf(claims));
  t.eqStr("header: one character past a group is refused", codeOf(v, key, signed(h64 + "A", p64)), want(JWT_ERR_FORMAT));
  t.eqStr("header: a character outside base64url is refused", codeOf(v, key, signed("+" + h64.substring(1), p64)), want(JWT_ERR_FORMAT));
  t.eqStr("header: an empty part is refused", codeOf(v, key, signed("", p64)), want(JWT_ERR_FORMAT));
  const shortHeader: string = base64urlEncode(bytesOf("{\"alg\":\"HS256\" }"));
  t.eqStr("header: stray bits after the last byte are refused", codeOf(v, key, signed(strayBit(shortHeader), p64)), want(JWT_ERR_FORMAT));

  // The signature's text and buffer.
  const sig: string = good.substring(lastDot(good) + 1);
  const input: string = good.substring(0, lastDot(good));
  t.eqStr("signature: stray bits after the last byte are refused", codeOf(v, key, input + "." + strayBit(sig)), want(JWT_ERR_FORMAT));
  t.eqStr("signature: a character outside base64url is refused", codeOf(v, key, input + "." + sig.substring(1) + "="), want(JWT_ERR_FORMAT));
  t.eqStr("signature: one character past a group is refused", codeOf(v, key, input + "." + sig + "AA"), want(JWT_ERR_FORMAT));
  t.eqStr("signature: one byte too many is refused", codeOf(v, key, input + "." + sig + "A"), want(JWT_ERR_SIGNATURE));
  t.eqStr("signature: an empty one is refused", codeOf(v, key, input + "."), want(JWT_ERR_SIGNATURE));
  t.eqStr("signature: text that decodes past the 1024-byte buffer is refused", codeOf(v, key, input + "." + repeat("A", 1368)), want(JWT_ERR_FORMAT));
  t.eqStr("signature: text longer than any signature is refused", codeOf(v, key, input + "." + repeat("A", 1369)), want(JWT_ERR_SIGNATURE));

  // The payload's base64url, under a signature that verifies.
  t.eqStr("payload: one character past a group is refused", codeOf(v, key, signed(h64, p64 + "A")), want(JWT_ERR_FORMAT));
  t.eqStr("payload: a character outside base64url is refused", codeOf(v, key, signed(h64, p64.substring(1) + "/")), want(JWT_ERR_FORMAT));
  const shortClaims: string = base64urlEncode(bytesOf("{\"exp\":4102444800 }"));
  t.eqStr("payload: stray bits after the last byte are refused", codeOf(v, key, signed(h64, strayBit(shortClaims))), want(JWT_ERR_FORMAT));
  t.ok("a refused payload leaves no claims", v.claimsLen === 0);

  // The header's JSON.
  t.eqStr("header JSON: an unclosed object is refused", codeOf(v, key, token("{\"alg\":\"HS256\"", claims)), want(JWT_ERR_HEADER));
  t.eqStr("header JSON: a trailing comma is refused", codeOf(v, key, token("{\"alg\":\"HS256\",}", claims)), want(JWT_ERR_HEADER));
  t.eqStr("header JSON: text after the object is refused", codeOf(v, key, token("{\"alg\":\"HS256\"} x", claims)), want(JWT_ERR_HEADER));
  t.eqStr("header JSON: an array is refused", codeOf(v, key, token("[\"HS256\"]", claims)), want(JWT_ERR_HEADER));
  t.eqStr("header JSON: an unterminated string is refused", codeOf(v, key, token("{\"alg\":\"HS256\",\"kid\":\"a}", claims)), want(JWT_ERR_HEADER));

  // The claims' JSON.
  t.eqStr("claims JSON: an unclosed object is refused", codeOf(v, key, token(HEADER, "{\"exp\":4102444800")), want(JWT_ERR_CLAIMS));
  t.eqStr("claims JSON: a trailing comma is refused", codeOf(v, key, token(HEADER, "{\"exp\":4102444800,}")), want(JWT_ERR_CLAIMS));
  t.eqStr("claims JSON: text after the object is refused", codeOf(v, key, token(HEADER, "{\"exp\":4102444800} x")), want(JWT_ERR_CLAIMS));
  t.eqStr("claims JSON: an empty payload is refused", codeOf(v, key, token(HEADER, "")), want(JWT_ERR_CLAIMS));
  t.eqStr("claims JSON: a leading zero is refused", codeOf(v, key, token(HEADER, "{\"exp\":04102444800}")), want(JWT_ERR_CLAIMS));
  t.eqStr("claims JSON: a bare minus is refused", codeOf(v, key, token(HEADER, "{\"n\":-,\"exp\":4102444800}")), want(JWT_ERR_CLAIMS));
  t.eqStr("claims JSON: a misspelt literal is refused", codeOf(v, key, token(HEADER, "{\"n\":tru,\"exp\":4102444800}")), want(JWT_ERR_CLAIMS));
  t.eqStr("claims JSON: an unknown escape is refused", codeOf(v, key, token(HEADER, "{\"sub\":\"a\\q\",\"exp\":4102444800}")), want(JWT_ERR_CLAIMS));
  t.eqStr("claims JSON: a \\u escape with a non-hex digit is refused", codeOf(v, key, token(HEADER, "{\"sub\":\"\\u12G4\",\"exp\":4102444800}")), want(JWT_ERR_CLAIMS));
  t.eqStr("claims JSON: a raw control character in a string is refused", codeOf(v, key, token(HEADER, "{\"sub\":\"a\tb\",\"exp\":4102444800}")), want(JWT_ERR_CLAIMS));
  t.eqStr("claims JSON: a missing colon is refused", codeOf(v, key, token(HEADER, "{\"exp\" 4102444800}")), want(JWT_ERR_CLAIMS));
  t.eqStr("claims JSON: a mismatched close is refused", codeOf(v, key, token(HEADER, "{\"a\":[1},\"exp\":4102444800}")), want(JWT_ERR_CLAIMS));
  t.eqStr(
    "claims JSON: 32 nested arrays are taken",
    codeOf(v, key, token(HEADER, "{\"a\":" + repeat("[", 31) + repeat("]", 31) + ",\"exp\":4102444800}")),
    want(JWT_OK),
  );
  t.eqStr(
    "claims JSON: 33 nested arrays are refused",
    codeOf(v, key, token(HEADER, "{\"a\":" + repeat("[", 32) + repeat("]", 32) + ",\"exp\":4102444800}")),
    want(JWT_ERR_CLAIMS),
  );
  t.eqStr("the well-formed token still verifies after every refusal", codeOf(v, key, good), want(JWT_OK));

  // The public-key path copies the signed bytes and the signature with
  // `jwtSlice`; a token at an offset inside a larger array is copied from its
  // own window.
  const ecRaw: u8[] = new Array<u8>(32);
  ecRaw[31] = toU8(7);
  const ecSecret: Secret<u8[]> = secret(ecRaw);
  const ec: JwtKey | null = jwtEs256SigningKey(ecSecret);
  wipe(ecSecret);
  const edSeed: Secret<u8[]> = secret(keyBytes());
  const ed: JwtKey | null = jwtEd25519SigningKey(edSeed);
  wipe(edSeed);
  const keys: JwtKey[] = [];
  if (ec !== null) {
    keys.push(ec);
  }
  if (ed !== null) {
    keys.push(ed);
  }
  t.ok("the ES256 and EdDSA signing keys load", toI32(keys.length) === 2);
  for (let k: i32 = 0; k < toI32(keys.length); k++) {
    const signer: JwtKey = keys[k];
    const tok: string | null = jwtSignString(signer, claims);
    if (tok === null) {
      t.fail("a public-key token signs", "null");
      continue;
    }
    const inner: u8[] = bytesOf(tok);
    const framed: u8[] = bytesOf("xx");
    for (let i: i32 = 0; i < toI32(inner.length); i++) {
      framed.push(inner[i]);
    }
    framed.push(toU8(46));
    framed.push(toU8(46));
    t.eqStr("public key: a token two bytes into a larger array verifies", `${v.verify(signer, framed, 2, toI32(inner.length), NOW)}`, want(JWT_OK));
    t.eqStr(
      "public key: the window one byte longer takes a third dot and is refused",
      `${v.verify(signer, framed, 2, toI32(inner.length) + 1, NOW)}`,
      want(JWT_ERR_FORMAT),
    );
    const last: i32 = lastDot(tok);
    t.eqStr(
      "public key: a signature three bytes too long is refused",
      `${v.verifyString(signer, tok + "AAAA", NOW)}`,
      want(JWT_ERR_SIGNATURE),
    );
    t.eqStr("public key: an empty signature is refused", `${v.verifyString(signer, tok.substring(0, last + 1), NOW)}`, want(JWT_ERR_SIGNATURE));
    signer.wipe();
  }
  key.wipe();
  return t.done();
};
