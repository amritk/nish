// `nish/crypto/sha1` against the published answers. The empty message, "abc",
// the 448-bit and 896-bit messages and one million "a" are FIPS 180-4's own
// SHA-1 examples (NIST's "Examples with Intermediate Values" and the SHA
// additional examples). The padding lengths are marked as checked against
// OpenSSL: 55 bytes is the longest message whose padding fits its own block,
// 56 the shortest that needs a second, 63 and 64 put the padding in a block of
// its own, and 65, 119, 120 and 128 do the same one block further on.
import { Suite } from "nish/testing";
import { SHA1_BLOCK, SHA1_SIZE, sha1 } from "nish/crypto/sha1";

const HEX_DIGITS: string = "0123456789abcdef";

/** `bytes` as lowercase hex, two digits a byte, the way the vectors print them. */
const hexOf = (bytes: u8[]): string => {
  const parts: string[] = [];
  for (const b of bytes) {
    const v: i32 = toI32(b);
    parts.push(HEX_DIGITS.substring(v >> 4, (v >> 4) + 1));
    parts.push(HEX_DIGITS.substring(v & 15, (v & 15) + 1));
  }
  return parts.join("");
};

/** The bytes of an ASCII string, for the FIPS examples, which are given as text. */
const bytesOf = (text: string): u8[] => {
  const out: u8[] = [];
  const n: i32 = toI32(text.length);
  for (let i: i32 = 0; i < n; i += 1) {
    out.push(toU8(text.charCodeAt(i)));
  }
  return out;
};

/** `n` bytes of (7i + 3) mod 251, the pattern the OpenSSL-checked digests hash. */
const pattern = (n: i32): u8[] => {
  const out: u8[] = new Array<u8>(n);
  const outLength: i32 = toI32(out.length);
  for (let i: i32 = 0; i < outLength; i += 1) {
    out[i] = toU8((i * 7 + 3) % 251);
  }
  return out;
};

/**
 * Runs every check and answers the exit code. A function of its own so that
 * `tests/link/crypto_sha1_f64` can run the same checks under
 * `--number-mode f64`.
 */
export const sha1Checks = (): i32 => {
  const t = new Suite("sha1");
  const digestBytes: i32 = 20;
  const blockBytes: i32 = 64;
  t.eqI32("SHA1_SIZE is 20 bytes (FIPS 180-4 §1)", SHA1_SIZE, digestBytes);
  t.eqI32("SHA1_BLOCK is 64 bytes (FIPS 180-4 §1)", SHA1_BLOCK, blockBytes);

  // --- FIPS 180-4 examples --------------------------------------------------
  const empty: u8[] = [];
  t.eqStr("empty message", hexOf(sha1(empty)), "da39a3ee5e6b4b0d3255bfef95601890afd80709");
  t.eqStr(
    "\"abc\" (FIPS 180-4 example, one block)",
    hexOf(sha1(bytesOf("abc"))),
    "a9993e364706816aba3e25717850c26c9cd0d89d"
  );
  t.eqStr(
    "the 448-bit message (FIPS 180-4 example, two blocks)",
    hexOf(sha1(bytesOf("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"))),
    "84983e441c3bd26ebaae4aa1f95129e5e54670f1"
  );
  t.eqStr(
    "the 896-bit message (FIPS 180-4 additional example)",
    hexOf(
      sha1(
        bytesOf(
          "abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu"
        )
      )
    ),
    "a49b2446a02c645bf419f995b67091253a04a259"
  );
  const million: u8[] = new Array<u8>(1000000);
  million.fill(toU8(97));
  t.eqStr(
    "one million \"a\" (FIPS 180-4 additional example)",
    hexOf(sha1(million)),
    "34aa973cd4c4daa4f61eeb2bdbad27316534016f"
  );

  // --- The padding boundaries (checked against OpenSSL) --------------------
  t.eqStr("55 bytes, the longest one-block padding", hexOf(sha1(pattern(55))), "8829dc293fb52f1477aa7323310a5bcf949ce4f8");
  t.eqStr("56 bytes, the shortest two-block padding", hexOf(sha1(pattern(56))), "3c440665799f6f245108a068a11e59507d4f9e2c");
  t.eqStr("63 bytes, one byte short of a block", hexOf(sha1(pattern(63))), "5e2cdca8ef9552e40ad2228153e778e586eebc50");
  t.eqStr("64 bytes, exactly one block", hexOf(sha1(pattern(64))), "24d0ab86ac7542b26241687c97b79ae2cc22ac90");
  t.eqStr("65 bytes, one byte into a second block", hexOf(sha1(pattern(65))), "f71ba60012ec8015b3d5ba56798c4ff43aeb8beb");
  t.eqStr("119 bytes, a block and the longest one-block padding", hexOf(sha1(pattern(119))), "ea44537c014a6f0d332e845ed7f9331ae45440c5");
  t.eqStr("120 bytes, a block and a two-block padding", hexOf(sha1(pattern(120))), "939b2cbff515552d0bc4cfa0c332a57f9fce7736");
  t.eqStr("128 bytes, exactly two blocks", hexOf(sha1(pattern(128))), "0a1d410f25f3840e4498a2ad922fea55bb4b79da");

  // A digest is a fresh array each time, so writing into one cannot change another.
  const first: u8[] = sha1(empty);
  const second: u8[] = sha1(empty);
  first[0] = 0;
  t.eqStr("each digest is a fresh array", hexOf(second), "da39a3ee5e6b4b0d3255bfef95601890afd80709");
  t.eqI32("a digest is SHA1_SIZE bytes long", toI32(second.length), SHA1_SIZE);
  return t.done();
};
