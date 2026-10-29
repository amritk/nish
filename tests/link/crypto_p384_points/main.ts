// Public keys and signatures `nish/crypto/p384` must refuse, broken one field
// at a time, and digests of other lengths through `p384Verify`. Wycheproof's
// ECDSA files hold only valid keys, so the point checks are pinned here.
import { Suite } from "nish/testing";
import { p384DerSignatureRS, p384Verify, p384VerifySha384 } from "nish/crypto/p384";
import { fromHex } from "../crypto_rsa_wycheproof/hex";
import { derSha384, digestSha256, digestSha512, message, publicKey, sigSha256, sigSha384, sigSha512 } from "./vectors";

/** The field prime p and the group order n of P-384, from SEC 2 §2.5.1. */
const fieldPrime: string =
  "fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffeffffffff0000000000000000ffffffff";
const groupOrder: string =
  "ffffffffffffffffffffffffffffffffffffffffffffffffc7634d81f4372ddf581a0db248b0a77aecec196accc52973";

/** `bytes` with the byte at `at` replaced by `value`. */
const withByte = (bytes: u8[], at: i32, value: u8): u8[] => {
  const out: u8[] = [];
  let i: i32 = 0;
  for (const b of bytes) {
    out.push(i === at ? value : b);
    i += 1;
  }
  return out;
};

/** `head` followed by `tail`. */
const concat = (head: u8[], tail: u8[]): u8[] => {
  const out: u8[] = [];
  for (const b of head) {
    out.push(b);
  }
  for (const b of tail) {
    out.push(b);
  }
  return out;
};

/** The first `count` bytes of `bytes`. */
const prefix = (bytes: u8[], count: i32): u8[] => {
  const out: u8[] = [];
  for (const b of bytes) {
    if (toI32(out.length) < count) {
      out.push(b);
    }
  }
  return out;
};

/** The bytes of `bytes` from index `from` on. */
const suffix = (bytes: u8[], from: i32): u8[] => {
  const out: u8[] = [];
  let i: i32 = 0;
  for (const b of bytes) {
    if (i >= from) {
      out.push(b);
    }
    i += 1;
  }
  return out;
};

export const main = (): i32 => {
  const t = new Suite("p384 points");
  const pub: u8[] = fromHex(publicKey());
  const msg: u8[] = fromHex(message());
  const sig: u8[] = fromHex(sigSha384());
  const r: u8[] = prefix(sig, 48);
  const s: u8[] = suffix(sig, 48);
  const x: u8[] = suffix(prefix(pub, 49), 1);
  const y: u8[] = suffix(pub, 49);
  const four: u8[] = [4];

  t.eqBool("a correct signature verifies", p384VerifySha384(pub, msg, sig), true);
  t.eqBool("a signature over another message is refused", p384VerifySha384(pub, fromHex("6e697368"), sig), false);

  t.eqBool("a compressed-point prefix is refused", p384VerifySha384(withByte(pub, 0, 2), msg, sig), false);
  t.eqBool("a hybrid-point prefix is refused", p384VerifySha384(withByte(pub, 0, 6), msg, sig), false);
  t.eqBool("a 49-byte compressed point is refused", p384VerifySha384(withByte(prefix(pub, 49), 0, 2), msg, sig), false);
  t.eqBool("a point one byte short is refused", p384VerifySha384(prefix(pub, 96), msg, sig), false);
  t.eqBool("a point off the curve is refused", p384VerifySha384(withByte(pub, 96, pub[96] ^ 1), msg, sig), false);
  t.eqBool("a point with x equal to p is refused", p384VerifySha384(concat(concat(four, fromHex(fieldPrime)), y), msg, sig), false);
  t.eqBool("a point with y equal to p is refused", p384VerifySha384(concat(concat(four, x), fromHex(fieldPrime)), msg, sig), false);
  const zero: u8[] = fromHex("000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000");
  t.eqBool("the all-zero point is refused", p384VerifySha384(concat(concat(four, zero), zero), msg, sig), false);

  t.eqBool("r equal to zero is refused", p384VerifySha384(pub, msg, concat(zero, s)), false);
  t.eqBool("s equal to zero is refused", p384VerifySha384(pub, msg, concat(r, zero)), false);
  t.eqBool("r equal to n is refused", p384VerifySha384(pub, msg, concat(fromHex(groupOrder), s)), false);
  t.eqBool("s equal to n is refused", p384VerifySha384(pub, msg, concat(r, fromHex(groupOrder))), false);
  t.eqBool("a signature one byte short is refused", p384VerifySha384(pub, msg, prefix(sig, 95)), false);
  t.eqBool("r and s swapped are refused", p384VerifySha384(pub, msg, concat(s, r)), false);

  t.eqBool("a SHA-256 digest verifies as it is", p384Verify(pub, fromHex(digestSha256()), fromHex(sigSha256())), true);
  t.eqBool("a SHA-512 digest verifies by its leftmost 384 bits", p384Verify(pub, fromHex(digestSha512()), fromHex(sigSha512())), true);
  t.eqBool("a SHA-512 signature is refused over the SHA-256 digest", p384Verify(pub, fromHex(digestSha256()), fromHex(sigSha512())), false);

  const der: u8[] | null = p384DerSignatureRS(fromHex(derSha384()));
  t.eqBool("a DER signature verifies once p384DerSignatureRS reads it", der !== null && p384VerifySha384(pub, msg, der), true);
  t.ok("a DER signature with a byte after it is refused", p384DerSignatureRS(concat(fromHex(derSha384()), four)) === null);
  return t.done();
};
