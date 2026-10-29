// `nish/crypto/p384` against NIST CAVP, Project Wycheproof and signatures made
// for it: the [P-384,SHA-256] and [P-384,SHA-384] sections of CAVP's SigVer
// (cavp.ts), Wycheproof's ecdsa_secp384r1_sha384_p1363 and
// ecdsa_secp384r1_sha256 files (wycheproof.ts), digests of every length signed
// by hand (crafted.ts), and the refusals the module promises — a public key
// that is not 97 bytes, not uncompressed, has a coordinate not below p or is
// off the curve; a signature that is not 96 bytes or has r or s zero or not
// below n; and a sum that is the point at infinity.
// docs/security/crypto-rsa.md is the audit these checks pin.
//
// The suite is a function rather than `main` so that `crypto_p384_f64` can run
// the same checks with `--number-mode f64`.
import { Suite } from "nish/testing";
import { sha256 } from "nish/crypto/sha256";
import { sha384 } from "nish/crypto/sha512";
import {
  P384_POINT_SIZE,
  P384_SCALAR_SIZE,
  P384_SIGNATURE_SIZE,
  p384Verify,
  p384VerifySha256,
  p384VerifySha384,
} from "nish/crypto/p384";
import { fromHex } from "./hex";
import { derToRS } from "./der";
import { P384CraftedCase, craftedP384Cases, craftedP384Keys } from "./crafted";
import { cavpP384Cases, cavpP384Keys } from "./cavp";
import { P384VectorCase, wycheproofP384Keys, wycheproofP384Sha256Der, wycheproofP384Sha384P1363 } from "./wycheproof";

/** The bytes of an ASCII string. */
const ascii = (text: string): u8[] => {
  const out: u8[] = [];
  const length: i32 = toI32(text.length);
  for (let i: i32 = 0; i < length; i++) {
    out.push(toU8(toI32(text.charCodeAt(i))));
  }
  return out;
};

const P: string = "fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffeffffffff0000000000000000ffffffff";
const N: string = "ffffffffffffffffffffffffffffffffffffffffffffffffc7634d81f4372ddf581a0db248b0a77aecec196accc52973";
const GX: string = "aa87ca22be8b05378eb1c71ef320ad746e1d3b628ba79b9859f741e082542a385502f25dbf55296c3a545e3872760ab7";
const GY: string = "3617de4a96262c6f5d9e98bf9292dc29f8f41dbd289a147ce9da3113b5f0b8c00a60b1ce1d7e819d7a431d7c90ea0e5f";
// Gy + 1, and 48 zero bytes.
const GY_PLUS_1: string = "3617de4a96262c6f5d9e98bf9292dc29f8f41dbd289a147ce9da3113b5f0b8c00a60b1ce1d7e819d7a431d7c90ea0e60";
const ZERO: string = "000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";

/**
 * The cases of one vector list through `p384Verify`, checked against each
 * case's expected result: the message hashed with SHA-384 or SHA-256 as the
 * case says, and the signature read by the strict `derToRS` when `der` is set
 * and handed over as it is (`r || s`) otherwise. `valid` must verify and
 * `invalid` must not; `acceptable` may go either way and is only counted. A
 * mismatch is named by its list and `tcId`. Answers the number of mismatches.
 */
const vectors = (t: Suite, name: string, keys: string[], cases: P384VectorCase[], der: boolean): i32 => {
  const keyCount: i32 = toI32(keys.length);
  let valid: i32 = 0;
  let invalidByDer: i32 = 0;
  let invalidByModule: i32 = 0;
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
    const pub: u8[] = fromHex(keys[keyAt]);
    const sig: u8[] | null = der ? derToRS(fromHex(c.sig)) : fromHex(c.sig);
    const msg: u8[] = fromHex(c.msg);
    const verified: boolean = sig !== null && p384Verify(pub, toI32(c.hash) === 384 ? sha384(msg) : sha256(msg), sig);
    if (c.result === "valid") {
      if (verified) {
        valid += 1;
      } else {
        t.fail(`${name} tcId ${c.tcId}`, "a valid signature did not verify");
        mismatches += 1;
      }
    } else if (c.result === "invalid") {
      if (verified) {
        t.fail(`${name} tcId ${c.tcId}`, "an invalid signature verified");
        mismatches += 1;
      } else if (sig === null) {
        invalidByDer += 1;
      } else {
        invalidByModule += 1;
      }
    } else if (verified) {
      acceptableTrue += 1;
    } else {
      acceptableFalse += 1;
    }
  }
  const refusedBy: string = der
    ? `${invalidByDer} by the DER reader, ${invalidByModule} by p384Verify`
    : `all ${invalidByModule} by p384Verify`;
  console.log(
    `${name}: ${toI32(cases.length)} cases, ${valid} valid verified, ${invalidByDer + invalidByModule} invalid refused (${refusedBy}), ${acceptableTrue + acceptableFalse} acceptable (${acceptableTrue} verified, ${acceptableFalse} refused)`
  );
  return mismatches;
};

export const runSuite = (): i32 => {
  const t = new Suite("p384");

  t.eqI32("P384_SCALAR_SIZE is 48", P384_SCALAR_SIZE, toI32(48));
  t.eqI32("P384_POINT_SIZE is 97", P384_POINT_SIZE, toI32(97));
  t.eqI32("P384_SIGNATURE_SIZE is 96", P384_SIGNATURE_SIZE, toI32(96));

  // --- Crafted signatures: every digest length --------------------------------
  const keys: string[] = craftedP384Keys();
  for (const c of craftedP384Cases()) {
    const verified: boolean = p384Verify(fromHex(keys[toI32(c.key)]), fromHex(c.digest), fromHex(c.sig));
    t.ok(`${c.name} ${c.verifies ? "verifies" : "is refused"}`, verified === c.verifies);
  }

  // --- The message wrappers ------------------------------------------------------
  // Crafted case 0 signs SHA-384 of the message, case 2 its SHA-256.
  const cases: P384CraftedCase[] = craftedP384Cases();
  const pub: u8[] = fromHex(keys[0]);
  const message: u8[] = ascii("crafted message");
  const sig384: u8[] = fromHex(cases[0].sig);
  const sig256: u8[] = fromHex(cases[2].sig);
  t.ok("p384VerifySha384 verifies the SHA-384 signature", p384VerifySha384(pub, message, sig384));
  t.ok("and refuses the SHA-256 one", !p384VerifySha384(pub, message, sig256));
  t.ok("p384VerifySha256 verifies the SHA-256 signature", p384VerifySha256(pub, message, sig256));
  t.ok("and refuses the SHA-384 one", !p384VerifySha256(pub, message, sig384));
  t.ok("a signature of another message is refused", !p384VerifySha384(pub, ascii("crafted messagf"), sig384));
  t.ok("as is one under another key", !p384VerifySha384(fromHex(keys[1]), message, sig384));

  // --- The public key -------------------------------------------------------------
  const r: string = cases[0].sig.substring(0, 96);
  const s: string = cases[0].sig.substring(96, 192);
  const digest: u8[] = sha384(message);
  const x: string = keys[0].substring(2, 98);
  const y: string = keys[0].substring(98, 194);
  t.ok("the key split and joined verifies", p384Verify(fromHex(`04${x}${y}`), digest, sig384));
  t.ok("a 96-byte key is refused", !p384Verify(fromHex(`${x}${y}`), digest, sig384));
  t.ok("a 98-byte key is refused", !p384Verify(fromHex(`04${x}${y}00`), digest, sig384));
  t.ok("a 49-byte compressed key is refused", !p384Verify(fromHex(`02${x}`), digest, sig384));
  t.ok("an empty key is refused", !p384Verify([], digest, sig384));
  t.ok("prefix 02 on 97 bytes is refused", !p384Verify(fromHex(`02${x}${y}`), digest, sig384));
  t.ok("prefix 03 on 97 bytes is refused", !p384Verify(fromHex(`03${x}${y}`), digest, sig384));
  t.ok("prefix 00 on 97 bytes is refused", !p384Verify(fromHex(`00${x}${y}`), digest, sig384));
  const gSig: u8[] = fromHex(cases[7].sig);
  const gDigest: u8[] = fromHex(cases[7].digest);
  t.ok("G as a key verifies its crafted signature", p384Verify(fromHex(`04${GX}${GY}`), gDigest, gSig));
  t.ok("x = p is refused", !p384Verify(fromHex(`04${P}${GY}`), gDigest, gSig));
  t.ok("y = p is refused", !p384Verify(fromHex(`04${GX}${P}`), gDigest, gSig));
  t.ok("(Gx, Gy + 1), off the curve, is refused", !p384Verify(fromHex(`04${GX}${GY_PLUS_1}`), gDigest, gSig));
  t.ok("(0, 0), off the curve, is refused", !p384Verify(fromHex(`04${ZERO}${ZERO}`), gDigest, gSig));

  // --- The signature ----------------------------------------------------------------
  t.ok("the signature split and joined verifies", p384Verify(pub, digest, fromHex(`${r}${s}`)));
  t.ok("a 95-byte signature is refused", !p384Verify(pub, digest, fromHex(`${r}${s.substring(2, 96)}`)));
  t.ok("a 97-byte signature is refused", !p384Verify(pub, digest, fromHex(`${r}${s}00`)));
  t.ok("an empty signature is refused", !p384Verify(pub, digest, []));
  t.ok("r = 0 is refused", !p384Verify(pub, digest, fromHex(`${ZERO}${s}`)));
  t.ok("s = 0 is refused", !p384Verify(pub, digest, fromHex(`${r}${ZERO}`)));
  t.ok("r = n is refused", !p384Verify(pub, digest, fromHex(`${N}${s}`)));
  t.ok("s = n is refused", !p384Verify(pub, digest, fromHex(`${r}${N}`)));
  t.ok("r = p is refused", !p384Verify(pub, digest, fromHex(`${P}${s}`)));

  // --- NIST CAVP ----------------------------------------------------------------------
  t.ok("cavp SigVer: every case answers what the file expects", vectors(t, "cavp SigVer", cavpP384Keys(), cavpP384Cases(), false) === 0);

  // --- Wycheproof ---------------------------------------------------------------------
  const wpKeys: string[] = wycheproofP384Keys();
  t.ok("wycheproof ecdsa_secp384r1_sha384_p1363: every case answers what the file expects", vectors(t, "wycheproof ecdsa_secp384r1_sha384_p1363", wpKeys, wycheproofP384Sha384P1363(), false) === 0);
  t.ok("wycheproof ecdsa_secp384r1_sha256: every case answers what the file expects", vectors(t, "wycheproof ecdsa_secp384r1_sha256", wpKeys, wycheproofP384Sha256Der(), true) === 0);

  return t.done();
};
