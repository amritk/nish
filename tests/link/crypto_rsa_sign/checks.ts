// RSASSA-PSS-SHA256 signing (`nish/crypto/rsa-sign`) against known answers:
// Wycheproof's RSAES-PKCS1-v1_5 decryption keys and cases, whose ciphertexts
// the private operation must open to the PKCS #1 v1.5 block of each case's
// message, and PSS signatures that generate.mjs computed independently and
// OpenSSL verified (vectors.ts says how). Every signature is also checked by
// `nish/crypto/rsa`'s verifier, and the salted entry points by salt length.
// `main.ts` here runs them in the default number mode, `crypto_rsa_sign_f64`
// under `--number-mode f64`.
import { Secret, wipe } from "nish:secret";
import {
  RSA_PSS_SHA256_SALT_SIZE,
  RsaSignScratch,
  rsaParsePrivateKey,
  rsaPrivateKeyBits,
  rsaPrivateKeyModulus,
  rsaSignPssSha256,
  rsaSignPssSha256Into,
  rsaSignPssSha256Salted,
  rsaSignRaw,
} from "nish/crypto/rsa-sign";
import { RSA_HASH_SHA256, RsaPublicKey, rsaParsePublicKey, rsaVerifyPss } from "nish/crypto/rsa";
import { fromHex, toHex } from "../crypto_wycheproof_rsa/hex";
import { PssCase, RawCase, SignKey, pssCases, rawCases, signKeys } from "./vectors";

/** What the checks have counted, over every key. */
class Tally {
  passed: i32 = 0;
  failed: i32 = 0;
  loaded: i32 = 0;
  raws: i32 = 0;
  opened: i32 = 0;
  psss: i32 = 0;
  matched: i32 = 0;
  verified: i32 = 0;
  into: i32 = 0;
  saltedKeys: i32 = 0;

  /** Prints `name` under PASS or FAIL as `ok` says, and counts it. */
  check(name: string, ok: boolean): void {
    if (ok) {
      this.passed = this.passed + 1;
      console.log(`PASS  ${name}`);
    } else {
      this.failed = this.failed + 1;
      console.log(`FAIL  ${name}`);
    }
  }
}

/** `bytes[from ..]`, copied. */
const tail = (bytes: u8[], from: i32): u8[] => {
  const out: u8[] = [];
  for (let i: i32 = from; i < toI32(bytes.length); i++) {
    out.push(bytes[i]);
  }
  return out;
};

/** Whether `m` is `00 02 PS 00 msg` with at least eight nonzero bytes of PS. */
const isPkcs1Block = (m: u8[] | null, msg: u8[]): boolean => {
  if (m === null || toI32(m.length) < 11 + toI32(msg.length)) {
    return false;
  }
  if (toI32(m[0]) !== 0 || toI32(m[1]) !== 2) {
    return false;
  }
  const at: i32 = toI32(m.length) - toI32(msg.length);
  for (let i: i32 = 2; i < at - 1; i++) {
    if (toI32(m[i]) === 0) {
      return false;
    }
  }
  return toI32(m[at - 1]) === 0 && toHex(tail(m, at)) === toHex(msg);
};

/** The PSS known answers under `priv`, checked against `pub` as well. */
const pssUnder = (t: Tally, sc: RsaSignScratch, index: i32, priv: Secret<u8[]>, pub: RsaPublicKey): void => {
  const cases: PssCase[] = pssCases();
  for (const c of cases) {
    if (toI32(c.key) !== index) {
      continue;
    }
    t.psss = t.psss + 1;
    const msg: u8[] = fromHex(c.msg);
    const sig: u8[] | null = rsaSignPssSha256(priv, msg);
    if (toHex(sig) === c.sig) {
      t.matched = t.matched + 1;
    } else {
      console.log(`  pss: key ${index}, a message of ${toI32(msg.length)} bytes, gives ${toHex(sig).substring(0, 16)}...`);
    }
    if (sig !== null && rsaVerifyPss(pub, RSA_HASH_SHA256, RSA_PSS_SHA256_SALT_SIZE, msg, sig)) {
      t.verified = t.verified + 1;
    }
    // Into, at an offset on both sides: the message inside a larger array and the signature after five zeros.
    const framed: u8[] = [toU8(9), toU8(9), toU8(9)];
    for (const b of msg) {
      framed.push(b);
    }
    framed.push(toU8(9));
    const out: u8[] = new Array<u8>(toI32(c.sig.length) / 2 + 5);
    const wrote: boolean = rsaSignPssSha256Into(sc, priv, framed, 3, toI32(msg.length), out, 5);
    if (wrote && toHex(tail(out, 5)) === c.sig && toHex(out).substring(0, 10) === "0000000000") {
      t.into = t.into + 1;
    }
  }
};

/** The salted entry point under `priv`: an empty and a 32-byte salt, each verifying at its own length only. */
const saltedUnder = (t: Tally, priv: Secret<u8[]>, pub: RsaPublicKey): void => {
  const msg: u8[] = fromHex("616263");
  const empty: u8[] = [];
  const salt: u8[] = [];
  for (let i: i32 = 0; i < 32; i++) {
    salt.push(toU8(i + 1));
  }
  const s0: u8[] | null = rsaSignPssSha256Salted(priv, msg, empty);
  const s32: u8[] | null = rsaSignPssSha256Salted(priv, msg, salt);
  const again: u8[] | null = rsaSignPssSha256Salted(priv, msg, salt);
  if (
    s0 !== null &&
    s32 !== null &&
    rsaVerifyPss(pub, RSA_HASH_SHA256, 0, msg, s0) &&
    !rsaVerifyPss(pub, RSA_HASH_SHA256, 32, msg, s0) &&
    rsaVerifyPss(pub, RSA_HASH_SHA256, 32, msg, s32) &&
    !rsaVerifyPss(pub, RSA_HASH_SHA256, 0, msg, s32) &&
    toHex(again) === toHex(s32) &&
    toHex(s32) !== toHex(rsaSignPssSha256(priv, msg))
  ) {
    t.saltedKeys = t.saltedKeys + 1;
  }
};

/** Every check under key `index`, which is loaded here and wiped before it returns. */
const underKey = (t: Tally, sc: RsaSignScratch, index: i32, k: SignKey): void => {
  const der: u8[] = fromHex(k.pkcs8);
  const priv: Secret<u8[]> | null = rsaParsePrivateKey(der, toI32(k.start), toI32(k.end));
  const pub: RsaPublicKey | null = rsaParsePublicKey(fromHex(k.pub));
  if (priv === null) {
    console.log(`  key ${index} does not load`);
    return;
  }
  if (pub === null) {
    console.log(`  key ${index}'s public key does not load`);
    wipe(priv);
    return;
  }
  const modulus: u8[] = rsaPrivateKeyModulus(priv);
  if (rsaPrivateKeyBits(priv) === toI32(k.bits) && toHex(tail(modulus, toI32(modulus.length) - toI32(pub.n.length))) === toHex(pub.n)) {
    t.loaded = t.loaded + 1;
  }
  const raws: RawCase[] = rawCases();
  for (const c of raws) {
    if (toI32(c.key) !== index) {
      continue;
    }
    t.raws = t.raws + 1;
    if (isPkcs1Block(rsaSignRaw(priv, fromHex(c.ct)), fromHex(c.msg))) {
      t.opened = t.opened + 1;
    } else {
      console.log(`  raw: key ${index}, tcId ${toI32(c.tcId)}, does not open to its message`);
    }
  }
  pssUnder(t, sc, index, priv, pub);
  saltedUnder(t, priv, pub);
  wipe(priv);
};

/** A signature under the first 2048-bit key, checked under both 2048-bit public keys. */
const crossKey = (keys: SignKey[]): boolean => {
  const der: u8[] = fromHex(keys[0].pkcs8);
  const priv: Secret<u8[]> | null = rsaParsePrivateKey(der, toI32(keys[0].start), toI32(keys[0].end));
  const own: RsaPublicKey | null = rsaParsePublicKey(fromHex(keys[0].pub));
  const other: RsaPublicKey | null = rsaParsePublicKey(fromHex(keys[1].pub));
  if (priv === null) {
    return false;
  }
  if (own === null || other === null) {
    wipe(priv);
    return false;
  }
  const msg: u8[] = fromHex("616263");
  const s: u8[] | null = rsaSignPssSha256(priv, msg);
  wipe(priv);
  return s !== null && rsaVerifyPss(own, RSA_HASH_SHA256, 32, msg, s) && !rsaVerifyPss(other, RSA_HASH_SHA256, 32, msg, s);
};

/** `bytes[from .. to)`, copied. */
const slice = (bytes: u8[], from: i32, to: i32): u8[] => {
  const out: u8[] = [];
  for (let i: i32 = from; i < to; i++) {
    out.push(bytes[i]);
  }
  return out;
};

/** Whether `der[0 .. end)` is refused by `rsaParsePrivateKey`; a key that loads is wiped. */
const refused = (der: u8[], end: i32): boolean => {
  const priv: Secret<u8[]> | null = rsaParsePrivateKey(der, 0, end);
  if (priv === null) {
    return true;
  }
  wipe(priv);
  return false;
};

/**
 * The first 2048-bit key's RSAPrivateKey, changed one way at a time, each
 * refused: `30 82 LL LL 02 01 00 02 82 01 01 00 n(256) 02 03 e(3) 02 82 LL LL d ...`.
 * Answers how many of the nine are refused, or -1 when the key is not laid
 * out that way or does not load unchanged.
 */
const refusals = (k: SignKey): i32 => {
  const key: u8[] = slice(fromHex(k.pkcs8), toI32(k.start), toI32(k.end));
  const n: i32 = toI32(key.length);
  if (n < toI32(300) || key[7] !== 0x02 || key[8] !== 0x82 || key[11] !== 0x00 || key[268] !== 0x02 || key[269] !== 0x03 || key[273] !== 0x02 || key[274] !== 0x82) {
    return -1;
  }
  const dEnd: i32 = toI32(277) + ((toI32(key[275]) << toI32(8)) | toI32(key[276]));
  if (dEnd > n || refused(key, n)) {
    return -1;
  }
  let count: i32 = 0;
  // An empty key, and one a byte short.
  count = count + toI32(refused(key, 0) ? 1 : 0);
  count = count + toI32(refused(key, n - toI32(1)) ? 1 : 0);
  // A byte after the key.
  const longer: u8[] = slice(key, 0, n);
  longer.push(0x00);
  count = count + toI32(refused(longer, n + toI32(1)) ? 1 : 0);
  // Version 1 (multi-prime) for version 0.
  const v1: u8[] = slice(key, 0, n);
  v1[6] = 0x01;
  count = count + toI32(refused(v1, n) ? 1 : 0);
  // The modulus made even.
  const even: u8[] = slice(key, 0, n);
  even[267] = toU8(toI32(even[267]) & toI32(0xfe));
  count = count + toI32(refused(even, n) ? 1 : 0);
  // The modulus's leading zero made 0xff, a negative INTEGER.
  const negative: u8[] = slice(key, 0, n);
  negative[11] = 0xff;
  count = count + toI32(refused(negative, n) ? 1 : 0);
  // The public exponent made even (65536).
  const evenE: u8[] = slice(key, 0, n);
  evenE[272] = 0x00;
  count = count + toI32(refused(evenE, n) ? 1 : 0);
  // The private exponent's last bit flipped: the trial signature fails.
  const wrongD: u8[] = slice(key, 0, n);
  const last: i32 = dEnd - toI32(1);
  wrongD[last] = toU8(toI32(wrongD[last]) ^ toI32(1));
  count = count + toI32(refused(wrongD, n) ? 1 : 0);
  // The outer length one more than the key holds.
  const outer: u8[] = slice(key, 0, n);
  outer[3] = toU8(toI32(outer[3]) + toI32(1));
  count = count + toI32(refused(outer, n) ? 1 : 0);
  return count;
};

/** Runs every check and prints the summary; 0 when all pass. */
export const rsaSignChecks = (): i32 => {
  const t = new Tally();
  const sc = new RsaSignScratch();
  const keys: SignKey[] = signKeys();
  for (let i: i32 = 0; i < toI32(keys.length); i++) {
    underKey(t, sc, i, keys[i]);
  }
  const n: i32 = toI32(keys.length);
  t.check(`each of the ${n} Wycheproof keys loads from the RSAPrivateKey inside its PKCS #8, with its bit length and its public key's modulus`, t.loaded === n);
  t.check(`the private operation opens each of the ${t.raws} Wycheproof ciphertexts to its message's PKCS #1 v1.5 block`, t.raws === toI32(rawCases().length) && t.opened === t.raws);
  t.check(`rsaSignPssSha256 gives each of the ${t.psss} known answers byte for byte`, t.psss === toI32(pssCases().length) && t.matched === t.psss);
  t.check("each of those signatures verifies under rsaVerifyPss with SHA-256 and a 32-byte salt", t.psss > 0 && t.verified === t.psss);
  t.check("rsaSignPssSha256Into writes the same signature at an offset, from a message at an offset, and nothing before it", t.psss > 0 && t.into === t.psss);
  t.check(`under each of the ${n} keys, rsaSignPssSha256Salted signs under an empty and a 32-byte salt, each verifying at its own length only, the same twice, and unlike the derived salt`, t.saltedKeys === n);
  t.check("a signature under one 2048-bit key fails under the other", crossKey(keys));
  t.check("rsaParsePrivateKey refuses each of 9 changes to a key: empty, a byte short, a byte after, version 1, an even modulus, a negative modulus, an even public exponent, a private exponent one bit off, an outer length one long", refusals(keys[0]) === 9);
  console.log(`rsa sign: ${t.passed} passed, ${t.failed} failed, 0 skipped`);
  return t.failed === 0 ? 0 : 1;
};
