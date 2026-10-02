// `nish/crypto/x25519` against RFC 7748: the two single computations and the
// iterated vector of §5.2, the Diffie-Hellman exchange of §6.1, and the edges
// §5 decides — the top bit of `u` ignored, a `u` of p or more taken modulo p,
// the answer always canonical, and an all-zero answer returned rather than
// refused. The 1,000,000-iteration vector of §5.2 is not here: it takes too
// long for the suite, and was run once by hand for the pull request. Then every
// case of Wycheproof's x25519_test.json, and the low-order points by name
// (docs/security/crypto-ecc.md is the audit these checks pin).
import { Suite } from "nish/testing";
import { X25519_SIZE, x25519, x25519Base } from "nish/crypto/x25519";
import { fromHex, toHex } from "./hex";
import { wycheproofX25519 } from "./wycheproof";

/** A 32-byte u-coordinate or scalar holding the small number `n`. */
const small = (n: i32): u8[] => {
  const out: u8[] = new Array<u8>(32);
  out[0] = toU8(n);
  return out;
};

/**
 * RFC 7748 §5.2's iterated vector: start with k = u = 9, and each iteration
 * sets k to `x25519(k, u)` and u to the old k.
 */
const iterate = (times: i32): string => {
  let k: u8[] = small(9);
  let u: u8[] = small(9);
  for (let i: i32 = 0; i < times; i++) {
    const next: u8[] | null = x25519(k, u);
    if (next === null) {
      return "null";
    }
    u = k;
    k = next;
  }
  return toHex(k);
};

/**
 * Whether 32 little-endian bytes are below p = 2^255 - 19: the top byte below
 * 0x7f, or 0x7f with a byte below 0xff under it, or all of that and a low
 * byte below 0xed. Test code, so it may branch on the bytes.
 */
const isCanonical = (bytes: u8[] | null): boolean => {
  if (bytes === null || toI32(bytes.length) !== 32) {
    return false;
  }
  if (toI32(bytes[31]) !== 0x7f) {
    return toI32(bytes[31]) < 0x7f;
  }
  for (let i: i32 = 30; i >= 1; i--) {
    if (toI32(bytes[i]) !== 0xff) {
      return true;
    }
  }
  return toI32(bytes[0]) < 0xed;
};

const ALL_ZERO: string = "0000000000000000000000000000000000000000000000000000000000000000";

export const main = (): i32 => {
  const t = new Suite("x25519");

  t.eqI32("X25519_SIZE is 32 bytes", X25519_SIZE, 32);

  // --- RFC 7748 §5.2: the two single computations ---------------------------
  const good: u8[] = fromHex("a546e36bf0527c9d3b16154b82465edd62144c0ac1fc5a18506a2244ba449ac4");
  const cleared: u8[] = fromHex("e6db6867583030db3594c1a424b15f7c726624ec26b3353b10a903a6d0ab1c4c");
  t.eqStr(
    "§5.2 first vector",
    toHex(
x25519(good, cleared)
    ),
    "c3da55379de9c6908e94ea4df28d084f32eccf03491c71f754b4075577a28552"
  );
  // This u has its top bit set, so the vector checks the §5 mask as well.
  t.eqStr(
    "§5.2 second vector",
    toHex(
      x25519(
        fromHex("4b66e9d4d1b4673c5ad22691957d6af5c11b6421e0ea01d42ca4169e7918ba0d"),
        fromHex("e5210f12786811d3f4b7959d0538ae2c31dbe7106fc03c3efc4cd549c715a493")
      )
    ),
    "95cbde9476e8907d7aade45cb4b873f88b595a68799fa152e6f8f7647aac7957"
  );

  // --- RFC 7748 §5.2: the iterated vector -----------------------------------
  t.eqStr("§5.2 iterated, after 1 iteration", iterate(1), "422c8e7a6227d7bca1350b3e2bb7279f7897b87bb6854b783c60e80311ae3079");
  t.eqStr(
    "§5.2 iterated, after 1,000 iterations",
    iterate(1000),
    "684cf59ba83309552800ef566f2f4d3c1c3887c49360e3875f2eb94d99532c51"
  );

  // --- RFC 7748 §6.1: Alice and Bob -----------------------------------------
  const aliceHex: string = "77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a";
  const alicePrivate: u8[] = fromHex(aliceHex);
  const bobPrivate: u8[] = fromHex("5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb");
  const alicePublic: u8[] | null = x25519Base(alicePrivate);
  const bobPublic: u8[] | null = x25519Base(bobPrivate);
  t.eqStr("§6.1 Alice's public key", toHex(alicePublic), "8520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a");
  t.eqStr("§6.1 Bob's public key", toHex(bobPublic), "de9edb7d7b7dc1b4d35b61c2ece435373f8343c85b78674dadfc7e146f882b4f");
  const shared: string = "4a5d9d5ba4ce2de1728e3bf480350f25e07e21c947d19e3376f09b3c1e161742";
  if (alicePublic !== null && bobPublic !== null) {
    t.eqStr("§6.1 Alice's shared secret", toHex(x25519(alicePrivate, bobPublic)), shared);
    t.eqStr("§6.1 Bob's shared secret", toHex(x25519(bobPrivate, alicePublic)), shared);
  }
  // Clamping works on a copy: the caller's private key is not changed.
  t.eqStr("the scalar is clamped on a copy, not in place", toHex(alicePrivate), aliceHex);

  // --- Lengths: anything but 32 bytes is refused ----------------------------
  const nine: u8[] = small(9);
  t.eqStr("x25519: a 31-byte scalar answers null", toHex(x25519(new Array<u8>(31), nine)), "null");
  t.eqStr("x25519: a 31-byte u answers null", toHex(x25519(good, new Array<u8>(31))), "null");
  t.eqStr("x25519: a 33-byte scalar answers null", toHex(x25519(new Array<u8>(33), nine)), "null");
  t.eqStr("x25519: a 33-byte u answers null", toHex(x25519(good, new Array<u8>(33))), "null");
  t.eqStr("x25519: an empty scalar answers null", toHex(x25519(new Array<u8>(0), nine)), "null");
  t.eqStr("x25519Base: a 31-byte scalar answers null", toHex(x25519Base(new Array<u8>(31))), "null");
  t.eqStr("x25519Base: a 33-byte scalar answers null", toHex(x25519Base(new Array<u8>(33))), "null");
  t.eqStr("x25519Base is x25519 with u = 9", toHex(x25519Base(good)), toHex(x25519(good, nine)));

  // --- §5: the top bit of u is masked -----------------------------------------
  // The first §5.2 vector's u has its top bit clear; setting it changes nothing.
  const set: u8[] = fromHex("e6db6867583030db3594c1a424b15f7c726624ec26b3353b10a903a6d0ab1ccc");
  t.eqStr("a u with its top bit set gives the same answer as with it clear", toHex(x25519(good, set)), toHex(x25519(good, cleared)));

  // --- §5: a non-canonical u is taken modulo p, and the answer is canonical ---
  // p = 2^255 - 19, little-endian; p + 1 and p + 9 are the same points as 1 and 9.
  const p: u8[] = fromHex("edffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f");
  const pPlus1: u8[] = fromHex("eeffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f");
  const pPlus9: u8[] = fromHex("f6ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f");
  const one: u8[] = small(1);
  // u = 0 is the point of order two: any scalar sends it to 0, which is
  // returned as 32 zero bytes, not refused (§6.1 leaves that check to the protocol).
  t.eqStr("u = 0 answers all zeros, not null", toHex(x25519(good, new Array<u8>(32))), ALL_ZERO);
  t.eqStr("u = p decodes as 0, so it answers all zeros", toHex(x25519(good, p)), ALL_ZERO);
  t.eqStr("u = p + 1 decodes as 1", toHex(x25519(good, pPlus1)), toHex(x25519(good, one)));
  t.eqStr("u = p + 9 decodes as 9", toHex(x25519(good, pPlus9)), toHex(x25519(good, nine)));
  // Every answer is fully reduced: below p, so a byte-for-byte comparison of two
  // encodings is a comparison of the two field elements.
  t.ok("the answer for u = p + 1 is below p", isCanonical(x25519(good, pPlus1)));
  t.ok("the answer for u = p + 9 is below p", isCanonical(x25519(good, pPlus9)));
  t.ok("an all-ones u (top bit masked, then reduced) answers below p", isCanonical(x25519(good, fromHex("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"))));
  t.ok("isCanonical itself refuses p", !isCanonical(p));
  t.ok("isCanonical itself accepts p - 1", isCanonical(fromHex("ecffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f")));
  // The mask comes before the reduction: the bytes of p with bit 255 set as
  // well are p once masked, so they still decode as 0.
  const pTop: u8[] = fromHex("edffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
  t.eqStr("u = p with its top bit set still decodes as 0", toHex(x25519(good, pTop)), ALL_ZERO);

  // --- Wycheproof x25519_test.json ---------------------------------------------
  t.eqI32("wycheproof: every case answers the file's shared secret", wycheproofX25519(t), 0);

  // --- Low-order points: all zeros, whatever the scalar ----------------------
  // The u-coordinates of small order on curve25519 and its twist: 0, 1, the
  // two points of order 8, p - 1, and p + 1 (which is 1 spelled above p). A
  // clamped scalar is a multiple of 8, so each goes to the identity, which
  // X25519 encodes as u = 0. They are answered, not refused: §6.1 leaves that
  // check to the protocol, which means to every caller (x25519's doc says how).
  const lowOrder: string[] = [
    "0000000000000000000000000000000000000000000000000000000000000000",
    "0100000000000000000000000000000000000000000000000000000000000000",
    "e0eb7a7c3b41b8ae1656e3faf19fc46ada098deb9c32b1fd866205165f49b800",
    "5f9c95bca3508c24b1d0b1559c83ef5b04445cc4581c8e86d8224eddd09f1157",
    "ecffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f",
    "eeffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f",
  ];
  const bob: u8[] = fromHex("5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb");
  for (const u of lowOrder) {
    t.eqStr(`low-order u ${u.substring(0, 8)}… answers all zeros`, toHex(x25519(bob, fromHex(u))), ALL_ZERO);
  }

  return t.done();
};
