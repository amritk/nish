// Wycheproof's ECDSA P-384 with SHA-384 vectors against `nish/crypto/p384`:
// signatures in DER, read by `p384DerSignatureRS`, and in IEEE P1363 `r || s`,
// handed to `p384VerifySha384` as they are. Every case must answer what its
// file expects; a mismatch fails by tcId, and each file prints how its cases
// were answered so a change in which check refuses what shows up in the diff
// of `expected.out`.

import { Suite } from "nish/testing";
import { p384DerSignatureRS, p384VerifySha384 } from "nish/crypto/p384";
import {
  WycheproofEcdsaCase,
  wycheproofP384Sha384Cases,
  wycheproofP384Sha384Keys,
  wycheproofP384Sha384P1363Cases,
  wycheproofP384Sha384P1363Keys,
} from "./ecdsa_secp384r1_sha384";
import { fromHex } from "./hex";

/**
 * Runs one file's cases and returns how many answered other than the file
 * expects. With `der`, a signature `p384DerSignatureRS` refuses counts as
 * refused by it, apart from the ones `p384VerifySha384` refuses.
 */
const wycheproof = (t: Suite, file: string, keys: string[], cases: WycheproofEcdsaCase[], der: boolean): i32 => {
  const keyCount: i32 = toI32(keys.length);
  let valid: i32 = 0;
  let invalidByDer: i32 = 0;
  let invalidByModule: i32 = 0;
  let acceptable: i32 = 0;
  let mismatches: i32 = 0;
  for (const c of cases) {
    const keyAt: i32 = toI32(c.key);
    if (keyAt < 0 || keyAt >= keyCount) {
      t.fail(`wycheproof ${file} tcId ${c.tcId}`, "no such key");
      mismatches += 1;
      continue;
    }
    const pub: u8[] = fromHex(keys[keyAt]);
    const msg: u8[] = fromHex(c.msg);
    let sig: u8[] | null = fromHex(c.sig);
    if (der && sig !== null) {
      sig = p384DerSignatureRS(sig);
    }
    const verified: boolean = sig !== null && p384VerifySha384(pub, msg, sig);
    if (c.result === "valid") {
      if (verified) {
        valid += 1;
      } else {
        t.fail(`wycheproof ${file} tcId ${c.tcId}`, sig === null ? "the DER did not parse" : "a valid signature did not verify");
        mismatches += 1;
      }
    } else if (c.result === "invalid") {
      if (verified) {
        t.fail(`wycheproof ${file} tcId ${c.tcId}`, "an invalid signature verified");
        mismatches += 1;
      } else if (sig === null) {
        invalidByDer += 1;
      } else {
        invalidByModule += 1;
      }
    } else {
      // Neither file has an acceptable case; one appearing is worth a look.
      t.fail(`wycheproof ${file} tcId ${c.tcId}`, `unexpected result ${c.result}`);
      acceptable += 1;
      mismatches += 1;
    }
  }
  console.log(
    `wycheproof ${file}: ${toI32(cases.length)} cases, ${valid} valid verified, ${invalidByDer + invalidByModule} invalid refused (${invalidByDer} by p384DerSignatureRS, ${invalidByModule} by p384VerifySha384), ${acceptable} acceptable`
  );
  return mismatches;
};

export const runSuite = (): i32 => {
  const t = new Suite("p384 wycheproof");
  const none: i32 = 0;

  t.eqI32(
    "ecdsa_secp384r1_sha384: every case answers what the file expects",
    wycheproof(t, "ecdsa_secp384r1_sha384", wycheproofP384Sha384Keys(), wycheproofP384Sha384Cases(), true),
    none
  );
  t.eqI32(
    "ecdsa_secp384r1_sha384_p1363: every case answers what the file expects",
    wycheproof(t, "ecdsa_secp384r1_sha384_p1363", wycheproofP384Sha384P1363Keys(), wycheproofP384Sha384P1363Cases(), false),
    none
  );
  return t.done();
};
