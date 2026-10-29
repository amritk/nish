// `nish/crypto/rsa` against Project Wycheproof, NIST CAVP and signatures made
// for this test: every case of Wycheproof's nine PKCS #1 v1.5 files and eight
// RSA-PSS files, the groups of rsa_pss_misc this module can run, the SigVer15
// and SigVerPSS cases of CAVP's FIPS 186-3 vectors with a 2048- or 3072-bit
// modulus and a SHA-2 hash, and the refusals the module promises — moduli of
// 2047 and 4097 bits, an even n, an e of 1, an even e and one of 2^32, a key
// DER that is not strict, a signature one octet short or long or of n or more,
// an encoding with a wrong trailer, padding or separator (crafted.ts), an
// unknown hash and a digest of the wrong length. docs/security/crypto-rsa.md
// is the audit these checks pin.
//
// The suite is a function rather than `main` so that `crypto_rsa_f64` can run
// the same checks with `--number-mode f64`.
import { Suite } from "nish/testing";
import { sha256 } from "nish/crypto/sha256";
import {
  RSA_SHA256,
  RSA_SHA384,
  RSA_SHA512,
  RsaPublicKey,
  rsaPublicKeyFromDer,
  rsaPublicKeyFromParts,
  rsaVerifyPkcs1,
  rsaVerifyPkcs1Digest,
  rsaVerifyPss,
  rsaVerifyPssDigest,
} from "nish/crypto/rsa";
import {
  WycheproofRsaCase,
  WycheproofRsaKey,
  WycheproofRsaPssKey,
  wycheproofRsa2048Sha256Cases,
  wycheproofRsa2048Sha256Keys,
  wycheproofRsa2048Sha384Cases,
  wycheproofRsa2048Sha384Keys,
  wycheproofRsa2048Sha512Cases,
  wycheproofRsa2048Sha512Keys,
  wycheproofRsa3072Sha256Cases,
  wycheproofRsa3072Sha256Keys,
  wycheproofRsa3072Sha384Cases,
  wycheproofRsa3072Sha384Keys,
  wycheproofRsa3072Sha512Cases,
  wycheproofRsa3072Sha512Keys,
  wycheproofRsa4096Sha256Cases,
  wycheproofRsa4096Sha256Keys,
  wycheproofRsa4096Sha384Cases,
  wycheproofRsa4096Sha384Keys,
  wycheproofRsa4096Sha512Cases,
  wycheproofRsa4096Sha512Keys,
} from "../crypto_wycheproof_rsa/rsa_signature";
import {
  wycheproofRsaPss2048Sha256S0Cases,
  wycheproofRsaPss2048Sha256S0Keys,
  wycheproofRsaPss2048Sha256S32Cases,
  wycheproofRsaPss2048Sha256S32Keys,
  wycheproofRsaPss2048Sha384S48Cases,
  wycheproofRsaPss2048Sha384S48Keys,
  wycheproofRsaPss3072Sha256S32Cases,
  wycheproofRsaPss3072Sha256S32Keys,
  wycheproofRsaPss4096Sha256S32Cases,
  wycheproofRsaPss4096Sha256S32Keys,
  wycheproofRsaPss4096Sha384S48Cases,
  wycheproofRsaPss4096Sha384S48Keys,
  wycheproofRsaPss4096Sha512S32Cases,
  wycheproofRsaPss4096Sha512S32Keys,
  wycheproofRsaPss4096Sha512S64Cases,
  wycheproofRsaPss4096Sha512S64Keys,
  wycheproofRsaPssMiscCases,
  wycheproofRsaPssMiscKeys,
} from "../crypto_wycheproof_rsa/rsa_pss";
import {
  CavpRsaCase,
  CavpRsaPssCase,
  cavpRsaSigVer15Cases,
  cavpRsaSigVer15Keys,
} from "../crypto_cavp_rsa/sigver15";
import { cavpRsaSigVerPssCases, cavpRsaSigVerPssKeys } from "../crypto_cavp_rsa/sigver_pss";
import {
  CRAFTED_MSG,
  CRAFTED_N,
  CRAFTED_PKCS1_BLOCK_TYPE_2,
  CRAFTED_PKCS1_MISSING_NULL,
  CRAFTED_PKCS1_PS_NOT_FF,
  CRAFTED_PKCS1_TRAILING,
  CRAFTED_PKCS1_VALID,
  CRAFTED_PSS_NO_ONE,
  CRAFTED_PSS_PS_NONZERO,
  CRAFTED_PSS_TRAILER,
  CRAFTED_PSS_VALID,
} from "./crafted";
import { fromHex } from "./hex";

/** The module's id for a hash as Wycheproof ("SHA-256") or CAVP ("SHA256") names it, or 0 for any other. */
const hashId = (name: string): i32 =>
  name === "SHA-256" || name === "SHA256"
    ? RSA_SHA256
    : name === "SHA-384" || name === "SHA384"
      ? RSA_SHA384
      : name === "SHA-512" || name === "SHA512"
        ? RSA_SHA512
        : 0;

/** `a` then `b`, in a new array. */
const concat = (a: u8[], b: u8[]): u8[] => {
  const out: u8[] = [];
  for (const x of a) {
    out.push(x);
  }
  for (const x of b) {
    out.push(x);
  }
  return out;
};

/** `bytes` without its first `from` octets and its last `drop`, in a copy. */
const slice = (bytes: u8[], from: i32, drop: i32): u8[] => {
  const out: u8[] = [];
  const end: i32 = toI32(bytes.length) - drop;
  for (let i: i32 = from; i < end && i < toI32(bytes.length); i++) {
    out.push(bytes[i]);
  }
  return out;
};

/** `bytes` with the octet at `at` replaced by `value`, in a copy. */
const setAt = (bytes: u8[], at: i32, value: u8): u8[] => {
  const out: u8[] = slice(bytes, 0, 0);
  out[at] = value;
  return out;
};

/** `length` octets, all 0xff but the first, which is `first`: an odd number of 8 * `length` - clz(first) bits. */
const wide = (length: i32, first: u8): u8[] => {
  const out: u8[] = [];
  for (let i: i32 = 0; i < length; i++) {
    out.push(i === 0 ? first : 0xff);
  }
  return out;
};

/** A DER element: `tag`, the minimal length of `body`, and `body`. */
const tlv = (tag: u8, body: u8[]): u8[] => {
  const length: i32 = toI32(body.length);
  const head: u8[] = [tag];
  if (length >= 0x100) {
    head.push(0x82);
    head.push(toU8(length >> 8));
  } else if (length >= 0x80) {
    head.push(0x81);
  }
  head.push(toU8(length));
  return concat(head, body);
};

/** The DER INTEGER of the positive big-endian `magnitude`, with the sign octet it needs. */
const derInt = (magnitude: u8[]): u8[] => {
  const zero: u8[] = [0];
  return tlv(0x02, (magnitude[0] & 0x80) !== 0 ? concat(zero, magnitude) : magnitude);
};

/** The PKCS #1 RSAPublicKey DER of `n` and `e`. */
const rsaDer = (n: u8[], e: u8[]): u8[] => tlv(0x30, concat(derInt(n), derInt(e)));

/** The keys of a Wycheproof file, each parsed from its DER; a key the module refuses fails the check and is left invalid. */
const wycheproofKeys = (t: Suite, file: string, ders: string[]): RsaPublicKey[] => {
  const out: RsaPublicKey[] = [];
  for (const der of ders) {
    const key: RsaPublicKey | null = rsaPublicKeyFromDer(fromHex(der));
    if (key === null) {
      t.fail(`wycheproof ${file} key ${toI32(out.length)}`, "rsaPublicKeyFromDer refused it");
      out.push(new RsaPublicKey([], 0));
    } else {
      out.push(key);
    }
  }
  return out;
};

/**
 * Whether one case answered what its file expects, given whether it
 * verified: `valid` must verify, and `invalid` and `acceptable` must not —
 * the only acceptable cases are PKCS #1 encodings without the NULL, which
 * this module refuses on purpose. Counted into `tally` (valid, invalid,
 * acceptable); a mismatch is named by file and tcId.
 */
const judge = (t: Suite, file: string, c: WycheproofRsaCase, verified: boolean, tally: i32[]): boolean => {
  const valid: boolean = c.result === "valid";
  if (valid !== verified) {
    t.fail(
      `wycheproof ${file} tcId ${c.tcId}`,
      valid ? "a valid signature did not verify" : `an ${c.result} signature verified`
    );
    return false;
  }
  const at: i32 = valid ? 0 : c.result === "invalid" ? 1 : 2;
  tally[at] = tally[at] + 1;
  return true;
};

/** The line each Wycheproof file prints. */
const wycheproofLine = (file: string, cases: i32, tally: i32[], filtered: i32): void => {
  console.log(
    `wycheproof ${file}: ${cases} cases, ${tally[0]} valid verified, ${tally[1]} invalid refused, ${tally[2]} acceptable refused, ${filtered} filtered out`
  );
};

/** Runs every case of a Wycheproof PKCS #1 v1.5 file. Answers the number of mismatches. */
const wycheproofPkcs1 = (t: Suite, file: string, ders: WycheproofRsaKey[], cases: WycheproofRsaCase[]): i32 => {
  const derHex: string[] = [];
  for (const k of ders) {
    derHex.push(k.der);
  }
  const keys: RsaPublicKey[] = wycheproofKeys(t, file, derHex);
  const tally: i32[] = [0, 0, 0];
  let mismatches: i32 = toI32(ders.length) - toI32(keys.length);
  for (const c of cases) {
    const at: i32 = toI32(c.key);
    const key: RsaPublicKey = keys[at];
    const verified: boolean = rsaVerifyPkcs1(key, hashId(ders[at].sha), fromHex(c.msg), fromHex(c.sig));
    if (!judge(t, file, c, verified, tally) || !key.valid) {
      mismatches += 1;
    }
  }
  wycheproofLine(file, toI32(cases.length), tally, 0);
  return mismatches;
};

/**
 * Runs every case of a Wycheproof RSA-PSS file whose group this module can
 * run — SHA-256, SHA-384 or SHA-512, with MGF1 over the same hash — and
 * counts the others as filtered out. Answers the number of mismatches.
 */
const wycheproofPss = (t: Suite, file: string, groups: WycheproofRsaPssKey[], cases: WycheproofRsaCase[]): i32 => {
  const derHex: string[] = [];
  const runs: boolean[] = [];
  for (const g of groups) {
    const ok: boolean = hashId(g.sha) !== 0 && g.mgfSha === g.sha;
    runs.push(ok);
    // A group that is filtered out is not parsed either: its key may be one
    // this module refuses, and that is not what its cases test.
    derHex.push(ok ? g.der : "");
  }
  const keys: RsaPublicKey[] = [];
  for (let i: i32 = 0; i < toI32(groups.length); i++) {
    const one: string[] = [derHex[i]];
    keys.push(runs[i] ? wycheproofKeys(t, `${file} group`, one)[0] : new RsaPublicKey([], 0));
  }
  const tally: i32[] = [0, 0, 0];
  let filtered: i32 = 0;
  let mismatches: i32 = 0;
  for (const c of cases) {
    const at: i32 = toI32(c.key);
    if (!runs[at]) {
      filtered += 1;
      continue;
    }
    const g: WycheproofRsaPssKey = groups[at];
    const key: RsaPublicKey = keys[at];
    const verified: boolean = rsaVerifyPss(key, hashId(g.sha), toI32(g.sLen), fromHex(c.msg), fromHex(c.sig));
    if (!judge(t, file, c, verified, tally) || !key.valid) {
      mismatches += 1;
    }
  }
  wycheproofLine(file, toI32(cases.length), tally, filtered);
  return mismatches;
};

/**
 * Whether a CAVP case answered what upstream expects, given the key its parts
 * make (null when the key policy refuses them) and whether it verified: a "P"
 * must verify, and an "F" of any reason must not. Counted into `tally`
 * (passes verified, fails refused by the key policy, fails refused by the
 * verify).
 */
const cavpJudge = (t: Suite, name: string, result: string, key: RsaPublicKey | null, verified: boolean, tally: i32[]): boolean => {
  const pass: boolean = result === "P";
  if (pass !== verified) {
    t.fail(name, pass ? "a P signature did not verify" : `an ${result} signature verified`);
    return false;
  }
  const at: i32 = pass ? 0 : key === null ? 1 : 2;
  tally[at] = tally[at] + 1;
  return true;
};

/** The line each CAVP file prints. */
const cavpLine = (file: string, cases: i32, tally: i32[]): void => {
  console.log(
    `cavp ${file}: ${cases} cases, ${tally[0]} P verified, ${tally[1] + tally[2]} F refused (${tally[1]} by the key policy, ${tally[2]} by the verify)`
  );
};

/** Runs every kept case of SigVer15. Answers the number of mismatches. */
const cavpPkcs1 = (t: Suite, keys: string[], cases: CavpRsaCase[]): i32 => {
  const tally: i32[] = [0, 0, 0];
  let mismatches: i32 = 0;
  let index: i32 = 0;
  for (const c of cases) {
    const key: RsaPublicKey | null = rsaPublicKeyFromParts(fromHex(keys[toI32(c.key)]), fromHex(c.e));
    const verified: boolean = key !== null && rsaVerifyPkcs1(key, hashId(c.sha), fromHex(c.msg), fromHex(c.sig));
    if (!cavpJudge(t, `cavp SigVer15 case ${index}`, c.result, key, verified, tally)) {
      mismatches += 1;
    }
    index += 1;
  }
  cavpLine("SigVer15", toI32(cases.length), tally);
  return mismatches;
};

/** Runs every kept case of SigVerPSS. Answers the number of mismatches. */
const cavpPss = (t: Suite, keys: string[], cases: CavpRsaPssCase[]): i32 => {
  const tally: i32[] = [0, 0, 0];
  let mismatches: i32 = 0;
  let index: i32 = 0;
  for (const c of cases) {
    const key: RsaPublicKey | null = rsaPublicKeyFromParts(fromHex(keys[toI32(c.key)]), fromHex(c.e));
    const verified: boolean =
      key !== null && rsaVerifyPss(key, hashId(c.sha), toI32(c.saltLen), fromHex(c.msg), fromHex(c.sig));
    if (!cavpJudge(t, `cavp SigVerPSS case ${index}`, c.result, key, verified, tally)) {
      mismatches += 1;
    }
    index += 1;
  }
  cavpLine("SigVerPSS", toI32(cases.length), tally);
  return mismatches;
};

/** Whether `fromParts(n, e)` refused the pair. */
const refusedParts = (n: u8[], e: u8[]): boolean => rsaPublicKeyFromParts(n, e) === null;

export const runSuite = (): i32 => {
  const t = new Suite("rsa");

  t.ok("the three hash ids differ", RSA_SHA256 !== RSA_SHA384 && RSA_SHA384 !== RSA_SHA512 && RSA_SHA256 !== RSA_SHA512);

  // --- Wycheproof PKCS #1 v1.5 ------------------------------------------------
  t.eqI32("wycheproof rsa_signature_2048_sha256: every case answers what the file expects", wycheproofPkcs1(t, "rsa_signature_2048_sha256", wycheproofRsa2048Sha256Keys(), wycheproofRsa2048Sha256Cases()), toI32(0));
  t.eqI32("wycheproof rsa_signature_2048_sha384: every case answers what the file expects", wycheproofPkcs1(t, "rsa_signature_2048_sha384", wycheproofRsa2048Sha384Keys(), wycheproofRsa2048Sha384Cases()), toI32(0));
  t.eqI32("wycheproof rsa_signature_2048_sha512: every case answers what the file expects", wycheproofPkcs1(t, "rsa_signature_2048_sha512", wycheproofRsa2048Sha512Keys(), wycheproofRsa2048Sha512Cases()), toI32(0));
  t.eqI32("wycheproof rsa_signature_3072_sha256: every case answers what the file expects", wycheproofPkcs1(t, "rsa_signature_3072_sha256", wycheproofRsa3072Sha256Keys(), wycheproofRsa3072Sha256Cases()), toI32(0));
  t.eqI32("wycheproof rsa_signature_3072_sha384: every case answers what the file expects", wycheproofPkcs1(t, "rsa_signature_3072_sha384", wycheproofRsa3072Sha384Keys(), wycheproofRsa3072Sha384Cases()), toI32(0));
  t.eqI32("wycheproof rsa_signature_3072_sha512: every case answers what the file expects", wycheproofPkcs1(t, "rsa_signature_3072_sha512", wycheproofRsa3072Sha512Keys(), wycheproofRsa3072Sha512Cases()), toI32(0));
  t.eqI32("wycheproof rsa_signature_4096_sha256: every case answers what the file expects", wycheproofPkcs1(t, "rsa_signature_4096_sha256", wycheproofRsa4096Sha256Keys(), wycheproofRsa4096Sha256Cases()), toI32(0));
  t.eqI32("wycheproof rsa_signature_4096_sha384: every case answers what the file expects", wycheproofPkcs1(t, "rsa_signature_4096_sha384", wycheproofRsa4096Sha384Keys(), wycheproofRsa4096Sha384Cases()), toI32(0));
  t.eqI32("wycheproof rsa_signature_4096_sha512: every case answers what the file expects", wycheproofPkcs1(t, "rsa_signature_4096_sha512", wycheproofRsa4096Sha512Keys(), wycheproofRsa4096Sha512Cases()), toI32(0));

  // --- Wycheproof RSA-PSS ---------------------------------------------------------
  t.eqI32("wycheproof rsa_pss_2048_sha256_mgf1_0: every case answers what the file expects", wycheproofPss(t, "rsa_pss_2048_sha256_mgf1_0", wycheproofRsaPss2048Sha256S0Keys(), wycheproofRsaPss2048Sha256S0Cases()), toI32(0));
  t.eqI32("wycheproof rsa_pss_2048_sha256_mgf1_32: every case answers what the file expects", wycheproofPss(t, "rsa_pss_2048_sha256_mgf1_32", wycheproofRsaPss2048Sha256S32Keys(), wycheproofRsaPss2048Sha256S32Cases()), toI32(0));
  t.eqI32("wycheproof rsa_pss_2048_sha384_mgf1_48: every case answers what the file expects", wycheproofPss(t, "rsa_pss_2048_sha384_mgf1_48", wycheproofRsaPss2048Sha384S48Keys(), wycheproofRsaPss2048Sha384S48Cases()), toI32(0));
  t.eqI32("wycheproof rsa_pss_3072_sha256_mgf1_32: every case answers what the file expects", wycheproofPss(t, "rsa_pss_3072_sha256_mgf1_32", wycheproofRsaPss3072Sha256S32Keys(), wycheproofRsaPss3072Sha256S32Cases()), toI32(0));
  t.eqI32("wycheproof rsa_pss_4096_sha256_mgf1_32: every case answers what the file expects", wycheproofPss(t, "rsa_pss_4096_sha256_mgf1_32", wycheproofRsaPss4096Sha256S32Keys(), wycheproofRsaPss4096Sha256S32Cases()), toI32(0));
  t.eqI32("wycheproof rsa_pss_4096_sha384_mgf1_48: every case answers what the file expects", wycheproofPss(t, "rsa_pss_4096_sha384_mgf1_48", wycheproofRsaPss4096Sha384S48Keys(), wycheproofRsaPss4096Sha384S48Cases()), toI32(0));
  t.eqI32("wycheproof rsa_pss_4096_sha512_mgf1_32: every case answers what the file expects", wycheproofPss(t, "rsa_pss_4096_sha512_mgf1_32", wycheproofRsaPss4096Sha512S32Keys(), wycheproofRsaPss4096Sha512S32Cases()), toI32(0));
  t.eqI32("wycheproof rsa_pss_4096_sha512_mgf1_64: every case answers what the file expects", wycheproofPss(t, "rsa_pss_4096_sha512_mgf1_64", wycheproofRsaPss4096Sha512S64Keys(), wycheproofRsaPss4096Sha512S64Cases()), toI32(0));
  t.eqI32("wycheproof rsa_pss_misc: every case it can run answers what the file expects", wycheproofPss(t, "rsa_pss_misc", wycheproofRsaPssMiscKeys(), wycheproofRsaPssMiscCases()), toI32(0));

  // --- CAVP -----------------------------------------------------------------------
  t.eqI32("cavp SigVer15: every case answers what the file expects", cavpPkcs1(t, cavpRsaSigVer15Keys(), cavpRsaSigVer15Cases()), toI32(0));
  t.eqI32("cavp SigVerPSS: every case answers what the file expects", cavpPss(t, cavpRsaSigVerPssKeys(), cavpRsaSigVerPssCases()), toI32(0));

  // --- Keys: the policy -------------------------------------------------------------
  const n: u8[] = fromHex(CRAFTED_N);
  const e: u8[] = [0x01, 0x00, 0x01];
  const key: RsaPublicKey | null = rsaPublicKeyFromParts(n, e);
  if (key === null) {
    t.fail("the crafted key", "rsaPublicKeyFromParts refused it, so the rest cannot run");
    return t.done();
  }
  t.ok("the crafted key is valid", key.valid);
  t.eqI32("its modulus has 2048 bits", key.bits, toI32(2048));
  t.eqI32("and is 256 bytes", key.size, toI32(256));
  t.ok("its exponent is 65537", key.exponent === toU32(65537));

  const n2047: u8[] = setAt(n, 0, n[0] >> 1);
  t.ok("a 2047-bit modulus is refused", refusedParts(n2047, e));
  t.ok("a 2040-bit modulus is refused", refusedParts(slice(n, 1, 0), e));
  t.ok("a 4096-bit modulus is taken", !refusedParts(wide(512, 0x80), e));
  t.ok("a 4097-bit modulus is refused", refusedParts(wide(513, 0x01), e));
  t.ok("an even modulus is refused", refusedParts(setAt(n, 255, n[255] & 0xfe), e));
  t.ok("a modulus with a leading zero octet is refused", refusedParts(concat([0], n), e));
  t.ok("an empty modulus is refused", refusedParts([], e));
  t.ok("an empty exponent is refused", refusedParts(n, []));
  t.ok("an exponent with a leading zero octet is refused", refusedParts(n, [0x00, 0x01, 0x00, 0x01]));
  t.ok("e = 1 is refused", refusedParts(n, [0x01]));
  t.ok("e = 2 is refused", refusedParts(n, [0x02]));
  t.ok("e = 65536 is refused", refusedParts(n, [0x01, 0x00, 0x00]));
  t.ok("e = 3 is taken", !refusedParts(n, [0x03]));
  t.ok("e = 2^32 - 1 is taken", !refusedParts(n, [0xff, 0xff, 0xff, 0xff]));
  t.ok("e = 2^32 is refused", refusedParts(n, [0x01, 0x00, 0x00, 0x00, 0x00]));
  t.ok("e = 2^32 + 1 is refused", refusedParts(n, [0x01, 0x00, 0x00, 0x00, 0x01]));

  // `new` applies the policy too: a key it refuses verifies nothing.
  const msg: u8[] = fromHex(CRAFTED_MSG);
  const pkcs1: u8[] = fromHex(CRAFTED_PKCS1_VALID);
  const pss: u8[] = fromHex(CRAFTED_PSS_VALID);
  const direct: RsaPublicKey = new RsaPublicKey(n, 65537);
  t.ok("new RsaPublicKey of the crafted key is valid", direct.valid);
  t.ok("and verifies its PKCS #1 v1.5 signature", rsaVerifyPkcs1(direct, RSA_SHA256, msg, pkcs1));
  const weak: RsaPublicKey = new RsaPublicKey(n2047, 65537);
  t.ok("new RsaPublicKey of a 2047-bit modulus is not valid", !weak.valid);
  t.ok("and verifies nothing (PKCS #1 v1.5)", !rsaVerifyPkcs1(weak, RSA_SHA256, msg, pkcs1));
  t.ok("and verifies nothing (PSS)", !rsaVerifyPss(weak, RSA_SHA256, 32, msg, pss));
  const evenE: RsaPublicKey = new RsaPublicKey(n, 65536);
  t.ok("new RsaPublicKey with e = 65536 is not valid", !evenE.valid);
  t.ok("and verifies nothing", !rsaVerifyPkcs1(evenE, RSA_SHA256, msg, pkcs1));
  t.ok("new RsaPublicKey with e = 1 is not valid", !new RsaPublicKey(n, 1).valid);

  // --- Keys: strict DER -------------------------------------------------------------
  const der: u8[] = rsaDer(n, e);
  const fromDer: RsaPublicKey | null = rsaPublicKeyFromDer(der);
  t.ok("the crafted key's DER is taken", fromDer !== null && fromDer.valid && fromDer.bits === 2048);
  t.ok("and verifies its signature", fromDer !== null && rsaVerifyPkcs1(fromDer, RSA_SHA256, msg, pkcs1));
  const nInt: u8[] = derInt(n);
  const eInt: u8[] = derInt(e);
  t.ok("a DER with an octet after the SEQUENCE is refused", rsaPublicKeyFromDer(concat(der, [0x00])) === null);
  t.ok("a DER one octet short is refused", rsaPublicKeyFromDer(slice(der, 0, 1)) === null);
  t.ok("a third INTEGER inside the SEQUENCE is refused", rsaPublicKeyFromDer(tlv(0x30, concat(concat(nInt, eInt), eInt))) === null);
  t.ok("a SEQUENCE of n alone is refused", rsaPublicKeyFromDer(tlv(0x30, nInt)) === null);
  t.ok("a SET in place of the SEQUENCE is refused", rsaPublicKeyFromDer(tlv(0x31, concat(nInt, eInt))) === null);
  t.ok("a BIT STRING in place of e's INTEGER is refused", rsaPublicKeyFromDer(tlv(0x30, concat(nInt, tlv(0x03, e)))) === null);
  t.ok("e as a non-minimal INTEGER is refused", rsaPublicKeyFromDer(tlv(0x30, concat(nInt, tlv(0x02, concat([0x00], e))))) === null);
  t.ok("n as a non-minimal INTEGER is refused", rsaPublicKeyFromDer(tlv(0x30, concat(tlv(0x02, concat([0x00, 0x00], n)), eInt))) === null);
  t.ok("n as a negative INTEGER is refused", rsaPublicKeyFromDer(tlv(0x30, concat(tlv(0x02, n), eInt))) === null);
  t.ok("e as a negative INTEGER is refused", rsaPublicKeyFromDer(tlv(0x30, concat(nInt, tlv(0x02, [0x81])))) === null);
  t.ok("e as an empty INTEGER is refused", rsaPublicKeyFromDer(tlv(0x30, concat(nInt, tlv(0x02, [])))) === null);
  t.ok("e = 0 is refused", rsaPublicKeyFromDer(tlv(0x30, concat(nInt, tlv(0x02, [0x00])))) === null);
  // e's length 3 in the long form, 81 03, where DER wants the short form 03.
  const eLong: u8[] = [0x02, 0x81, 0x03, 0x01, 0x00, 0x01];
  t.ok("a length in the long form when the short one fits is refused", rsaPublicKeyFromDer(tlv(0x30, concat(nInt, eLong))) === null);
  // The SEQUENCE's length in three octets, 83 00 01 0a, where two suffice.
  const body: u8[] = concat(nInt, eInt);
  const seqLong: u8[] = [0x30, 0x83, 0x00, toU8(toI32(body.length) >> 8), toU8(toI32(body.length))];
  t.ok("a length in more octets than it needs is refused", rsaPublicKeyFromDer(concat(seqLong, body)) === null);
  t.ok("an indefinite length is refused", rsaPublicKeyFromDer(concat(concat([0x30, 0x80], body), [0x00, 0x00])) === null);
  t.ok("an empty DER is refused", rsaPublicKeyFromDer([]) === null);
  t.ok("a DER longer than 1024 octets is refused", rsaPublicKeyFromDer(rsaDer(wide(1022, 0x80), e)) === null);
  t.ok("the DER of a 2047-bit modulus is refused", rsaPublicKeyFromDer(rsaDer(n2047, e)) === null);
  t.ok("the DER of a 4096-bit modulus is taken", rsaPublicKeyFromDer(rsaDer(wide(512, 0x80), e)) !== null);

  // --- Signatures: PKCS #1 v1.5 -----------------------------------------------------
  const digest: u8[] = sha256(msg);
  t.ok("the crafted PKCS #1 v1.5 signature verifies", rsaVerifyPkcs1(key, RSA_SHA256, msg, pkcs1));
  t.ok("and verifies by its digest", rsaVerifyPkcs1Digest(key, RSA_SHA256, digest, pkcs1));
  t.ok("not under SHA-384", !rsaVerifyPkcs1(key, RSA_SHA384, msg, pkcs1));
  t.ok("not under SHA-512", !rsaVerifyPkcs1(key, RSA_SHA512, msg, pkcs1));
  t.ok("not under an unknown hash id 0", !rsaVerifyPkcs1(key, 0, msg, pkcs1));
  t.ok("not under an unknown hash id 4", !rsaVerifyPkcs1(key, 4, msg, pkcs1));
  t.ok("not by digest under an unknown hash id", !rsaVerifyPkcs1Digest(key, 4, digest, pkcs1));
  t.ok("not by a 31-byte digest", !rsaVerifyPkcs1Digest(key, RSA_SHA256, slice(digest, 0, 1), pkcs1));
  t.ok("not by a 32-byte digest named SHA-384", !rsaVerifyPkcs1Digest(key, RSA_SHA384, digest, pkcs1));
  t.ok("not of another message", !rsaVerifyPkcs1(key, RSA_SHA256, concat(msg, [0x21]), pkcs1));
  t.ok("not one octet short", !rsaVerifyPkcs1(key, RSA_SHA256, msg, slice(pkcs1, 1, 0)));
  t.ok("not one octet long, with a leading zero", !rsaVerifyPkcs1(key, RSA_SHA256, msg, concat([0x00], pkcs1)));
  t.ok("not as an RSA-PSS signature", !rsaVerifyPss(key, RSA_SHA256, 32, msg, pkcs1));
  t.ok("s = n is refused", !rsaVerifyPkcs1(key, RSA_SHA256, msg, n));
  t.ok("s = 2^2048 - 1 is refused", !rsaVerifyPkcs1(key, RSA_SHA256, msg, wide(256, 0xff)));
  t.ok("s = 0 is refused", !rsaVerifyPkcs1(key, RSA_SHA256, msg, new Array<u8>(256)));
  t.ok("s = 1 is refused", !rsaVerifyPkcs1(key, RSA_SHA256, msg, setAt(new Array<u8>(256), 255, 1)));
  t.ok("a DigestInfo without its NULL is refused", !rsaVerifyPkcs1(key, RSA_SHA256, msg, fromHex(CRAFTED_PKCS1_MISSING_NULL)));
  t.ok("block type 02 is refused", !rsaVerifyPkcs1(key, RSA_SHA256, msg, fromHex(CRAFTED_PKCS1_BLOCK_TYPE_2)));
  t.ok("a padding octet other than 0xff is refused", !rsaVerifyPkcs1(key, RSA_SHA256, msg, fromHex(CRAFTED_PKCS1_PS_NOT_FF)));
  t.ok("octets after the digest are refused", !rsaVerifyPkcs1(key, RSA_SHA256, msg, fromHex(CRAFTED_PKCS1_TRAILING)));

  // --- Signatures: RSA-PSS ----------------------------------------------------------
  t.ok("the crafted RSA-PSS signature verifies with a 32-byte salt", rsaVerifyPss(key, RSA_SHA256, 32, msg, pss));
  t.ok("and verifies by its digest", rsaVerifyPssDigest(key, RSA_SHA256, 32, digest, pss));
  t.ok("not with a 31-byte salt", !rsaVerifyPss(key, RSA_SHA256, 31, msg, pss));
  t.ok("not with a 33-byte salt", !rsaVerifyPss(key, RSA_SHA256, 33, msg, pss));
  t.ok("not with no salt", !rsaVerifyPss(key, RSA_SHA256, 0, msg, pss));
  t.ok("not with a salt length of -1", !rsaVerifyPss(key, RSA_SHA256, -1, msg, pss));
  t.ok("not with a salt longer than the encoding holds", !rsaVerifyPss(key, RSA_SHA256, 223, msg, pss));
  t.ok("not under SHA-384", !rsaVerifyPss(key, RSA_SHA384, 32, msg, pss));
  t.ok("not under an unknown hash id", !rsaVerifyPss(key, 4, 32, msg, pss));
  t.ok("not by digest under an unknown hash id", !rsaVerifyPssDigest(key, 0, 32, digest, pss));
  t.ok("not by a 33-byte digest", !rsaVerifyPssDigest(key, RSA_SHA256, 32, concat(digest, [0x00]), pss));
  t.ok("not of another message", !rsaVerifyPss(key, RSA_SHA256, 32, concat(msg, [0x21]), pss));
  t.ok("not one octet short", !rsaVerifyPss(key, RSA_SHA256, 32, msg, slice(pss, 0, 1)));
  t.ok("not one octet long, with a leading zero", !rsaVerifyPss(key, RSA_SHA256, 32, msg, concat([0x00], pss)));
  t.ok("not as a PKCS #1 v1.5 signature", !rsaVerifyPkcs1(key, RSA_SHA256, msg, pss));
  t.ok("s = n is refused", !rsaVerifyPss(key, RSA_SHA256, 32, msg, n));
  t.ok("a trailer of 0xbb is refused", !rsaVerifyPss(key, RSA_SHA256, 32, msg, fromHex(CRAFTED_PSS_TRAILER)));
  t.ok("a nonzero octet in the padding string is refused", !rsaVerifyPss(key, RSA_SHA256, 32, msg, fromHex(CRAFTED_PSS_PS_NONZERO)));
  t.ok("a zeroed 0x01 separator is refused", !rsaVerifyPss(key, RSA_SHA256, 32, msg, fromHex(CRAFTED_PSS_NO_ONE)));

  return t.done();
};
