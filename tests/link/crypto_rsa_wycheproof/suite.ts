// Wycheproof's RSA signature vectors against `nish/crypto/rsa`: RSASSA-PKCS1-v1_5
// at 2048, 3072 and 4096 bits with SHA-256, SHA-384 and SHA-512, and RSASSA-PSS
// with each hash. Every case must answer what its file expects; a mismatch fails
// by tcId, and each file prints how its cases were answered so a change in which
// check refuses what shows up in the diff of `expected.out`.

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
import {
  WycheproofRsaCase,
  wycheproofRsa2048Sha256Cases,
  wycheproofRsa2048Sha256Keys,
  wycheproofRsa3072Sha384Cases,
  wycheproofRsa3072Sha384Keys,
  wycheproofRsa4096Sha512Cases,
  wycheproofRsa4096Sha512Keys,
} from "./pkcs1";
import {
  wycheproofPss2048Sha256Cases,
  wycheproofPss2048Sha256Keys,
  wycheproofPss2048Sha384Cases,
  wycheproofPss2048Sha384Keys,
  wycheproofPss3072Sha256Cases,
  wycheproofPss3072Sha256Keys,
  wycheproofPss4096Sha512Cases,
  wycheproofPss4096Sha512Keys,
} from "./pss";
import { fromHex } from "./hex";

/**
 * Runs one file's cases and returns how many answered other than the file
 * expects. `filtered` is the count of upstream cases the data file left out,
 * printed so the line accounts for every case of the upstream file.
 */
const wycheproof = (
  t: Suite,
  file: string,
  keys: string[],
  cases: WycheproofRsaCase[],
  hash: i32,
  pss: boolean,
  filtered: i32
): i32 => {
  const parsed: (RsaPublicKey | null)[] = [];
  for (const k of keys) {
    parsed.push(rsaParsePublicKey(fromHex(k)));
  }
  const keyCount: i32 = toI32(keys.length);
  let valid: i32 = 0;
  let invalidByKey: i32 = 0;
  let invalidByModule: i32 = 0;
  let acceptableTrue: i32 = 0;
  let acceptableFalse: i32 = 0;
  let mismatches: i32 = 0;
  for (const c of cases) {
    const keyAt: i32 = toI32(c.key);
    if (keyAt < 0 || keyAt >= keyCount) {
      t.fail(`wycheproof ${file} tcId ${c.tcId}`, "no such key");
      mismatches += 1;
      continue;
    }
    const key: RsaPublicKey | null = parsed[keyAt];
    const msg: u8[] = fromHex(c.msg);
    const sig: u8[] = fromHex(c.sig);
    let verified: boolean = false;
    if (key !== null) {
      verified = pss ? rsaVerifyPss(key, hash, msg, sig) : rsaVerifyPkcs1v15(key, hash, msg, sig);
    }
    if (c.result === "valid") {
      if (verified) {
        valid += 1;
      } else {
        t.fail(`wycheproof ${file} tcId ${c.tcId}`, key === null ? "the key did not parse" : "a valid signature did not verify");
        mismatches += 1;
      }
    } else if (c.result === "invalid") {
      if (verified) {
        t.fail(`wycheproof ${file} tcId ${c.tcId}`, "an invalid signature verified");
        mismatches += 1;
      } else if (key === null) {
        invalidByKey += 1;
      } else {
        invalidByModule += 1;
      }
    } else if (verified) {
      acceptableTrue += 1;
    } else {
      acceptableFalse += 1;
    }
  }
  const verifier: string = pss ? "rsaVerifyPss" : "rsaVerifyPkcs1v15";
  console.log(
    `wycheproof ${file}: ${toI32(cases.length) + filtered} cases, ${valid} valid verified, ${invalidByKey + invalidByModule} invalid refused (${invalidByKey} by rsaParsePublicKey, ${invalidByModule} by ${verifier}), ${acceptableTrue + acceptableFalse} acceptable (${acceptableTrue} verified, ${acceptableFalse} refused), ${filtered} filtered out`
  );
  return mismatches;
};

export const runSuite = (): i32 => {
  const t = new Suite("rsa wycheproof");
  const none: i32 = 0;

  t.eqI32(
    "rsa_signature_2048_sha256: every case answers what the file expects",
    wycheproof(t, "rsa_signature_2048_sha256", wycheproofRsa2048Sha256Keys(), wycheproofRsa2048Sha256Cases(), RSA_HASH_SHA256, false, none),
    none
  );
  t.eqI32(
    "rsa_signature_3072_sha384: every case answers what the file expects",
    wycheproof(t, "rsa_signature_3072_sha384", wycheproofRsa3072Sha384Keys(), wycheproofRsa3072Sha384Cases(), RSA_HASH_SHA384, false, none),
    none
  );
  t.eqI32(
    "rsa_signature_4096_sha512: every case answers what the file expects",
    wycheproof(t, "rsa_signature_4096_sha512", wycheproofRsa4096Sha512Keys(), wycheproofRsa4096Sha512Cases(), RSA_HASH_SHA512, false, none),
    none
  );
  t.eqI32(
    "rsa_pss_2048_sha256_mgf1_32: every case answers what the file expects",
    wycheproof(t, "rsa_pss_2048_sha256_mgf1_32", wycheproofPss2048Sha256Keys(), wycheproofPss2048Sha256Cases(), RSA_HASH_SHA256, true, none),
    none
  );
  t.eqI32(
    "rsa_pss_3072_sha256_mgf1_32: every case answers what the file expects",
    wycheproof(t, "rsa_pss_3072_sha256_mgf1_32", wycheproofPss3072Sha256Keys(), wycheproofPss3072Sha256Cases(), RSA_HASH_SHA256, true, none),
    none
  );
  t.eqI32(
    "rsa_pss_2048_sha384_mgf1_48: every case answers what the file expects",
    wycheproof(t, "rsa_pss_2048_sha384_mgf1_48", wycheproofPss2048Sha384Keys(), wycheproofPss2048Sha384Cases(), RSA_HASH_SHA384, true, none),
    none
  );
  t.eqI32(
    "rsa_pss_4096_sha512_mgf1_64: every case answers what the file expects",
    wycheproof(t, "rsa_pss_4096_sha512_mgf1_64", wycheproofPss4096Sha512Keys(), wycheproofPss4096Sha512Cases(), RSA_HASH_SHA512, true, none),
    none
  );
  return t.done();
};
