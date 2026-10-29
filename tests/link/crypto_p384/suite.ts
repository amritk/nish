// `nish/crypto/p384` against RFC 6979, Project Wycheproof and NIST CAVP: the
// public key of RFC 6979 A.2.6 and its deterministic SHA-384 signatures of
// "sample" and "test", every case of Wycheproof's
// ecdsa_secp384r1_sha384_p1363_test.json and of CAVP SigVer's [P-384,SHA-384],
// the refusals the module promises (public keys off the curve, with a
// coordinate of p or more, the identity, compressed or the wrong length; an `r`
// or `s` of 0 or n or more; signatures of 95 or 97 bytes; a sum u1 G + u2 Q
// that is the identity), the digest's truncation and reduction, and a self-check
// that the joint multiply u1 G + u2 Q equals the two products added apart. The
// values not printed by a standard were computed with Python's integers.
// docs/security/crypto-ecc.md is the audit these checks pin.
//
// The suite is a function rather than `main` so that `crypto_p384_f64` can run
// the same checks with `--number-mode f64`.
import { Suite } from "nish/testing";
import { sha384 } from "nish/crypto/sha512";
import {
  P384_POINT_SIZE,
  P384_SCALAR_SIZE,
  P384_SIGNATURE_SIZE,
  p384MulAdd,
  p384PointAdd,
  p384Verify,
  p384VerifySha384,
} from "nish/crypto/p384";
import { WycheproofEcdsaCase } from "../crypto_wycheproof/ecdsa_secp256r1_sha256";
import {
  wycheproofEcdsaP384Sha384Keys,
  wycheproofEcdsaP384Sha384P1363Cases,
} from "../crypto_wycheproof/ecdsa_secp384r1_sha384_p1363";
import { CavpEcdsaCase, cavpEcdsaP384Sha384Cases } from "../crypto_cavp_p384/sigver";
import { fromHex, toHex } from "../crypto_p256/hex";

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
  for (let i: i32 = 0; i < length && i < toI32(bytes.length); i++) {
    out.push(i === at ? bytes[i] ^ toU8(1 << bit) : bytes[i]);
  }
  return out;
};

// RFC 6979 A.2.6: the key pair and its SHA-384 signatures.
const UX: string = "ec3a4e415b4e19a4568618029f427fa5da9a8bc4ae92e02e06aae5286b300c64def8f0ea9055866064a254515480bc13";
const UY: string = "8015d9b72d7d57244ea8ef9ac0c621896708a59367f9dfb9f54ca84b3f1c9db1288b231c3ae0d4fe7344fd2533264720";
const SAMPLE_R: string = "94edbb92a5ecb8aad4736e56c691916b3f88140666ce9fa73d64c4ea95ad133c81a648152e44acf96e36dd1e80fabe46";
const SAMPLE_S: string = "99ef4aeb15f178cea1fe40db2603138f130e740a19624526203b6351d0a3a94fa329c145786e679e7b82c71a38628ac8";
const SAMPLE_HIGH_S: string = "6610b514ea0e87315e01bf24d9fcec70ecf18bf5e69dbad9a727ea302393848fb4f04c6cd0423fdc7169525094629eab";
const TEST_R: string = "8203b63d3c853e8d77227fb377bcf7b7b772e97892a80f36ab775d509d7a5feb0542a7f0812998da8f1dd3ca3cf023db";
const TEST_S: string = "ddd0760448d42d8a43af45af836fce4de8be06b485e9b61b827c2f13173923e06a739f040649a667bf3b828246baa5a5";

// The group order n and the field prime p (SEC 2 §2.5.1), for the edges.
const N: string = "ffffffffffffffffffffffffffffffffffffffffffffffffc7634d81f4372ddf581a0db248b0a77aecec196accc52973";
const N_MINUS_1: string = "ffffffffffffffffffffffffffffffffffffffffffffffffc7634d81f4372ddf581a0db248b0a77aecec196accc52972";
const N_PLUS_1: string = "ffffffffffffffffffffffffffffffffffffffffffffffffc7634d81f4372ddf581a0db248b0a77aecec196accc52974";
const N_PLUS_5: string = "ffffffffffffffffffffffffffffffffffffffffffffffffc7634d81f4372ddf581a0db248b0a77aecec196accc52978";
const P: string = "fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffeffffffff0000000000000000ffffffff";
const ZERO: string = "000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
const ONE: string = "000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001";
const TWO: string = "000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002";
const FIVE: string = "000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000005";
// G, -G = (n - 1) G, which has G's x and p - y, and 2G.
const GX: string = "aa87ca22be8b05378eb1c71ef320ad746e1d3b628ba79b9859f741e082542a385502f25dbf55296c3a545e3872760ab7";
const GY: string = "3617de4a96262c6f5d9e98bf9292dc29f8f41dbd289a147ce9da3113b5f0b8c00a60b1ce1d7e819d7a431d7c90ea0e5f";
const NEG_GY: string = "c9e821b569d9d390a26167406d6d23d6070be242d765eb831625ceec4a0f473ef59f4e30e2817e6285bce2846f15f1a0";
const TWO_G: string =
  "0408d999057ba3d2d969260045c55b97f089025959a6f434d651d207d19fb96e9e4fe0e86ebe0e64f85b96a9c75295df618e80f1fa5b1b3cedb7bfe8dffd6dba74b275d875bc6cc43e904e505f256ab4255ffd43e94d39e22d61501e700a940e80";

// The point (2, y), whose x is small enough that x + p still fits in 48 bytes,
// and a signature that verifies under it, made without its private key: R =
// a G + b Q for a = 12345 and b = 67890, r = x(R), s = r / b, digest a s.
const SMALL_Y: string = "8cdeadbbd04911a3c1931e26df3fa6439dca9c7eb286fbd46fc319f0e2bb780232baf57825fc0c1912ada2fefe84024c";
const TWO_PLUS_P: string = "fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffeffffffff000000000000000100000001";
const SMALL_DIGEST: string = "7ef9b45c8dfa613e970dc6af6b930fc74b4b89c1ec80cbc634f0845dcf55dcc22ad6dcc04dd7d17f9775df345d3cb19e";
const SMALL_SIG: string =
  "6e141ff4e816982f757343b704a120f591034358cf9198f0184daf556a47acfa1a0152517aa652f8761b5aa74fe2f7ed81a35ddef3d6bb8df8b6779b70676d938a4806b591c2810ae50f370f211e4fbbd83c333f6a7838994a70f203519c1427";

// Signatures under the key G, so that u1 G + u2 Q is (u1 + u2) G: for a nonce
// k, r = x(k G) mod n and s = (e + r) / k. DOUBLE has e = r, so u1 G = u2 Q and
// the sum is a doubling; the others sign the digests 0x0102, 0 and 5.
const DOUBLE_SIG: string =
  "7ae9e1db1160794c70c1ef071be5191f6c66240f4608fbe8a44ecd36c3ed5db97500f2e4d84e3fb45850fd6f4303302b38d5765fec03f66b1974b0fd3d0dd230e43e82586d16fea49f17af5c36f745be9bae532011a7b02c7eab83aa683adc4b";
const DOUBLE_DIGEST: string = "7ae9e1db1160794c70c1ef071be5191f6c66240f4608fbe8a44ecd36c3ed5db97500f2e4d84e3fb45850fd6f4303302b";
const SHORT_SIG: string =
  "8aac1db4c5951f63215f8d4b8f60f0adcb5efbc4a63c4c6a758da16cce83df1f0cbeb7979825569755afb3b7f3197bed41a2e050d18ee31e6866654d55685a36f69296068f38d23e8ffb7f4309518ba5f63049febf0f8e35508cb48005ee8d39";
const ZERO_SIG: string =
  "69f28e0d906c7a717d4282301d26f0595d4b401f266e0a91f209845aaee960b8b5c8e1aa4c25760f865d37c75239a7350e7f3902fd3768952a33d095e349794f341f41e170506a64db9116daa5e6f34ee32994083846d0fec34a7d744011a8df";
const FIVE_SIG: string =
  "6e886bff9173f450fe7311a8f73554fa4ae37f178aef334a2c360a7dd5d891435b5e439d556a5375f276607849a2db2ac7e9dc2314b647c84061c6b452e4da1a495f55fddceb161582ae5249c2e834033d98defe8c21185b5422b89d3460ce09";

/** One joint-multiply check: the scalars, then u1 G + u2 Q, u1 G and u2 Q, each as Python computed it, for Q the A.2.6 key. */
interface MulAddCase {
  u1: string;
  u2: string;
  sum: string;
  left: string;
  right: string;
}

const mulAddCases = (): MulAddCase[] => [
  {
    u1: "a26a7bfcf51a7b45065ccd08ef9cfe25c46f8780bdb24532883f678ac85d3e870c4705de623958a8d7e77b64a4ff0d2e",
    u2: "0e128a2948ab7279f209d61c612a948b3b9acd1c8eeed390b2edd3491fb3ce3a3f28b6f47068ce063e421b4c5fc36774",
    sum: "0465f8067d7385c5b508afa0e1fbe5e67db4d6d8404b4032500ad39f884cca276c6b52cb536d1dabb3fcf65f83d816c389c749ba20ccffdef16b69a5a1e01b0dbb93cafedbf653944b6d6934df9881b7d275af16e54facc2b87863f54c1719bc35",
    left: "04f588e0a52e54615d0fc296af27e7fb64e020f54e8f474201cda82c55567ac3a3efd4995e94bc9f111242e55cd08ce89c77e94a8a81b0230ca64a2ef719bf3d4766f2abd133656876d392f47fd2f57dcb8bcc1511eee3fe1d3e68cc7b2673c460",
    right: "04569bcdd93d6408551ae85a59e155b1c9585a636dfa52e3db39d995947c699923619311c0adac42529b5a1ee685f61575678790a49a832a42175bb4fb9fd72a56088b8dc9ad67f4a420d2269e013b35206a4ee9cfacf57f9cf4e23fbec54cd07f",
  },
  {
    u1: "94f7b3f7b62f1e12bada78d09420ddf2b93d6dfcace2007248f85dcbd4d9c5252eb1616a726c1f5464d4af1422db91d0",
    u2: "913dff386f0ee379e7dccbeb67235e51e011b7627c43365b7e6c6b03dee43ed7651afd26eadeada66e7cdc0ca2446907",
    sum: "04e76f88ca845c0f3347c7c3035ee0c690c3879e93ce6a6ab9dab67cb215370bb6bd45d25e0b728825597c38c604a589fdb191d41e6d17a6f4cb9c2290af7debb65cbff50ef8f5012925a6e47bc90d8611a5c2d622c889293450a809513a07e4f1",
    left: "0478e3e07f793dc65562193c41674ee8364bbe884e4c22c4361730f80c799ff5a8ed64160224eb63ee12ae42f62c176691a50f553b3c37b50b3e8e2c78338e1367a819c343c4f0dd44c66fb359b8ead04f9d85445cb9a353cc5f41996328123e12",
    right: "047b015f89983edc28fd0ee07ba3181c4c28c99fca193288a4572023554a595ed9f601fc778dace7358e920dd35e93ec9b201a478f1f2997b5cc69b72cc3fa715255dc20d7022498309084ca08faae57424c0c74ec6af075fefd5d31bcc5ba1096",
  },
  {
    u1: "7ff52902fba8a814f0efbca52febd01bf0b991c8bb99f33d4b5009f5332ba39f40e17ad5477b446567baf4d09af211b3",
    u2: "75c036c89d32fae05516fd2b3b016b21c2905f8fb0493662cca49f64e352aa3a71fb0c7372a559092d5e298ae1105f67",
    sum: "040567297ec2fccedd7a87aee3b8685509723045a8d32561a1d6101e8ab1192761db15fd21996c354c617873d859a11fabea54d0054ffe0aa768b0ff095e2e5844084f299d40fa4a566c0e2b6a80cd4504d1e39b0eeca1336c8e52b1430309e84f",
    left: "0460ea5efedb4c5137fbe26e75635d18d49f5b26ab936eca10027dd9b2424d75c169ed369b249bee85b19d24c3f1fbcb8d2db6ae11aa403764b6e31c51a48e34f3ace146fab0fd894156b4690d53c267faf3dc12ff615a5fadbe7c48a27e05cb2d",
    right: "04b0660db5fa40d322c7979eb84911cfd50b723b523a96766507a1962dc3ce62fb8e8a31b1815b39d4988a9243da3e060848233eef836788e1d80e9c2ecdccea6f93be48b320b91f5b6b5f05ed1b08c05bba07227ec8d2d8d4cb0c2a7317d3df4e",
  },
  {
    u1: "06577990b4e9148598d8ce68df7bb3739d20dba64c059ae00cf80bb1bc8d2a944ebb6703455b14d9902214f6655e23ad",
    u2: "07407f1ae4abfa18a2fe068b3b133f2b3cf1db95283e7d89e859899053c54f0e41c688ccf897b86fe8ea44dc7690b757",
    sum: "0471f20bb954080ea04dae64b4220510dd539cd651f5c393d2958908224b47ecf6bbf393170bc73eb9c8e2486f509b694e48618f61623a3f7cb0e62de4abcbcf633c930f8b2251a0b2b9d46db0930ccc0fa148dda88c173ac35181599e8b529a2f",
    left: "0410fe0f23e2b8c8abfdd344b010dbc83de21228739deee01ebe0b11233e831cfcadd5224131dcc5d5615e52fe06318998228a3853b8d1dff94533088e94f541127b4a247c9aabe6b17c571630fd360eadb7d96fa76f8152ce8b4df5a18e08334c",
    right: "04d8173b6ce31e09ff65268e444cf609636e8a12989c8cddd03e711430b9d7db11c28932ea7d7cc212b3db253587802ee93d457b176bf08c87cf2cf9a48c95d9c533526ae280d7936126dede3832db45cc9df862fe62815d736a9e7b7f38f79319",
  },
];

/**
 * Every case of the Wycheproof file through `p384Verify` of the message's
 * SHA-384, its P1363 signature handed over as it is, checked against its
 * expected result: `valid` must verify and `invalid` must not. The file has no
 * `acceptable` case; one would be counted as a mismatch, since this module
 * refuses every case that file marks so (docs/security/crypto-ecc.md). A
 * mismatch is named by its `tcId`. Answers the number of mismatches.
 */
const wycheproof = (t: Suite, keys: string[], cases: WycheproofEcdsaCase[]): i32 => {
  let valid: i32 = 0;
  let invalid: i32 = 0;
  let mismatches: i32 = 0;
  for (const c of cases) {
    const keyAt: i32 = toI32(c.key);
    if (keyAt < 0 || keyAt >= toI32(keys.length)) {
      t.fail(`wycheproof tcId ${c.tcId}`, "no such key");
      mismatches += 1;
      continue;
    }
    const verified: boolean = p384VerifySha384(fromHex(keys[keyAt]), fromHex(c.msg), fromHex(c.sig));
    if (c.result === "valid" && verified) {
      valid += 1;
    } else if (c.result === "invalid" && !verified) {
      invalid += 1;
    } else {
      t.fail(`wycheproof tcId ${c.tcId}`, `a ${c.result} signature ${verified ? "verified" : "did not verify"}`);
      mismatches += 1;
    }
  }
  console.log(
    `wycheproof ecdsa_secp384r1_sha384_p1363: ${toI32(cases.length)} cases, ${valid} valid verified, ${invalid} invalid refused, 0 acceptable, 0 filtered out`
  );
  return mismatches;
};

/** Every CAVP SigVer case through `p384VerifySha384`, against its P or F. Answers the number of mismatches. */
const cavp = (t: Suite, cases: CavpEcdsaCase[]): i32 => {
  let passed: i32 = 0;
  let failed: i32 = 0;
  let mismatches: i32 = 0;
  let at: i32 = 0;
  for (const c of cases) {
    const verified: boolean = p384VerifySha384(fromHex(c.key), fromHex(c.msg), fromHex(c.sig));
    if (verified === c.pass) {
      if (verified) {
        passed += 1;
      } else {
        failed += 1;
      }
    } else {
      t.fail(`cavp SigVer [P-384,SHA-384] case ${at}`, `expected ${c.pass ? "P" : "F"} ${c.why}`);
      mismatches += 1;
    }
    at += 1;
  }
  console.log(`cavp SigVer [P-384,SHA-384]: ${toI32(cases.length)} cases, ${passed} P verified, ${failed} F refused`);
  return mismatches;
};

export const runSuite = (): i32 => {
  const t = new Suite("p384");

  t.eqI32("P384_SCALAR_SIZE is 48 bytes", P384_SCALAR_SIZE, toI32(48));
  t.eqI32("P384_POINT_SIZE is 97 bytes", P384_POINT_SIZE, toI32(97));
  t.eqI32("P384_SIGNATURE_SIZE is 96 bytes", P384_SIGNATURE_SIZE, toI32(96));

  // --- RFC 6979 A.2.6: SHA-384 signatures of "sample" and "test" ------------
  const pub: u8[] = fromHex(`04${UX}${UY}`);
  const g: u8[] = fromHex(`04${GX}${GY}`);
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
  t.ok("another key does not verify it", !p384VerifySha384(g, sample, sampleSig));
  t.ok(
    "(r, n - s) of \"sample\" verifies as well: ECDSA is malleable",
    p384VerifySha384(pub, sample, fromHex(`${SAMPLE_R}${SAMPLE_HIGH_S}`))
  );

  // --- Wycheproof and CAVP ----------------------------------------------------
  t.eqI32(
    "wycheproof sha384_p1363: every case answers what the file expects",
    wycheproof(t, wycheproofEcdsaP384Sha384Keys(), wycheproofEcdsaP384Sha384P1363Cases()),
    toI32(0)
  );
  t.eqI32("cavp SigVer: every case answers what the file expects", cavp(t, cavpEcdsaP384Sha384Cases()), toI32(0));

  // --- Public keys: 0x04, both coordinates below p, on the curve ------------
  t.ok("a key with a flipped bit in y is off the curve", !p384VerifySha384(flip(pub, 96, 0), sample, sampleSig));
  t.ok("a key with a flipped bit in x is off the curve", !p384VerifySha384(flip(pub, 1, 0), sample, sampleSig));
  t.ok("a key with prefix 0x03 is refused", !p384VerifySha384(fromHex(`03${UX}${UY}`), sample, sampleSig));
  t.ok("a compressed key, 0x03 then x, is refused", !p384VerifySha384(fromHex(`03${UX}`), sample, sampleSig));
  t.ok("the identity's SEC 1 encoding, 0x00, is refused", !p384VerifySha384(fromHex("00"), sample, sampleSig));
  t.ok("97 zero bytes are refused", !p384VerifySha384(new Array<u8>(97), sample, sampleSig));
  t.ok("0x04 then (0, 0) is refused", !p384VerifySha384(fromHex(`04${ZERO}${ZERO}`), sample, sampleSig));
  t.ok("a 96-byte key is refused", !p384VerifySha384(fromHex(`${UX}${UY}`), sample, sampleSig));
  t.ok("a 98-byte key is refused", !p384VerifySha384(fromHex(`04${UX}${UY}00`), sample, sampleSig));
  const smallDigest: u8[] = fromHex(SMALL_DIGEST);
  const smallSig: u8[] = fromHex(SMALL_SIG);
  t.ok("the point (2, y) verifies its signature", p384Verify(fromHex(`04${TWO}${SMALL_Y}`), smallDigest, smallSig));
  t.ok("the same point with x = 2 + p is refused", !p384Verify(fromHex(`04${TWO_PLUS_P}${SMALL_Y}`), smallDigest, smallSig));
  t.ok("a key with x = p is refused", !p384VerifySha384(fromHex(`04${P}${UY}`), sample, sampleSig));
  t.ok("a key with y = p is refused", !p384VerifySha384(fromHex(`04${UX}${P}`), sample, sampleSig));

  // --- Signatures: r and s in [1, n), and 96 bytes --------------------------
  t.ok("r = 0 is refused", !p384VerifySha384(pub, sample, fromHex(`${ZERO}${SAMPLE_S}`)));
  t.ok("s = 0 is refused", !p384VerifySha384(pub, sample, fromHex(`${SAMPLE_R}${ZERO}`)));
  t.ok("r = n is refused", !p384VerifySha384(pub, sample, fromHex(`${N}${SAMPLE_S}`)));
  t.ok("s = n is refused", !p384VerifySha384(pub, sample, fromHex(`${SAMPLE_R}${N}`)));
  t.ok("r = n + 1 is refused", !p384VerifySha384(pub, sample, fromHex(`${N_PLUS_1}${SAMPLE_S}`)));
  t.ok("s = n + 1 is refused", !p384VerifySha384(pub, sample, fromHex(`${SAMPLE_R}${N_PLUS_1}`)));
  t.ok("a 95-byte signature is refused", !p384VerifySha384(pub, sample, fromHex(`${SAMPLE_R}${SAMPLE_S.substring(2)}`)));
  t.ok("a 97-byte signature is refused", !p384VerifySha384(pub, sample, fromHex(`${SAMPLE_R}${SAMPLE_S}00`)));

  // --- The sum u1 G + u2 Q, under the key G ---------------------------------
  // With Q = G, a digest of n - 1 and r = s = 1, u1 + u2 = n: the sum is the
  // identity, which has no x, so the signature is refused.
  t.ok("a sum u1 G + u2 Q at the identity is refused", !p384Verify(g, fromHex(N_MINUS_1), fromHex(`${ONE}${ONE}`)));
  t.ok(
    "a signature whose u1 G equals u2 Q (the sum is a doubling) verifies",
    p384Verify(g, fromHex(DOUBLE_DIGEST), fromHex(DOUBLE_SIG))
  );

  // --- The digest: its leftmost 384 bits, then mod n ------------------------
  const longDigest: u8[] = fromHex(`${DOUBLE_DIGEST}0102030405060708090a0b0c0d0e0f10`);
  t.ok("a 64-byte digest verifies as its leftmost 48 bytes", p384Verify(g, longDigest, fromHex(DOUBLE_SIG)));
  t.ok("a 2-byte digest is the value 0x0102", p384Verify(g, fromHex("0102"), fromHex(SHORT_SIG)));
  t.ok("and so is the same value in 48 bytes", p384Verify(g, fromHex(`${ZERO.substring(4)}0102`), fromHex(SHORT_SIG)));
  t.ok("the signature of the digest 0 verifies (u1 = 0)", p384Verify(g, fromHex(ZERO), fromHex(ZERO_SIG)));
  t.ok("the digest n verifies as the digest 0", p384Verify(g, fromHex(N), fromHex(ZERO_SIG)));
  t.ok("the signature of 5 verifies", p384Verify(g, fromHex(FIVE), fromHex(FIVE_SIG)));
  t.ok("and under the digest n + 5", p384Verify(g, fromHex(N_PLUS_5), fromHex(FIVE_SIG)));

  // --- Self-check: the joint multiply against products added apart ---------
  t.eqStr("1 G + 0 Q is G", toHex(p384MulAdd(fromHex(ONE), fromHex(ZERO), pub)), `04${GX}${GY}`);
  t.eqStr("0 G + 1 Q is Q", toHex(p384MulAdd(fromHex(ZERO), fromHex(ONE), pub)), `04${UX}${UY}`);
  t.eqStr("(n - 1) G is -G", toHex(p384MulAdd(fromHex(N_MINUS_1), fromHex(ZERO), pub)), `04${GX}${NEG_GY}`);
  t.eqStr("2 G is 2G", toHex(p384MulAdd(fromHex(TWO), fromHex(ZERO), pub)), TWO_G);
  t.eqStr("G + G, added, is 2G", toHex(p384PointAdd(g, g)), TWO_G);
  t.eqStr("1 G + 1 Q with Q = G is 2G", toHex(p384MulAdd(fromHex(ONE), fromHex(ONE), g)), TWO_G);
  t.eqStr("G + -G is the identity", toHex(p384PointAdd(g, fromHex(`04${GX}${NEG_GY}`))), "null");
  t.eqStr("0 G + 0 Q is the identity", toHex(p384MulAdd(fromHex(ZERO), fromHex(ZERO), pub)), "null");
  t.eqStr("n G is the identity", toHex(p384MulAdd(fromHex(N), fromHex(ZERO), pub)), "null");
  t.eqStr("a key off the curve is refused", toHex(p384MulAdd(fromHex(ONE), fromHex(ONE), flip(pub, 96, 0))), "null");
  let at: i32 = 0;
  for (const c of mulAddCases()) {
    const u1: u8[] = fromHex(c.u1);
    const u2: u8[] = fromHex(c.u2);
    const left: u8[] | null = p384MulAdd(u1, fromHex(ZERO), pub);
    const right: u8[] | null = p384MulAdd(fromHex(ZERO), u2, pub);
    t.eqStr(`pair ${at}: u1 G`, toHex(left), c.left);
    t.eqStr(`pair ${at}: u2 Q`, toHex(right), c.right);
    t.eqStr(`pair ${at}: u1 G + u2 Q`, toHex(p384MulAdd(u1, u2, pub)), c.sum);
    if (left !== null && right !== null) {
      t.eqStr(`pair ${at}: the joint multiply is the two products added`, toHex(p384MulAdd(u1, u2, pub)), toHex(p384PointAdd(left, right)));
    } else {
      t.fail(`pair ${at}`, "a product was the identity");
    }
    at += 1;
  }

  return t.done();
};
