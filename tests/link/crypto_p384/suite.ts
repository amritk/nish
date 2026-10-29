// `nish/crypto/p384` against RFC 6979 and Project Wycheproof: the key and the
// SHA-384 signatures of "sample" and "test" of RFC 6979 A.2.6, every case of
// Wycheproof's five secp384r1 ECDSA files this module can run (SHA-384 and
// SHA-512, each with DER and with P1363 `r || s` signatures, and SHA-256 with
// DER), and the refusals the module promises. The module only verifies, so the
// edge cases are signatures built here without a private key: for any key Q,
// pick u1 and u2, let R = u1 G + u2 Q, r = R.x mod n, s = r / u2 and z = u1 s,
// and (r, s) is a valid signature of the digest z. Each refusal below has such
// a signature that the check it pins is the only thing stopping.
// docs/security/crypto-p384.md is the audit these checks pin.
import { Suite } from "nish/testing";
import { sha256 } from "nish/crypto/sha256";
import { sha384, sha512 } from "nish/crypto/sha512";
import { P384_POINT_SIZE, P384_SCALAR_SIZE, P384_SIGNATURE_SIZE, p384Verify, p384VerifySha384 } from "nish/crypto/p384";
import {
  WycheproofEcdsaCase,
  wycheproofEcdsaP384Sha256Cases,
  wycheproofEcdsaP384Sha256Keys,
  wycheproofEcdsaP384Sha384Cases,
  wycheproofEcdsaP384Sha384Keys,
  wycheproofEcdsaP384Sha384P1363Cases,
  wycheproofEcdsaP384Sha512Cases,
  wycheproofEcdsaP384Sha512Keys,
  wycheproofEcdsaP384Sha512P1363Cases,
} from "../crypto_wycheproof_p384/ecdsa_secp384r1";
import { derSignatureRS384 } from "../crypto_wycheproof_p384/der";
import { fromHex, toHex } from "./hex";

/** The bytes of an ASCII string, for the RFC's messages. */
const ascii = (text: string): u8[] => {
  const out: u8[] = [];
  const length: i32 = toI32(text.length);
  for (let i: i32 = 0; i < length; i++) {
    out.push(toU8(toI32(text.charCodeAt(i))));
  }
  return out;
};

/** `bytes` with bit `bit` of byte `at` flipped, in a copy. */
const flip = (bytes: u8[], at: i32, bit: i32): u8[] => {
  const out: u8[] = [];
  const length: i32 = toI32(bytes.length);
  for (let i: i32 = 0; i < length; i++) {
    out.push(i === at ? bytes[i] ^ toU8(1 << bit) : bytes[i]);
  }
  return out;
};

/** The first `count` bytes of `bytes`, in a copy. */
const prefix = (bytes: u8[], count: i32): u8[] => {
  const out: u8[] = [];
  for (let i: i32 = 0; i < count && i < toI32(bytes.length); i++) {
    out.push(bytes[i]);
  }
  return out;
};

// RFC 6979 A.2.6: the public key and the SHA-384 signatures.
const UX: string = "ec3a4e415b4e19a4568618029f427fa5da9a8bc4ae92e02e06aae5286b300c64def8f0ea9055866064a254515480bc13";
const UY: string = "8015d9b72d7d57244ea8ef9ac0c621896708a59367f9dfb9f54ca84b3f1c9db1288b231c3ae0d4fe7344fd2533264720";
const SAMPLE_R: string = "94edbb92a5ecb8aad4736e56c691916b3f88140666ce9fa73d64c4ea95ad133c81a648152e44acf96e36dd1e80fabe46";
const SAMPLE_S: string = "99ef4aeb15f178cea1fe40db2603138f130e740a19624526203b6351d0a3a94fa329c145786e679e7b82c71a38628ac8";
const TEST_R: string = "8203b63d3c853e8d77227fb377bcf7b7b772e97892a80f36ab775d509d7a5feb0542a7f0812998da8f1dd3ca3cf023db";
const TEST_S: string = "ddd0760448d42d8a43af45af836fce4de8be06b485e9b61b827c2f13173923e06a739f040649a667bf3b828246baa5a5";
// n - SAMPLE_S: the other half of the malleable pair.
const SAMPLE_HIGH_S: string =
  "6610b514ea0e87315e01bf24d9fcec70ecf18bf5e69dbad9a727ea302393848fb4f04c6cd0423fdc7169525094629eab";

// The group order n and the field prime p (SEC 2 §2.5.1), and G.
const N: string = "ffffffffffffffffffffffffffffffffffffffffffffffffc7634d81f4372ddf581a0db248b0a77aecec196accc52973";
const P: string = "fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffeffffffff0000000000000000ffffffff";
const ZERO: string = "000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
const ONE: string = "000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001";
const GX: string = "aa87ca22be8b05378eb1c71ef320ad746e1d3b628ba79b9859f741e082542a385502f25dbf55296c3a545e3872760ab7";
const GY: string = "3617de4a96262c6f5d9e98bf9292dc29f8f41dbd289a147ce9da3113b5f0b8c00a60b1ce1d7e819d7a431d7c90ea0e5f";

// The curve point with x = 0, and x + p, which is 48 bytes and names the same
// x mod p. With u1 = u2 = 1, r = s = z = (G + Q).x mod n.
const X0_Y: string = "c306610fb0ae5a159cf45c06069f22a6c5eb3641c602d42dea2c4b4f75550793406d80d2b91ad54f9048bd487af1ade1";
const X0_PLUS_P: string = P;
const X0_R: string = "cfec927eb7b623c541c5319b86d74e666df77a796e312f830456ac988730315d8c4d967297562deec5745ffe5c7339e6";
// The curve point with y = 1, and y + p. The same construction.
const Y1_X: string = "2261b2bf605c22f2f3aef6338719b2c486388ad5240719a5257315969ef01ba27f0a104c89704773a81fdabee6ab5c78";
const Y1_PLUS_P: string = "fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffeffffffff000000000000000100000000";
const Y1_R: string = "3cfdf8538f1c78b245aad1b37bb50fac14223a4b9172278c5234a1d17c27202108083c7618dff8a64515f3f3049e552a";
// (Gx, Gy + 1), not on the curve. With u1 = 0 and u2 = 1, r = s = Gx and z = 0.
const OFF_Y: string = "3617de4a96262c6f5d9e98bf9292dc29f8f41dbd289a147ce9da3113b5f0b8c00a60b1ce1d7e819d7a431d7c90ea0e60";
// Q = G and s = 1: (S1_R, 1) signs the digest S1_Z. 1 + n names the same s mod n.
const S1_R: string = "fbf96095915eb587390f850ec95b35f618ae121c72a70808ad8f9f4c261b602b63541743e395f7c778e52bb28c18dc83";
const S1_Z: string = "04069f6a6ea14a78c6f07af136a4ca09e751ede38d58f7f719d3ae35ce1bcdb3f4c5f66e651aafb3863b4430d1581adf";
const ONE_PLUS_N: string = "ffffffffffffffffffffffffffffffffffffffffffffffffc7634d81f4372ddf581a0db248b0a77aecec196accc52974";
// Under the A.2.6 key, (Z5_R, Z5_S) signs the digest 5; Z5_PLUS_N is 5 + n, a
// 48-byte digest that is the same scalar.
const Z5_R: string = "ced4e56dee1285a6f34fbda6d26fb50edfff23f300d47af172cd3fb71bd8f7d531f1a001c73637da306e8b0b21860e6a";
const Z5_S: string = "b39b620a1ef71a874dca3d6c8b57bdb9b3745c175b0ef10304366d48ca867346dc12c3ab921528c46c5192e5b8f39323";
const Z5_PLUS_N: string = "ffffffffffffffffffffffffffffffffffffffffffffffffc7634d81f4372ddf581a0db248b0a77aecec196accc52978";
const FIVE: string = "000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000005";
// n - 1: with Q = G and r = s = 1, u1 G + u2 Q = (n - 1 + 1) G, the identity.
const N_MINUS_1: string = "ffffffffffffffffffffffffffffffffffffffffffffffffc7634d81f4372ddf581a0db248b0a77aecec196accc52972";

/**
 * Every case of one Wycheproof file through `p384Verify`, checked against its
 * expected result: the message hashed with `hash` ("sha256", "sha384" or
 * "sha512"), and the signature read by `derSignatureRS384` when `der` is set
 * and handed over as it is (P1363's `r || s`) otherwise. `valid` must verify
 * and `invalid` must not; `acceptable` may go either way and is only counted.
 * A mismatch is named by its file and `tcId`. Answers the number of mismatches.
 */
const wycheproof = (
  t: Suite,
  file: string,
  keys: string[],
  cases: WycheproofEcdsaCase[],
  hash: string,
  der: boolean
): i32 => {
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
      t.fail(`wycheproof ${file} tcId ${c.tcId}`, "no such key");
      mismatches += 1;
      continue;
    }
    const pub: u8[] = fromHex(keys[keyAt]);
    const sig: u8[] | null = der ? derSignatureRS384(fromHex(c.sig)) : fromHex(c.sig);
    const msg: u8[] = fromHex(c.msg);
    const digest: u8[] = hash === "sha256" ? sha256(msg) : hash === "sha512" ? sha512(msg) : sha384(msg);
    const verified: boolean = sig !== null && p384Verify(pub, digest, sig);
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
    ? `${invalidByDer} by derSignatureRS384, ${invalidByModule} by p384Verify`
    : `all ${invalidByModule} by p384Verify`;
  console.log(
    `wycheproof ${file}: ${toI32(cases.length)} cases, ${valid} valid verified, ${invalidByDer + invalidByModule} invalid refused (${refusedBy}), ${acceptableTrue + acceptableFalse} acceptable (${acceptableTrue} verified, ${acceptableFalse} refused), 0 filtered out`
  );
  return mismatches;
};

export const runSuite = (): i32 => {
  const t = new Suite("p384");

  t.eqI32("P384_SCALAR_SIZE is 48 bytes", P384_SCALAR_SIZE, toI32(48));
  t.eqI32("P384_POINT_SIZE is 97 bytes", P384_POINT_SIZE, toI32(97));
  t.eqI32("P384_SIGNATURE_SIZE is 96 bytes", P384_SIGNATURE_SIZE, toI32(96));

  // --- RFC 6979 A.2.6 ---------------------------------------------------------
  const pub: u8[] = fromHex(`04${UX}${UY}`);
  const sample: u8[] = ascii("sample");
  const test: u8[] = ascii("test");
  const sampleSig: u8[] = fromHex(`${SAMPLE_R}${SAMPLE_S}`);
  const testSig: u8[] = fromHex(`${TEST_R}${TEST_S}`);
  t.ok("A.2.6 SHA-384 \"sample\" verifies", p384VerifySha384(pub, sample, sampleSig));
  t.ok("A.2.6 SHA-384 \"test\" verifies", p384VerifySha384(pub, test, testSig));
  t.ok("p384Verify of the SHA-384 verifies", p384Verify(pub, sha384(test), testSig));
  t.ok("\"sample\"'s signature does not verify \"test\"", !p384VerifySha384(pub, test, sampleSig));
  t.ok("a flipped bit in r is refused", !p384VerifySha384(pub, sample, flip(sampleSig, 5, 3)));
  t.ok("a flipped bit in s is refused", !p384VerifySha384(pub, sample, flip(sampleSig, 90, 0)));
  t.ok("a flipped bit in the message is refused", !p384VerifySha384(pub, flip(sample, 0, 0), sampleSig));
  t.ok("a flipped bit in the key is refused", !p384VerifySha384(flip(pub, 40, 2), sample, sampleSig));
  t.ok("another key does not verify it", !p384VerifySha384(fromHex(`04${GX}${GY}`), sample, sampleSig));
  t.ok("(r, n - s) verifies too: ECDSA is malleable", p384VerifySha384(pub, sample, fromHex(`${SAMPLE_R}${SAMPLE_HIGH_S}`)));

  // --- The digest: its leftmost 384 bits, then mod n --------------------------
  // A 64-byte digest is its first 48 bytes, and a shorter one is its own value.
  const z5: u8[] = fromHex(`${Z5_R}${Z5_S}`);
  t.ok("the digest 5 verifies", p384Verify(pub, fromHex(FIVE), z5));
  t.ok("a 1-byte digest is its own value", p384Verify(pub, fromHex("05"), z5));
  t.ok("a 64-byte digest is its leftmost 48 bytes", p384Verify(pub, fromHex(`${FIVE}${GX.substring(0, 32)}`), z5));
  t.ok("a 48-byte digest of 5 + n is 5", p384Verify(pub, fromHex(Z5_PLUS_N), z5));
  t.ok("an empty digest is 0, not 5", !p384Verify(pub, [], z5));
  t.ok("the digest 4 is refused", !p384Verify(pub, fromHex("04"), z5));

  // --- Signatures: 96 bytes, r and s in [1, n) --------------------------------
  const g: u8[] = fromHex(`04${GX}${GY}`);
  t.ok("(r, 1) under G verifies", p384Verify(g, fromHex(S1_Z), fromHex(`${S1_R}${ONE}`)));
  t.ok("(r, 1 + n) is refused", !p384Verify(g, fromHex(S1_Z), fromHex(`${S1_R}${ONE_PLUS_N}`)));
  t.ok("s = 0 is refused", !p384Verify(g, fromHex(S1_Z), fromHex(`${S1_R}${ZERO}`)));
  t.ok("s = n is refused", !p384Verify(g, fromHex(S1_Z), fromHex(`${S1_R}${N}`)));
  t.ok("r = 0 is refused", !p384Verify(g, fromHex(S1_Z), fromHex(`${ZERO}${ONE}`)));
  t.ok("r = n is refused", !p384Verify(g, fromHex(S1_Z), fromHex(`${N}${ONE}`)));
  t.ok("a 95-byte signature is refused", !p384Verify(pub, sha384(sample), prefix(sampleSig, 95)));
  t.ok("a 97-byte signature is refused", !p384Verify(pub, sha384(sample), fromHex(`${SAMPLE_R}${SAMPLE_S}00`)));
  t.ok("an empty signature is refused", !p384Verify(pub, sha384(sample), []));
  t.ok("a sum u1 G + u2 Q of the identity is refused", !p384Verify(g, fromHex(N_MINUS_1), fromHex(`${ONE}${ONE}`)));
  // r = 0 and the digest 0: the sum is the identity, whose x the inversion of
  // zero reads as 0, equal to r. Only the range check and the identity check
  // together stand between this and a forgery; each alone refuses it.
  t.ok("r = 0 over the digest 0 is refused", !p384Verify(g, fromHex(ZERO), fromHex(`${ZERO}${ONE}`)));

  // --- Keys: 97 bytes, 0x04, both coordinates below p, on the curve -----------
  const x0: u8[] = fromHex(`04${ZERO}${X0_Y}`);
  const x0Sig: u8[] = fromHex(`${X0_R}${X0_R}`);
  t.ok("the point with x = 0 verifies", p384Verify(x0, fromHex(X0_R), x0Sig));
  t.ok("and with x = p is refused", !p384Verify(fromHex(`04${X0_PLUS_P}${X0_Y}`), fromHex(X0_R), x0Sig));
  const y1Sig: u8[] = fromHex(`${Y1_R}${Y1_R}`);
  t.ok("the point with y = 1 verifies", p384Verify(fromHex(`04${Y1_X}${ONE}`), fromHex(Y1_R), y1Sig));
  t.ok("and with y = 1 + p is refused", !p384Verify(fromHex(`04${Y1_X}${Y1_PLUS_P}`), fromHex(Y1_R), y1Sig));
  t.ok("(Gx, Gy + 1), off the curve, is refused", !p384Verify(fromHex(`04${GX}${OFF_Y}`), fromHex(ZERO), fromHex(`${GX}${GX}`)));
  t.ok("and on G itself the same signature verifies", p384Verify(g, fromHex(ZERO), fromHex(`${GX}${GX}`)));
  t.ok("a key of 96 bytes is refused", !p384VerifySha384(prefix(pub, 96), sample, sampleSig));
  t.ok("a key of 98 bytes is refused", !p384VerifySha384(fromHex(`04${UX}${UY}00`), sample, sampleSig));
  t.ok("a compressed prefix 0x02 is refused", !p384VerifySha384(fromHex(`02${UX}${UY}`), sample, sampleSig));
  t.ok("a hybrid prefix 0x06 is refused", !p384VerifySha384(fromHex(`06${UX}${UY}`), sample, sampleSig));
  t.ok("the identity's 0x00 is refused", !p384VerifySha384([0], sample, sampleSig));
  t.ok("(0, 0) is refused", !p384VerifySha384(fromHex(`04${ZERO}${ZERO}`), sample, sampleSig));

  // --- Wycheproof -------------------------------------------------------------
  const keys256: string[] = wycheproofEcdsaP384Sha256Keys();
  const keys384: string[] = wycheproofEcdsaP384Sha384Keys();
  const keys512: string[] = wycheproofEcdsaP384Sha512Keys();
  t.eqI32(
    "wycheproof sha384: every case answers what the file expects",
    wycheproof(t, "ecdsa_secp384r1_sha384", keys384, wycheproofEcdsaP384Sha384Cases(), "sha384", true),
    toI32(0)
  );
  t.eqI32(
    "wycheproof sha384_p1363: every case answers what the file expects",
    wycheproof(t, "ecdsa_secp384r1_sha384_p1363", keys384, wycheproofEcdsaP384Sha384P1363Cases(), "sha384", false),
    toI32(0)
  );
  // A SHA-256 digest is shorter than n, so it is its own value; a SHA-512
  // digest is cut to its leftmost 384 bits. These files check both.
  t.eqI32(
    "wycheproof sha256: every case answers what the file expects",
    wycheproof(t, "ecdsa_secp384r1_sha256", keys256, wycheproofEcdsaP384Sha256Cases(), "sha256", true),
    toI32(0)
  );
  t.eqI32(
    "wycheproof sha512: every case answers what the file expects",
    wycheproof(t, "ecdsa_secp384r1_sha512", keys512, wycheproofEcdsaP384Sha512Cases(), "sha512", true),
    toI32(0)
  );
  t.eqI32(
    "wycheproof sha512_p1363: every case answers what the file expects",
    wycheproof(t, "ecdsa_secp384r1_sha512_p1363", keys512, wycheproofEcdsaP384Sha512P1363Cases(), "sha512", false),
    toI32(0)
  );

  t.eqStr("the hex helper round-trips", toHex(fromHex(GX)), GX);
  return t.done();
};
