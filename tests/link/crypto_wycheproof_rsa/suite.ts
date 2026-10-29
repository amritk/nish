// `nish/crypto/rsa` against every Project Wycheproof RSA signature case it can
// run: RSASSA-PKCS1-v1_5 with SHA-256, SHA-384 and SHA-512 under 2048-, 3072-,
// 4096- and 8192-bit keys, and RSASSA-PSS with MGF1 over the message hash, the
// salt lengths the files name, under 2048-, 3072- and 4096-bit keys. Each key
// goes through `rsaParsePublicKey` and each case through `rsaVerifyPkcs1v15` or
// `rsaVerifyPss`. docs/security/crypto-rsa.md is the audit these checks pin.
//
// It runs under `--number-mode f64` and the speed profile, the mode and profile
// the vectors cost least in; `tests/link/crypto_rsa` runs the refusals in i32.
import { Suite } from "nish/testing";
import {
  RSA_HASH_SHA256,
  RSA_HASH_SHA384,
  RSA_HASH_SHA512,
  RsaPublicKey,
  rsaParsePublicKey,
  rsaVerifyPkcs1v15,
  rsaVerifyPss,
} from "nish/crypto/rsa";
import { WycheproofRsaCase, WycheproofRsaKey } from "./types";
import {
  wycheproofRsaPkcs2048Sha256Cases,
  wycheproofRsaPkcs2048Sha256Keys,
  wycheproofRsaPkcs2048Sha384Cases,
  wycheproofRsaPkcs2048Sha384Keys,
  wycheproofRsaPkcs2048Sha512Cases,
  wycheproofRsaPkcs2048Sha512Keys,
} from "./pkcs1v15_2048";
import {
  wycheproofRsaPkcs3072Sha256Cases,
  wycheproofRsaPkcs3072Sha256Keys,
  wycheproofRsaPkcs3072Sha384Cases,
  wycheproofRsaPkcs3072Sha384Keys,
  wycheproofRsaPkcs3072Sha512Cases,
  wycheproofRsaPkcs3072Sha512Keys,
} from "./pkcs1v15_3072";
import {
  wycheproofRsaPkcs4096Sha256Cases,
  wycheproofRsaPkcs4096Sha256Keys,
  wycheproofRsaPkcs4096Sha384Cases,
  wycheproofRsaPkcs4096Sha384Keys,
  wycheproofRsaPkcs4096Sha512Cases,
  wycheproofRsaPkcs4096Sha512Keys,
} from "./pkcs1v15_4096";
import {
  wycheproofRsaPkcs8192Sha256Cases,
  wycheproofRsaPkcs8192Sha256Keys,
  wycheproofRsaPkcs8192Sha384Cases,
  wycheproofRsaPkcs8192Sha384Keys,
  wycheproofRsaPkcs8192Sha512Cases,
  wycheproofRsaPkcs8192Sha512Keys,
} from "./pkcs1v15_8192";
import {
  wycheproofRsaPss2048Sha256Salt0Cases,
  wycheproofRsaPss2048Sha256Salt0Keys,
  wycheproofRsaPss2048Sha256Salt32Cases,
  wycheproofRsaPss2048Sha256Salt32Keys,
  wycheproofRsaPss2048Sha384Salt48Cases,
  wycheproofRsaPss2048Sha384Salt48Keys,
  wycheproofRsaPss3072Sha256Salt32Cases,
  wycheproofRsaPss3072Sha256Salt32Keys,
  wycheproofRsaPss4096Sha256Salt32Cases,
  wycheproofRsaPss4096Sha256Salt32Keys,
  wycheproofRsaPss4096Sha384Salt48Cases,
  wycheproofRsaPss4096Sha384Salt48Keys,
  wycheproofRsaPss4096Sha512Salt32Cases,
  wycheproofRsaPss4096Sha512Salt32Keys,
  wycheproofRsaPss4096Sha512Salt64Cases,
  wycheproofRsaPss4096Sha512Salt64Keys,
  wycheproofRsaPssMiscCases,
  wycheproofRsaPssMiscKeys,
} from "./pss";
import { fromHex } from "./hex";

/** The module's hash id for a Wycheproof hash name, or 0 for one it does not offer. */
const hashId = (sha: string): i32 => {
  if (sha === "SHA-256") {
    return RSA_HASH_SHA256;
  }
  if (sha === "SHA-384") {
    return RSA_HASH_SHA384;
  }
  if (sha === "SHA-512") {
    return RSA_HASH_SHA512;
  }
  return 0;
};

/**
 * Every case of one Wycheproof file, checked against its expected result:
 * through `rsaVerifyPss` with the group's salt length when `pss` is set, and
 * `rsaVerifyPkcs1v15` otherwise. Every group's key must parse. `valid` must
 * verify and `invalid` must not; `acceptable` may go either way and is only
 * counted. A mismatch is named by its file and `tcId`. Answers the number of
 * mismatches.
 */
const wycheproof = (
  t: Suite,
  file: string,
  keys: WycheproofRsaKey[],
  cases: WycheproofRsaCase[],
  pss: boolean
): i32 => {
  const parsed: (RsaPublicKey | null)[] = [];
  let mismatches: i32 = 0;
  for (const k of keys) {
    const key: RsaPublicKey | null = rsaParsePublicKey(fromHex(k.der));
    if (key === null || hashId(k.sha) === 0) {
      t.fail(`wycheproof ${file} key ${toI32(parsed.length)}`, "a group's key did not parse, or its hash is not offered");
      mismatches += 1;
    }
    parsed.push(key);
  }
  let valid: i32 = 0;
  let invalid: i32 = 0;
  let acceptableTrue: i32 = 0;
  let acceptableFalse: i32 = 0;
  for (const c of cases) {
    const keyAt: i32 = toI32(c.key);
    if (keyAt < 0 || keyAt >= toI32(parsed.length) || keyAt >= toI32(keys.length)) {
      t.fail(`wycheproof ${file} tcId ${c.tcId}`, "no such key");
      mismatches += 1;
      continue;
    }
    const key: RsaPublicKey | null = parsed[keyAt];
    const group: WycheproofRsaKey = keys[keyAt];
    const hash: i32 = hashId(group.sha);
    const msg: u8[] = fromHex(c.msg);
    const sig: u8[] = fromHex(c.sig);
    let verified: boolean = false;
    if (key !== null) {
      verified = pss
        ? rsaVerifyPss(key, hash, toI32(group.sLen), msg, sig)
        : rsaVerifyPkcs1v15(key, hash, msg, sig);
    }
    if (c.result === "valid") {
      if (verified) {
        valid += 1;
      } else {
        t.fail(`wycheproof ${file} tcId ${c.tcId}`, "a valid signature did not verify");
        mismatches += 1;
      }
    } else if (c.result === "invalid") {
      if (verified) {
        t.fail(`wycheproof ${file} tcId ${c.tcId}`, "an invalid signature verified");
        mismatches += 1;
      } else {
        invalid += 1;
      }
    } else if (verified) {
      acceptableTrue += 1;
    } else {
      acceptableFalse += 1;
    }
  }
  console.log(
    `wycheproof ${file}: ${toI32(cases.length)} cases, ${valid} valid verified, ${invalid} invalid refused, ${acceptableTrue + acceptableFalse} acceptable (${acceptableTrue} verified, ${acceptableFalse} refused)`
  );
  return mismatches;
};

export const runSuite = (): i32 => {
  const t = new Suite("rsa wycheproof");
  // PKCS #1 v1.5. Each file's one acceptable case, tcId 8, is a DigestInfo
  // without its NULL parameters, which the module refuses: the expected output
  // pins "1 refused".
  let m: i32 = 0;
  m += wycheproof(t, "rsa_signature_2048_sha256", wycheproofRsaPkcs2048Sha256Keys(), wycheproofRsaPkcs2048Sha256Cases(), false);
  m += wycheproof(t, "rsa_signature_2048_sha384", wycheproofRsaPkcs2048Sha384Keys(), wycheproofRsaPkcs2048Sha384Cases(), false);
  m += wycheproof(t, "rsa_signature_2048_sha512", wycheproofRsaPkcs2048Sha512Keys(), wycheproofRsaPkcs2048Sha512Cases(), false);
  m += wycheproof(t, "rsa_signature_3072_sha256", wycheproofRsaPkcs3072Sha256Keys(), wycheproofRsaPkcs3072Sha256Cases(), false);
  m += wycheproof(t, "rsa_signature_3072_sha384", wycheproofRsaPkcs3072Sha384Keys(), wycheproofRsaPkcs3072Sha384Cases(), false);
  m += wycheproof(t, "rsa_signature_3072_sha512", wycheproofRsaPkcs3072Sha512Keys(), wycheproofRsaPkcs3072Sha512Cases(), false);
  m += wycheproof(t, "rsa_signature_4096_sha256", wycheproofRsaPkcs4096Sha256Keys(), wycheproofRsaPkcs4096Sha256Cases(), false);
  m += wycheproof(t, "rsa_signature_4096_sha384", wycheproofRsaPkcs4096Sha384Keys(), wycheproofRsaPkcs4096Sha384Cases(), false);
  m += wycheproof(t, "rsa_signature_4096_sha512", wycheproofRsaPkcs4096Sha512Keys(), wycheproofRsaPkcs4096Sha512Cases(), false);
  m += wycheproof(t, "rsa_signature_8192_sha256", wycheproofRsaPkcs8192Sha256Keys(), wycheproofRsaPkcs8192Sha256Cases(), false);
  m += wycheproof(t, "rsa_signature_8192_sha384", wycheproofRsaPkcs8192Sha384Keys(), wycheproofRsaPkcs8192Sha384Cases(), false);
  m += wycheproof(t, "rsa_signature_8192_sha512", wycheproofRsaPkcs8192Sha512Keys(), wycheproofRsaPkcs8192Sha512Cases(), false);
  // PSS.
  m += wycheproof(t, "rsa_pss_2048_sha256_mgf1_0", wycheproofRsaPss2048Sha256Salt0Keys(), wycheproofRsaPss2048Sha256Salt0Cases(), true);
  m += wycheproof(t, "rsa_pss_2048_sha256_mgf1_32", wycheproofRsaPss2048Sha256Salt32Keys(), wycheproofRsaPss2048Sha256Salt32Cases(), true);
  m += wycheproof(t, "rsa_pss_2048_sha384_mgf1_48", wycheproofRsaPss2048Sha384Salt48Keys(), wycheproofRsaPss2048Sha384Salt48Cases(), true);
  m += wycheproof(t, "rsa_pss_3072_sha256_mgf1_32", wycheproofRsaPss3072Sha256Salt32Keys(), wycheproofRsaPss3072Sha256Salt32Cases(), true);
  m += wycheproof(t, "rsa_pss_4096_sha256_mgf1_32", wycheproofRsaPss4096Sha256Salt32Keys(), wycheproofRsaPss4096Sha256Salt32Cases(), true);
  m += wycheproof(t, "rsa_pss_4096_sha384_mgf1_48", wycheproofRsaPss4096Sha384Salt48Keys(), wycheproofRsaPss4096Sha384Salt48Cases(), true);
  m += wycheproof(t, "rsa_pss_4096_sha512_mgf1_32", wycheproofRsaPss4096Sha512Salt32Keys(), wycheproofRsaPss4096Sha512Salt32Cases(), true);
  m += wycheproof(t, "rsa_pss_4096_sha512_mgf1_64", wycheproofRsaPss4096Sha512Salt64Keys(), wycheproofRsaPss4096Sha512Salt64Cases(), true);
  m += wycheproof(t, "rsa_pss_misc", wycheproofRsaPssMiscKeys(), wycheproofRsaPssMiscCases(), true);
  t.ok("every Wycheproof case gives its expected result", m === 0);
  return t.done();
};
