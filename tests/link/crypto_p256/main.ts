// `nish/crypto/p256` against RFC 6979 and Project Wycheproof: the key pair of
// RFC 6979 A.2.5 and its deterministic SHA-256 signatures of "sample" and
// "test" (the nonce `k` pinned through `r`), every case of Wycheproof's
// ecdsa_secp256r1_sha256_test.json, and the refusals the module promises —
// private keys of 0 and n and more, public keys that are the wrong length, off
// the curve or the identity, and an `r` or `s` of 0 or n or more.
import { Suite } from "nish/testing";
import { sha256 } from "nish/crypto/sha256";
import {
  P256_POINT_SIZE,
  P256_SCALAR_SIZE,
  P256_SIGNATURE_SIZE,
  p256PublicKey,
  p256Sign,
  p256SignSha256,
  p256Verify,
  p256VerifySha256,
} from "nish/crypto/p256";
import {
  WycheproofEcdsaCase,
  wycheproofEcdsaP256Sha256Cases,
  wycheproofEcdsaP256Sha256Keys,
} from "../crypto_wycheproof/ecdsa_secp256r1_sha256";
import { derSignature } from "./der";
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
  for (let i: i32 = 0; i < length && i < toI32(bytes.length); i++) {
    out.push(i === at ? bytes[i] ^ toU8(1 << bit) : bytes[i]);
  }
  return out;
};

/** The hex of `bytes[from .. to)`, for picking X out of a public key. */
const hexSlice = (bytes: u8[] | null, from: i32, to: i32): string => {
  if (bytes === null) {
    return "null";
  }
  const out: u8[] = [];
  const length: i32 = toI32(bytes.length);
  for (let i: i32 = from; i < to && i < length; i++) {
    out.push(bytes[i]);
  }
  return toHex(out);
};

// RFC 6979 A.2.5.
const PRIVATE: string = "c9afa9d845ba75166b5c215767b1d6934e50c3db36e89b127b8a622b120f6721";
const UX: string = "60fed4ba255a9d31c961eb74c6356d68c049b8923b61fa6ce669622e60f29fb6";
const UY: string = "7903fe1008b8bc99a41ae9e95628bc64f2f1b20c2d7e9f5177a3c294d4462299";
const SAMPLE_K: string = "a6e3c57dd01abe90086538398355dd4c3b17aa873382b0f24d6129493d8aad60";
const SAMPLE_R: string = "efd48b2aacb6a8fd1140dd9cd45e81d69d2c877b56aaf991c34d0ea84eaf3716";
const SAMPLE_S: string = "f7cb1c942d657c41d436c7a1b6e29f65f3e900dbb9aff4064dc4ab2f843acda8";
const TEST_K: string = "d16b6ae827f17175e040871a1c7ec3500192c4c92677336ec2537acaee0008e0";
const TEST_R: string = "f1abb023518351cd71d881567b1ea663ed3efcf6c5132b354f28d3b0b7d38367";
const TEST_S: string = "019f4113742a2b14bd25926b49c649155f267e60d3814b4c0cc84250e46f0083";

// The group order n and the field prime p (SEC 2 §2.4.2), for the edges.
const N: string = "ffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551";
const N_MINUS_1: string = "ffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632550";
const N_PLUS_1: string = "ffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632552";
const P: string = "ffffffff00000001000000000000000000000000ffffffffffffffffffffffff";
const ZERO: string = "0000000000000000000000000000000000000000000000000000000000000000";
const ONE: string = "0000000000000000000000000000000000000000000000000000000000000001";
// G, and (n - 1) G = -G, which has G's x and p - y.
const GX: string = "6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296";
const GY: string = "4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5";
const NEG_GY: string = "b01cbd1c01e58065711814b583f061e9d431cca994cea1313449bf97c840ae0a";

/**
 * Every Wycheproof case through `derSignature` and `p256Verify`, checked
 * against its expected result. `valid` must verify and `invalid` must not;
 * `acceptable` may go either way and is only counted. A mismatch is named by
 * its `tcId`. Answers the number of mismatches.
 */
const wycheproof = (t: Suite): i32 => {
  const keys: string[] = wycheproofEcdsaP256Sha256Keys();
  const cases: WycheproofEcdsaCase[] = wycheproofEcdsaP256Sha256Cases();
  const keyCount: i32 = toI32(keys.length);
  let valid: i32 = 0;
  let invalidByDer: i32 = 0;
  let invalidByModule: i32 = 0;
  let acceptableTrue: i32 = 0;
  let acceptableFalse: i32 = 0;
  let mismatches: i32 = 0;
  for (const c of cases) {
    // Each case's keys, message and signature are dead once it is judged.
    const mark = Arena.mark();
    if (c.key < 0 || c.key >= keyCount) {
      t.fail(`wycheproof tcId ${c.tcId}`, "no such key");
      mismatches += 1;
      continue;
    }
    const pub: u8[] = fromHex(keys[c.key]);
    const sig: u8[] | null = derSignature(fromHex(c.sig));
    const verified: boolean = sig !== null && p256Verify(pub, sha256(fromHex(c.msg)), sig);
    if (c.result === "valid") {
      if (verified) {
        valid += 1;
      } else {
        t.fail(`wycheproof tcId ${c.tcId}`, "a valid signature did not verify");
        mismatches += 1;
      }
    } else if (c.result === "invalid") {
      if (verified) {
        t.fail(`wycheproof tcId ${c.tcId}`, "an invalid signature verified");
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
    Arena.release(mark);
  }
  console.log(
    `wycheproof ecdsa_secp256r1_sha256: ${toI32(cases.length)} cases, ${valid} valid verified, ${invalidByDer + invalidByModule} invalid refused (${invalidByDer} by the DER reader, ${invalidByModule} by p256Verify), ${acceptableTrue + acceptableFalse} acceptable (${acceptableTrue} verified, ${acceptableFalse} refused), 0 filtered out`
  );
  return mismatches;
};

export const main = (): i32 => {
  const t = new Suite("p256");

  t.eqI32("P256_SCALAR_SIZE is 32 bytes", P256_SCALAR_SIZE, 32);
  t.eqI32("P256_POINT_SIZE is 65 bytes", P256_POINT_SIZE, 65);
  t.eqI32("P256_SIGNATURE_SIZE is 64 bytes", P256_SIGNATURE_SIZE, 64);

  // --- RFC 6979 A.2.5: the key pair -----------------------------------------
  const priv: u8[] = fromHex(PRIVATE);
  const pub: u8[] | null = p256PublicKey(priv);
  t.eqStr("A.2.5 public key of the private key", toHex(pub), `04${UX}${UY}`);
  t.eqStr("the public key of 1 is G", toHex(p256PublicKey(fromHex(ONE))), `04${GX}${GY}`);
  t.eqStr("the public key of n - 1 is -G", toHex(p256PublicKey(fromHex(N_MINUS_1))), `04${GX}${NEG_GY}`);

  // --- RFC 6979 A.2.5: SHA-256 signatures of "sample" and "test" ------------
  // The nonce is internal, so `k` is pinned through `r`: `r` is the
  // x-coordinate of k G mod n, and for both messages that x is below n, so it
  // is the X of `p256PublicKey(k)` exactly.
  const sample: u8[] = ascii("sample");
  const test: u8[] = ascii("test");
  t.eqStr("A.2.5 SHA-256 \"sample\": k G has x = r", hexSlice(p256PublicKey(fromHex(SAMPLE_K)), 1, 33), SAMPLE_R);
  t.eqStr("A.2.5 SHA-256 \"test\": k G has x = r", hexSlice(p256PublicKey(fromHex(TEST_K)), 1, 33), TEST_R);
  const sampleSig: u8[] | null = p256SignSha256(priv, sample);
  const testSig: u8[] | null = p256SignSha256(priv, test);
  t.eqStr("A.2.5 SHA-256 \"sample\": r || s", toHex(sampleSig), `${SAMPLE_R}${SAMPLE_S}`);
  t.eqStr("A.2.5 SHA-256 \"test\": r || s", toHex(testSig), `${TEST_R}${TEST_S}`);
  t.eqStr("p256Sign of the SHA-256 is p256SignSha256", toHex(p256Sign(priv, sha256(sample))), toHex(sampleSig));
  t.eqStr("signing again gives the same signature", toHex(p256SignSha256(priv, sample)), toHex(sampleSig));

  if (pub === null || sampleSig === null || testSig === null) {
    t.fail("A.2.5", "a key or signature above was null, so the rest cannot run");
    return t.done();
  }
  t.ok("A.2.5 \"sample\" verifies", p256VerifySha256(pub, sample, sampleSig));
  t.ok("A.2.5 \"test\" verifies", p256VerifySha256(pub, test, testSig));
  t.ok("p256Verify of the SHA-256 verifies", p256Verify(pub, sha256(test), testSig));
  t.ok("\"sample\"'s signature does not verify \"test\"", !p256VerifySha256(pub, test, sampleSig));
  t.ok("a flipped bit in r is refused", !p256VerifySha256(pub, sample, flip(sampleSig, 5, 3)));
  t.ok("a flipped bit in s is refused", !p256VerifySha256(pub, sample, flip(sampleSig, 60, 0)));
  t.ok("a flipped bit in the message is refused", !p256VerifySha256(pub, flip(sample, 0, 0), sampleSig));
  t.ok("another key does not verify it", !p256VerifySha256(fromHex(`04${GX}${GY}`), sample, sampleSig));

  // bits2int takes the leftmost 256 bits of a longer digest, and a shorter
  // digest is its own value: a 48-byte digest signs as its first 32 bytes.
  const long: u8[] = fromHex(`${SAMPLE_K}0102030405060708090a0b0c0d0e0f10`);
  const longSig: u8[] | null = p256Sign(priv, long);
  t.eqStr("a 48-byte digest signs as its leftmost 32 bytes", toHex(longSig), toHex(p256Sign(priv, fromHex(SAMPLE_K))));
  t.ok("and verifies", longSig !== null && p256Verify(pub, long, longSig));
  const short: u8[] = fromHex("0102");
  const shortSig: u8[] | null = p256Sign(priv, short);
  t.ok("a 2-byte digest signs and verifies", shortSig !== null && p256Verify(pub, short, shortSig));
  t.eqStr(
    "and is the value 0x0102",
    toHex(shortSig),
    toHex(p256Sign(priv, fromHex("0000000000000000000000000000000000000000000000000000000000000102")))
  );

  // --- Wycheproof -------------------------------------------------------------
  t.eqI32("wycheproof: every case answers what the file expects", wycheproof(t), 0);

  // --- Private keys: [1, n) and 32 bytes, or null ----------------------------
  t.eqStr("p256PublicKey(0) is null", toHex(p256PublicKey(fromHex(ZERO))), "null");
  t.eqStr("p256PublicKey(n) is null", toHex(p256PublicKey(fromHex(N))), "null");
  t.eqStr("p256PublicKey(n + 1) is null", toHex(p256PublicKey(fromHex(N_PLUS_1))), "null");
  t.eqStr("p256PublicKey(2^256 - 1) is null", toHex(p256PublicKey(fromHex("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"))), "null");
  t.eqStr("p256PublicKey of 31 bytes is null", toHex(p256PublicKey(new Array<u8>(31))), "null");
  t.eqStr("p256PublicKey of 33 bytes is null", toHex(p256PublicKey(new Array<u8>(33))), "null");
  t.eqStr("p256Sign with private key 0 is null", toHex(p256Sign(fromHex(ZERO), sha256(sample))), "null");
  t.eqStr("p256Sign with private key n is null", toHex(p256Sign(fromHex(N), sha256(sample))), "null");
  t.eqStr("p256SignSha256 with a 31-byte key is null", toHex(p256SignSha256(new Array<u8>(31), sample)), "null");

  // --- Public keys: 65 bytes, 0x04, on the curve, not the identity ----------
  t.ok("a key with a flipped bit in y is off the curve", !p256VerifySha256(flip(pub, 64, 0), sample, sampleSig));
  t.ok("a key with a flipped bit in x is off the curve", !p256VerifySha256(flip(pub, 1, 7), sample, sampleSig));
  t.ok("a key with prefix 0x03 is refused", !p256VerifySha256(flip(pub, 0, 0), sample, sampleSig));
  t.ok("the identity's SEC 1 encoding, 0x00, is refused", !p256VerifySha256(fromHex("00"), sample, sampleSig));
  t.ok("65 zero bytes are refused", !p256VerifySha256(new Array<u8>(65), sample, sampleSig));
  t.ok("0x04 then (0, 0) is refused", !p256VerifySha256(fromHex(`04${ZERO}${ZERO}`), sample, sampleSig));
  t.ok("a 64-byte key is refused", !p256VerifySha256(fromHex(`${UX}${UY}`), sample, sampleSig));
  t.ok("a 66-byte key is refused", !p256VerifySha256(fromHex(`${toHex(pub)}00`), sample, sampleSig));
  // A coordinate of p or more is refused as not canonical, before the curve
  // equation sees it. (5, y) is on the curve, and x = 5 + p is below 2^256,
  // so the same point spelled with x + p would pass the equation; only the
  // range check refuses it. The signature was built for this key from the
  // verification equation itself (pick a and b, take R = aG + bQ, then
  // r = R.x, s = r / b and z = a s), which needs no private key.
  const smallX: string = "0000000000000000000000000000000000000000000000000000000000000005";
  const smallY: string = "459243b9aa581806fe913bce99817ade11ca503c64d9a3c533415c083248fbcc";
  const smallXPlusP: string = "ffffffff00000001000000000000000000000001000000000000000000000004";
  const smallDigest: u8[] = fromHex("58270d12bd05dd5000c531afd354263d3a02d4adb93b6b1ce7ced34c032c65cb");
  const smallSig: u8[] = fromHex(
    "6f34b24828b4efbcbad39f16e008014367b4db9fca7b64cbd6972b0ef79e444f31d1583751fd3e107030204ab04db5793ed8e514c22c300b15e9ea8b1482ec35"
  );
  t.ok("the point (5, y) verifies its signature", p256Verify(fromHex(`04${smallX}${smallY}`), smallDigest, smallSig));
  t.ok("the same point with x = 5 + p is refused", !p256Verify(fromHex(`04${smallXPlusP}${smallY}`), smallDigest, smallSig));
  // P-256 has no point with y = 0, so y = p is refused by the equation too;
  // this pins the refusal, not which check makes it.
  t.ok("a key with y = p is refused", !p256VerifySha256(fromHex(`04${UX}${P}`), sample, sampleSig));

  // --- Signatures: r and s in [1, n), 64 bytes --------------------------------
  t.ok("r = 0 is refused", !p256VerifySha256(pub, sample, fromHex(`${ZERO}${SAMPLE_S}`)));
  t.ok("s = 0 is refused", !p256VerifySha256(pub, sample, fromHex(`${SAMPLE_R}${ZERO}`)));
  t.ok("r = n is refused", !p256VerifySha256(pub, sample, fromHex(`${N}${SAMPLE_S}`)));
  t.ok("s = n is refused", !p256VerifySha256(pub, sample, fromHex(`${SAMPLE_R}${N}`)));
  t.ok("r = n + 1 is refused", !p256VerifySha256(pub, sample, fromHex(`${N_PLUS_1}${SAMPLE_S}`)));
  t.ok("s = n + 1 is refused", !p256VerifySha256(pub, sample, fromHex(`${SAMPLE_R}${N_PLUS_1}`)));
  t.ok("a 63-byte signature is refused", !p256VerifySha256(pub, sample, fromHex(`${SAMPLE_R}${SAMPLE_S}`.substring(0, 126))));
  t.ok("a 65-byte signature is refused", !p256VerifySha256(pub, sample, fromHex(`${SAMPLE_R}${SAMPLE_S}00`)));

  return t.done();
};
