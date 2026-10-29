// `nish/crypto/rsa` against NIST CAVP, Project Wycheproof and signatures made
// to break one check each: every PKCS#1 v1.5 and PSS case of CAVP's FIPS 186-3
// files with a 2048- or 3072-bit modulus and SHA-256, SHA-384 or SHA-512
// (cavp.ts), Wycheproof's rsa_signature_* and rsa_pss_* files (wycheproof_*.ts),
// the crafted encodings of crafted.ts, and the refusals the module promises —
// SubjectPublicKeyInfo DER that is not strict, an algorithm it does not take,
// a modulus outside 2048 to 8192 bits or even, an exponent even, below 3 or
// above 2^32, a signature of the wrong length or not below the modulus, and an
// unknown hash id. docs/security/crypto-rsa.md is the audit these checks pin.
//
// The suite is a function rather than `main` so that `crypto_rsa_f64` can run
// the same checks with `--number-mode f64`.
import { Suite } from "nish/testing";
import {
  RSA_MAX_BITS,
  RSA_MIN_BITS,
  RSA_SHA256,
  RSA_SHA384,
  RSA_SHA512,
  RsaPublicKey,
  rsaParsePublicKey,
  rsaVerifyPkcs1,
  rsaVerifyPss,
} from "nish/crypto/rsa";
import { fromHex } from "./hex";
import { CRAFTED_MESSAGE, CRAFTED_MODULUS, craftedRsaCases, craftedRsaKeys } from "./crafted";
import { cavpRsaKeys, cavpRsaPkcs1Cases, cavpRsaPssCases } from "./cavp";
import {
  RsaVectorCase,
  wycheproofRsaPkcs1Keys,
  wycheproofRsaPkcs1_2048Sha256,
  wycheproofRsaPkcs1_2048Sha512,
  wycheproofRsaPkcs1_3072Sha384,
  wycheproofRsaPkcs1_4096Sha512,
  wycheproofRsaPkcs1_8192Sha512,
} from "./wycheproof_pkcs1";
import {
  wycheproofRsaPssKeys,
  wycheproofRsaPss_2048Sha256,
  wycheproofRsaPss_2048Sha256Salt0,
  wycheproofRsaPss_2048Sha384,
  wycheproofRsaPss_3072Sha256,
  wycheproofRsaPss_4096Sha512,
  wycheproofRsaPssMisc,
} from "./wycheproof_pss";

/** The bytes of an ASCII string. */
const ascii = (text: string): u8[] => {
  const out: u8[] = [];
  const length: i32 = toI32(text.length);
  for (let i: i32 = 0; i < length; i++) {
    out.push(toU8(toI32(text.charCodeAt(i))));
  }
  return out;
};

/** `a` then `b`, in a new array. */
const cat = (a: u8[], b: u8[]): u8[] => {
  const out: u8[] = [];
  for (const x of a) {
    out.push(x);
  }
  for (const x of b) {
    out.push(x);
  }
  return out;
};

/** A DER element: `tag`, the minimal definite length of `body`, then `body`. */
const tlv = (tag: i32, body: u8[]): u8[] => {
  const length: i32 = toI32(body.length);
  const out: u8[] = [toU8(tag)];
  if (length >= 0x100) {
    out.push(0x82);
    out.push(toU8(length >> 8));
    out.push(toU8(length & 0xff));
  } else if (length >= 0x80) {
    out.push(0x81);
    out.push(toU8(length));
  } else {
    out.push(toU8(length));
  }
  return cat(out, body);
};

/** The DER INTEGER of the positive magnitude `mag`, a sign byte added when its top bit is set. */
const derInt = (mag: u8[]): u8[] => tlv(0x02, toI32(mag[0]) >= 0x80 ? cat([0], mag) : mag);

/** A SubjectPublicKeyInfo of the AlgorithmIdentifier `alg` (hex, whole) around the RSAPublicKey of `n` and `e`. */
const spkiOf = (alg: string, n: u8[], e: u8[]): u8[] =>
  tlv(0x30, cat(fromHex(alg), tlv(0x03, cat([0], tlv(0x30, cat(derInt(n), derInt(e)))))));

/** `count` copies of `byte`. */
const repeat = (byte: i32, count: i32): u8[] => {
  const out: u8[] = [];
  for (let i: i32 = 0; i < count; i++) {
    out.push(toU8(byte));
  }
  return out;
};

/** `length` bytes of `bytes` from `at`, in a new array. */
const sub = (bytes: u8[], at: i32, length: i32): u8[] => {
  const out: u8[] = [];
  for (let i: i32 = 0; i < length; i++) {
    out.push(bytes[at + i]);
  }
  return out;
};

/** Whether `a` and `b` hold the same bytes. */
const sameBytes = (a: u8[], b: u8[]): boolean => {
  const length: i32 = toI32(a.length);
  if (length !== toI32(b.length)) {
    return false;
  }
  for (let i: i32 = 0; i < length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
};

/** `bytes` with byte `at` replaced by `value`, in a copy. */
const patch = (bytes: u8[], at: i32, value: i32): u8[] => {
  const out: u8[] = cat([], bytes);
  out[at] = toU8(value);
  return out;
};

// rsaEncryption with NULL parameters, and the OIDs and parameters to vary.
const ALG_RSA: string = "300d06092a864886f70d0101010500";
const OID_RSA: string = "06092a864886f70d010101";
const OID_PSS: string = "06092a864886f70d01010a";
// RFC 4055 RSASSA-PSS-params for SHA-256, MGF1 with SHA-256 and a 32-byte salt.
const PSS_PARAMS: string =
  "3034a00f300d06096086480165030402010500a11c301a06092a864886f70d010108300d06096086480165030402010500a203020120";

/** A SubjectPublicKeyInfo of rsaEncryption around the BIT STRING element `bitString`. */
const withKey = (bitString: u8[]): u8[] => tlv(0x30, cat(fromHex(ALG_RSA), bitString));

/** A SubjectPublicKeyInfo of rsaEncryption around the RSAPublicKey SEQUENCE body `fields`. */
const keyOf = (fields: u8[]): u8[] => withKey(tlv(0x03, cat([0], tlv(0x30, fields))));

/** Whether `rsaParsePublicKey` refuses `spki`. */
const refused = (spki: u8[]): boolean => rsaParsePublicKey(spki) === null;

/**
 * The cases of one vector list through `rsaParsePublicKey` and `rsaVerifyPkcs1`
 * or (when `pss` is set) `rsaVerifyPss`, checked against what each case
 * expects of this module. A PKCS#1 v1.5 case expects its file's result. A PSS
 * case expects to verify only when its file says valid and it was signed with
 * MGF1 over the message's hash and a salt as long as the digest, the one PSS
 * this module takes; a valid case signed otherwise must be refused, and a
 * case its file calls invalid only because it moved to that salt (the salt-0
 * file's "s_len changed to 32") may verify and is counted. A case
 * whose key `rsaParsePublicKey` refuses must be one that is not valid.
 * `acceptable` may go either way and is only counted. A mismatch is named by
 * its list and `tcId`. Answers the number of mismatches.
 */
const vectors = (t: Suite, name: string, keys: string[], cases: RsaVectorCase[], pss: boolean): i32 => {
  const keyCount: i32 = toI32(keys.length);
  let valid: i32 = 0;
  let invalid: i32 = 0;
  let byParameters: i32 = 0;
  let byKey: i32 = 0;
  let toOurs: i32 = 0;
  let acceptableTrue: i32 = 0;
  let acceptableFalse: i32 = 0;
  let mismatches: i32 = 0;
  for (const c of cases) {
    const keyAt: i32 = toI32(c.key);
    if (keyAt < 0 || keyAt >= keyCount) {
      t.fail(`${name} tcId ${c.tcId}`, "no such key");
      mismatches += 1;
      continue;
    }
    const hash: i32 = toI32(c.hash);
    const fits: boolean = !pss || (toI32(c.mgf) === hash && toI32(c.salt) === hash * 16 + 32);
    const key: RsaPublicKey | null = rsaParsePublicKey(fromHex(keys[keyAt]));
    let verified: boolean = false;
    if (key !== null) {
      const msg: u8[] = fromHex(c.msg);
      const sig: u8[] = fromHex(c.sig);
      verified = pss ? rsaVerifyPss(key, hash, msg, sig) : rsaVerifyPkcs1(key, hash, msg, sig);
    }
    if (c.result === "valid" && fits) {
      if (verified) {
        valid += 1;
      } else {
        t.fail(`${name} tcId ${c.tcId}`, key === null ? "the key was refused" : "a valid signature did not verify");
        mismatches += 1;
      }
    } else if (verified && !fits && toI32(c.mgf) === hash && c.result === "invalid") {
      toOurs += 1;
    } else if (verified) {
      t.fail(`${name} tcId ${c.tcId}`, fits ? "an invalid signature verified" : "a signature with other PSS parameters verified");
      mismatches += 1;
    } else if (key === null) {
      byKey += 1;
    } else if (c.result === "valid") {
      byParameters += 1;
    } else if (c.result === "invalid") {
      invalid += 1;
    } else if (verified) {
      acceptableTrue += 1;
    } else {
      acceptableFalse += 1;
    }
  }
  const parameters: string = pss ? `, ${byParameters} valid under other PSS parameters refused, ${toOurs} invalid under the file's salt verified under this module's` : "";
  console.log(
    `${name}: ${toI32(cases.length)} cases, ${valid} valid verified, ${invalid} invalid refused${parameters}, ${byKey} on a refused key, ${acceptableTrue + acceptableFalse} acceptable (${acceptableTrue} verified, ${acceptableFalse} refused)`
  );
  return mismatches;
};

export const runSuite = (): i32 => {
  const t = new Suite("rsa");

  t.eqI32("RSA_SHA256 is 0", RSA_SHA256, toI32(0));
  t.eqI32("RSA_SHA384 is 1", RSA_SHA384, toI32(1));
  t.eqI32("RSA_SHA512 is 2", RSA_SHA512, toI32(2));
  t.eqI32("RSA_MIN_BITS is 2048", RSA_MIN_BITS, toI32(2048));
  t.eqI32("RSA_MAX_BITS is 8192", RSA_MAX_BITS, toI32(8192));

  // --- The SubjectPublicKeyInfo: the encoding ------------------------------
  const n: u8[] = fromHex(CRAFTED_MODULUS);
  const e: u8[] = fromHex("010001");
  const good: u8[] = spkiOf(ALG_RSA, n, e);
  const craftedKeys: string[] = craftedRsaKeys();
  t.ok("spkiOf rebuilds crafted key 0 byte for byte", sameBytes(fromHex(craftedKeys[0]), good));
  const key: RsaPublicKey | null = rsaParsePublicKey(good);
  if (key === null) {
    t.fail("the 2048-bit key", "was refused, so the rest cannot run");
    return t.done();
  }
  t.eqI32("a 2048-bit key has 2048 bits", key.bits, toI32(2048));
  t.eqI32("and signatures of 256 bytes", key.size, toI32(256));
  t.ok("and is not PSS-only", !key.pssOnly);
  t.ok("an empty input is refused", refused([]));
  t.ok("a lone tag is refused", refused([0x30]));
  t.ok("a byte after the SubjectPublicKeyInfo is refused", refused(cat(good, [0])));
  t.ok("a SubjectPublicKeyInfo one byte short is refused", refused(sub(good, toI32(0), toI32(good.length) - 1)));
  t.ok("a SET for the outer SEQUENCE is refused", refused(patch(good, 0, 0x31)));
  t.ok("a two-byte length cut short is refused", refused(fromHex("308201")));
  t.ok("a one-byte long-form length cut short is refused", refused(fromHex("3081")));
  t.ok("a long-form length below 0x80 is refused", refused(spkiOf("30810d06092a864886f70d0101010500", n, e)));
  t.ok("a two-byte length below 0x100 is refused", refused(spkiOf("3082000d06092a864886f70d0101010500", n, e)));
  t.ok("an indefinite length is refused", refused(spkiOf("308006092a864886f70d01010105000000", n, e)));
  t.ok("a three-byte length is refused", refused(spkiOf("308300000d06092a864886f70d0101010500", n, e)));
  t.ok("an AlgorithmIdentifier that runs past the key is refused", refused(fromHex("3006300f06092a")));

  // --- The SubjectPublicKeyInfo: the algorithm -----------------------------
  t.ok("an eight-byte OID is refused", refused(spkiOf("300c06082a864886f70d01010500", n, e)));
  t.ok("sha256WithRSAEncryption is refused", refused(spkiOf("300d06092a864886f70d01010b0500", n, e)));
  t.ok("an OID off the PKCS #1 arc is refused", refused(spkiOf("300d06092a864886f70d0102010500", n, e)));
  t.ok("rsaEncryption without its NULL is refused", refused(spkiOf(`300b${OID_RSA}`, n, e)));
  t.ok("rsaEncryption with a NULL holding a byte is refused", refused(spkiOf(`300e${OID_RSA}050100`, n, e)));
  t.ok("rsaEncryption with a SEQUENCE for parameters is refused", refused(spkiOf(`300d${OID_RSA}3000`, n, e)));
  t.ok("rsaEncryption with a second NULL is refused", refused(spkiOf(`300f${OID_RSA}05000500`, n, e)));
  const pssBare: RsaPublicKey | null = rsaParsePublicKey(spkiOf(`300b${OID_PSS}`, n, e));
  const pssParams: RsaPublicKey | null = rsaParsePublicKey(spkiOf(`3041${OID_PSS}${PSS_PARAMS}`, n, e));
  t.ok("id-RSASSA-PSS without parameters is a key", pssBare !== null && pssBare.pssOnly);
  t.ok("id-RSASSA-PSS with RSASSA-PSS-params is a key", pssParams !== null && pssParams.pssOnly);
  t.ok("id-RSASSA-PSS with NULL parameters is refused", refused(spkiOf(`300d${OID_PSS}0500`, n, e)));
  t.ok("id-RSASSA-PSS with a byte after its parameters is refused", refused(spkiOf(`3011${OID_PSS}30000500`, n, e)));

  // --- The SubjectPublicKeyInfo: the key -----------------------------------
  const rsaPublicKey: u8[] = tlv(0x30, cat(derInt(n), derInt(e)));
  t.ok("withKey rebuilds the key", !refused(withKey(tlv(0x03, cat([0], rsaPublicKey)))));
  t.ok("an OCTET STRING for the BIT STRING is refused", refused(withKey(tlv(0x04, cat([0], rsaPublicKey)))));
  t.ok("a BIT STRING with an unused bit is refused", refused(withKey(tlv(0x03, cat([1], rsaPublicKey)))));
  t.ok("an empty BIT STRING is refused", refused(withKey(tlv(0x03, []))));
  t.ok("a SET for RSAPublicKey is refused", refused(withKey(tlv(0x03, cat([0], tlv(0x31, cat(derInt(n), derInt(e))))))));
  t.ok("keyOf rebuilds the key", !refused(keyOf(cat(derInt(n), derInt(e)))));
  t.ok("an RSAPublicKey without e is refused", refused(keyOf(derInt(n))));
  t.ok("an RSAPublicKey with a third INTEGER is refused", refused(keyOf(cat(cat(derInt(n), derInt(e)), derInt(e)))));
  t.ok("a negative modulus is refused", refused(keyOf(cat(tlv(0x02, n), derInt(e)))));
  t.ok("a modulus with a needless zero byte is refused", refused(keyOf(cat(derInt(n), tlv(0x02, fromHex("00010001"))))));
  t.ok("a zero exponent is refused", refused(keyOf(cat(derInt(n), tlv(0x02, [0])))));
  t.ok("an empty INTEGER is refused", refused(keyOf(cat(derInt(n), tlv(0x02, [])))));
  t.ok("an OCTET STRING for the modulus is refused", refused(keyOf(cat(tlv(0x04, n), derInt(e)))));

  // --- The SubjectPublicKeyInfo: the limits --------------------------------
  const n2047: u8[] = patch(n, 0, toI32(n[0]) & 0x7f);
  t.ok("a 2047-bit modulus is refused", refused(spkiOf(ALG_RSA, n2047, e)));
  const n8192: u8[] = repeat(0xff, 1024);
  const k8192: RsaPublicKey | null = rsaParsePublicKey(spkiOf(ALG_RSA, n8192, e));
  t.ok("an 8192-bit modulus is a key", k8192 !== null && k8192.bits === 8192 && k8192.size === 1024);
  t.ok("an 8193-bit modulus is refused", refused(spkiOf(ALG_RSA, cat([1], n8192), e)));
  t.ok("an even modulus is refused", refused(spkiOf(ALG_RSA, patch(n, 255, toI32(n[255]) & 0xfe), e)));
  t.ok("e = 1 is refused", refused(spkiOf(ALG_RSA, n, [1])));
  t.ok("e = 2 is refused", refused(spkiOf(ALG_RSA, n, [2])));
  t.ok("e = 3 is a key", !refused(spkiOf(ALG_RSA, n, [3])));
  t.ok("e = 65536 is refused", refused(spkiOf(ALG_RSA, n, fromHex("010000"))));
  t.ok("e = 2^32 - 1 is a key", !refused(spkiOf(ALG_RSA, n, fromHex("ffffffff"))));
  t.ok("e = 2^32 + 1 is refused", refused(spkiOf(ALG_RSA, n, fromHex("0100000001"))));
  t.ok("e = 2^33 + 1 is refused", refused(spkiOf(ALG_RSA, n, fromHex("0200000001"))));
  t.ok("a six-byte e is refused", refused(spkiOf(ALG_RSA, n, fromHex("010000000001"))));

  // --- Crafted signatures: one broken field each ---------------------------
  const message: u8[] = ascii(CRAFTED_MESSAGE);
  const craftedKey0: RsaPublicKey | null = rsaParsePublicKey(fromHex(craftedKeys[0]));
  const craftedKey1: RsaPublicKey | null = rsaParsePublicKey(fromHex(craftedKeys[1]));
  if (craftedKey0 === null || craftedKey1 === null || pssBare === null || pssParams === null) {
    t.fail("crafted keys", "a key was refused, so the rest cannot run");
    return t.done();
  }
  t.eqI32("crafted key 1 has 2049 bits", craftedKey1.bits, toI32(2049));
  t.eqI32("and signatures of 257 bytes", craftedKey1.size, toI32(257));
  let pkcs1Sig: u8[] = [];
  let pssSig: u8[] = [];
  for (const c of craftedRsaCases()) {
    const k: RsaPublicKey = toI32(c.key) === 0 ? craftedKey0 : craftedKey1;
    const sig: u8[] = fromHex(c.sig);
    const pss: boolean = c.scheme === "pss";
    const verified: boolean = pss
      ? rsaVerifyPss(k, toI32(c.hash), message, sig)
      : rsaVerifyPkcs1(k, toI32(c.hash), message, sig);
    t.ok(`${c.name} ${c.verifies ? "verifies" : "is refused"}`, verified === c.verifies);
    if (c.verifies && toI32(c.key) === 0 && toI32(c.hash) === RSA_SHA256) {
      if (pss) {
        pssSig = sig;
      } else {
        pkcs1Sig = sig;
      }
    }
  }

  // --- The signature and the hash id ---------------------------------------
  t.ok("a valid PKCS#1 v1.5 SHA-256 signature does not verify as SHA-384", !rsaVerifyPkcs1(craftedKey0, RSA_SHA384, message, pkcs1Sig));
  t.ok("nor as SHA-512", !rsaVerifyPkcs1(craftedKey0, RSA_SHA512, message, pkcs1Sig));
  t.ok("nor of another message", !rsaVerifyPkcs1(craftedKey0, RSA_SHA256, ascii("crafted messagf"), pkcs1Sig));
  t.ok("nor under the 2049-bit key", !rsaVerifyPkcs1(craftedKey1, RSA_SHA256, message, pkcs1Sig));
  t.ok("a valid PSS SHA-256 signature does not verify as SHA-384", !rsaVerifyPss(craftedKey0, RSA_SHA384, message, pssSig));
  t.ok("nor of another message", !rsaVerifyPss(craftedKey0, RSA_SHA256, ascii("crafted messagf"), pssSig));
  t.ok("nor as PKCS#1 v1.5", !rsaVerifyPkcs1(craftedKey0, RSA_SHA256, message, pssSig));
  t.ok("hash id 3 is refused by rsaVerifyPkcs1", !rsaVerifyPkcs1(craftedKey0, toI32(3), message, pkcs1Sig));
  t.ok("hash id -1 is refused by rsaVerifyPkcs1", !rsaVerifyPkcs1(craftedKey0, toI32(-1), message, pkcs1Sig));
  t.ok("hash id 3 is refused by rsaVerifyPss", !rsaVerifyPss(craftedKey0, toI32(3), message, pssSig));
  t.ok("a 255-byte signature is refused by rsaVerifyPkcs1", !rsaVerifyPkcs1(craftedKey0, RSA_SHA256, message, sub(pkcs1Sig, toI32(1), toI32(255))));
  t.ok("a 257-byte signature, a zero in front, is refused by rsaVerifyPkcs1", !rsaVerifyPkcs1(craftedKey0, RSA_SHA256, message, cat([0], pkcs1Sig)));
  t.ok("a 257-byte signature, a zero in front, is refused by rsaVerifyPss", !rsaVerifyPss(craftedKey0, RSA_SHA256, message, cat([0], pssSig)));
  t.ok("an empty signature is refused", !rsaVerifyPss(craftedKey0, RSA_SHA256, message, []));
  t.ok("s = n is refused by rsaVerifyPkcs1", !rsaVerifyPkcs1(craftedKey0, RSA_SHA256, message, n));
  t.ok("s = n is refused by rsaVerifyPss", !rsaVerifyPss(craftedKey0, RSA_SHA256, message, n));
  t.ok("s = 2^2048 - 1 is refused", !rsaVerifyPkcs1(craftedKey0, RSA_SHA256, message, repeat(0xff, 256)));
  t.ok("s = 0 is refused", !rsaVerifyPkcs1(craftedKey0, RSA_SHA256, message, repeat(0, 256)));
  t.ok("s = 1 is refused", !rsaVerifyPss(craftedKey0, RSA_SHA256, message, patch(repeat(0, 256), 255, 1)));
  t.ok("s = n - 1 is refused", !rsaVerifyPss(craftedKey0, RSA_SHA256, message, patch(n, 255, toI32(n[255]) - 1)));

  // --- A key that came as id-RSASSA-PSS ------------------------------------
  t.ok("a PSS-only key refuses a valid PKCS#1 v1.5 signature", !rsaVerifyPkcs1(pssBare, RSA_SHA256, message, pkcs1Sig));
  t.ok("and verifies a valid PSS signature", rsaVerifyPss(pssBare, RSA_SHA256, message, pssSig));
  t.ok("as does one with RSASSA-PSS-params", rsaVerifyPss(pssParams, RSA_SHA256, message, pssSig));
  t.ok("which also refuses PKCS#1 v1.5", !rsaVerifyPkcs1(pssParams, RSA_SHA256, message, pkcs1Sig));

  // --- NIST CAVP --------------------------------------------------------------
  const cavpKeys: string[] = cavpRsaKeys();
  t.ok("cavp SigVer15: every case answers what the file expects", vectors(t, "cavp SigVer15", cavpKeys, cavpRsaPkcs1Cases(), false) === 0);
  t.ok("cavp SigVerPSS: every case answers what the file expects", vectors(t, "cavp SigVerPSS", cavpKeys, cavpRsaPssCases(), true) === 0);

  // --- Wycheproof -------------------------------------------------------------
  const pkcs1Keys: string[] = wycheproofRsaPkcs1Keys();
  t.ok("wycheproof rsa_signature_2048_sha256: every case answers what the file expects", vectors(t, "wycheproof rsa_signature_2048_sha256", pkcs1Keys, wycheproofRsaPkcs1_2048Sha256(), false) === 0);
  t.ok("wycheproof rsa_signature_2048_sha512: every case answers what the file expects", vectors(t, "wycheproof rsa_signature_2048_sha512", pkcs1Keys, wycheproofRsaPkcs1_2048Sha512(), false) === 0);
  t.ok("wycheproof rsa_signature_3072_sha384: every case answers what the file expects", vectors(t, "wycheproof rsa_signature_3072_sha384", pkcs1Keys, wycheproofRsaPkcs1_3072Sha384(), false) === 0);
  t.ok("wycheproof rsa_signature_4096_sha512: every case answers what the file expects", vectors(t, "wycheproof rsa_signature_4096_sha512", pkcs1Keys, wycheproofRsaPkcs1_4096Sha512(), false) === 0);
  t.ok("wycheproof rsa_signature_8192_sha512: every case answers what the file expects", vectors(t, "wycheproof rsa_signature_8192_sha512", pkcs1Keys, wycheproofRsaPkcs1_8192Sha512(), false) === 0);
  const pssKeys: string[] = wycheproofRsaPssKeys();
  t.ok("wycheproof rsa_pss_2048_sha256_mgf1_32: every case answers what the file expects", vectors(t, "wycheproof rsa_pss_2048_sha256_mgf1_32", pssKeys, wycheproofRsaPss_2048Sha256(), true) === 0);
  t.ok("wycheproof rsa_pss_2048_sha384_mgf1_48: every case answers what the file expects", vectors(t, "wycheproof rsa_pss_2048_sha384_mgf1_48", pssKeys, wycheproofRsaPss_2048Sha384(), true) === 0);
  t.ok("wycheproof rsa_pss_3072_sha256_mgf1_32: every case answers what the file expects", vectors(t, "wycheproof rsa_pss_3072_sha256_mgf1_32", pssKeys, wycheproofRsaPss_3072Sha256(), true) === 0);
  t.ok("wycheproof rsa_pss_4096_sha512_mgf1_64: every case answers what the file expects", vectors(t, "wycheproof rsa_pss_4096_sha512_mgf1_64", pssKeys, wycheproofRsaPss_4096Sha512(), true) === 0);
  t.ok("wycheproof rsa_pss_2048_sha256_mgf1_0: every case answers what the file expects", vectors(t, "wycheproof rsa_pss_2048_sha256_mgf1_0", pssKeys, wycheproofRsaPss_2048Sha256Salt0(), true) === 0);
  t.ok("wycheproof rsa_pss_misc: every case answers what the file expects", vectors(t, "wycheproof rsa_pss_misc", pssKeys, wycheproofRsaPssMisc(), true) === 0);

  return t.done();
};
