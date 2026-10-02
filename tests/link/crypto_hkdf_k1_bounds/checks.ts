// HKDF-Expand's refusals at their edges. `tests/link/crypto_hkdf` holds the RFC
// 5869 vectors and L at 255 × HashLen, one past it, zero and -1; this adds the
// ends of the `i32` range, where a bound written as a sum could wrap, and the
// PRK length RFC 5869 §2.3 asks for — "at least HashLen octets" — below which
// the module answers `null` (docs/security/crypto-k1.md, finding K1-5). An
// empty PRK keys HMAC with nothing a caller had to know.
import { hkdfExpandSha256, hkdfExpandSha384 } from "nish/crypto/hkdf";
import { Suite } from "nish/testing";

/** `n` bytes of `b`. */
const hkdfBytes = (n: i32, b: i32): u8[] => {
  const out: u8[] = [];
  for (let i: i32 = 0; i < n; i++) {
    out.push(toU8(b));
  }
  return out;
};

/** The length of an answer, or -1 for `null`. */
const hkdfLength = (out: u8[] | null): i32 => {
  if (out === null) {
    return toI32(-1);
  }
  return toI32(out.length);
};

export const boundsChecks = (): i32 => {
  const t = new Suite("hkdf k1 bounds");
  const info: u8[] = hkdfBytes(toI32(10), toI32(0x69));
  const prk256: u8[] = hkdfBytes(toI32(32), toI32(0x0b));
  const prk384: u8[] = hkdfBytes(toI32(48), toI32(0x0b));
  const most: i32 = 2147483647;
  const least: i32 = toI32(-2147483648);
  const l42: i32 = 42;
  const refused: i32 = -1;

  t.eqI32("sha256: L = 2^31 - 1 answers null", hkdfLength(hkdfExpandSha256(prk256, info, most)), refused);
  t.eqI32("sha256: L = -2^31 answers null", hkdfLength(hkdfExpandSha256(prk256, info, least)), refused);
  t.eqI32("sha384: L = 2^31 - 1 answers null", hkdfLength(hkdfExpandSha384(prk384, info, most)), refused);
  t.eqI32("sha384: L = -2^31 answers null", hkdfLength(hkdfExpandSha384(prk384, info, least)), refused);

  // The PRK: HashLen is the least §2.3 allows, and anything shorter is refused.
  t.eqI32("sha256: a 32-byte PRK is accepted", hkdfLength(hkdfExpandSha256(hkdfBytes(toI32(32), toI32(1)), info, l42)), l42);
  t.eqI32("sha256: a 31-byte PRK answers null", hkdfLength(hkdfExpandSha256(hkdfBytes(toI32(31), toI32(1)), info, l42)), refused);
  t.eqI32("sha256: an empty PRK answers null", hkdfLength(hkdfExpandSha256([], info, l42)), refused);
  t.eqI32("sha384: a 48-byte PRK is accepted", hkdfLength(hkdfExpandSha384(hkdfBytes(toI32(48), toI32(1)), info, l42)), l42);
  t.eqI32("sha384: a 47-byte PRK answers null", hkdfLength(hkdfExpandSha384(hkdfBytes(toI32(47), toI32(1)), info, l42)), refused);
  t.eqI32("sha384: an empty PRK answers null", hkdfLength(hkdfExpandSha384([], info, l42)), refused);
  // Longer than HashLen is allowed; HMAC hashes a key past a block.
  t.eqI32("sha256: a 200-byte PRK is accepted", hkdfLength(hkdfExpandSha256(hkdfBytes(toI32(200), toI32(1)), info, l42)), l42);
  return t.done();
};
