// `nish/crypto/hkdf` against the published answers. The SHA-256 PRKs and OKMs
// are RFC 5869 Appendix A's test cases 1-3 (§A.1-§A.3), cited by section.
// RFC 5869 prints no SHA-384 vectors, so the SHA-384 ones run the same three
// inputs and were checked against a direct transcription of §2.2-§2.3 over
// Python's `hmac` module; so were the tails of the two longest outputs.
//
// A.1 pins a salt and info and an output that ends mid-block, A.2 inputs longer
// than a block and a three-block output, A.3 the empty salt that §2.2 replaces
// with HashLen zeros. The limit checks pin §2.3's `L <= 255 * HashLen`: the
// longest output is made, one byte more is refused, and so is a negative length.
import { Suite } from "nish/testing";
import { hkdfExpandSha256, hkdfExpandSha384, hkdfExtractSha256, hkdfExtractSha384 } from "nish/crypto/hkdf";

const HEX_DIGITS: string = "0123456789abcdef";

/** `bytes` as lowercase hex, two digits a byte, the way RFC 5869 prints them. */
const hexOf = (bytes: u8[]): string => {
  const parts: string[] = [];
  for (const b of bytes) {
    const v: i32 = toI32(b);
    const hi: i32 = v >> 4;
    const lo: i32 = v & 15;
    parts.push(HEX_DIGITS.substring(hi, hi + 1));
    parts.push(HEX_DIGITS.substring(lo, lo + 1));
  }
  return parts.join("");
};

/** `bytes` as hex, or `null` spelled out, so a refused expand prints as a value. */
const hexOrNull = (bytes: u8[] | null): string => {
  if (bytes !== null) {
    return hexOf(bytes);
  }
  return "null";
};

/** `n` copies of the byte `b`. */
const repeated = (b: i32, n: i32): u8[] => {
  const out: u8[] = new Array<u8>(n);
  const outLength: i32 = toI32(out.length);
  for (let i: i32 = 0; i < outLength; i += 1) {
    out[i] = toU8(b);
  }
  return out;
};

/** The bytes `from, from + 1, …` up to but not including `to`: every salt, IKM and info of Appendix A. */
const counting = (from: i32, to: i32): u8[] => {
  const out: u8[] = [];
  for (let v: i32 = from; v < to; v += 1) {
    out.push(toU8(v));
  }
  return out;
};

/** The length of an expand's answer, or -1 for `null`. */
const lengthOf = (bytes: u8[] | null): i32 => {
  if (bytes !== null) {
    return toI32(bytes.length);
  }
  return -1;
};

/** The last `n` bytes of `bytes` as hex, or "null"; `n` is at most its length. */
const tailHex = (bytes: u8[] | null, n: i32): string => {
  if (bytes !== null) {
    const size: i32 = toI32(bytes.length);
    const out: u8[] = [];
    for (let i: i32 = size - n; i < size; i += 1) {
      if (i >= 0) {
        out.push(bytes[i]);
      }
    }
    return hexOf(out);
  }
  return "null";
};

/** The first `n` bytes of `bytes`, or an empty array for `null`. */
const prefixOf = (bytes: u8[] | null, n: i32): u8[] => {
  const out: u8[] = [];
  if (bytes !== null) {
    const size: i32 = toI32(bytes.length);
    for (let i: i32 = 0; i < n && i < size; i += 1) {
      out.push(bytes[i]);
    }
  }
  return out;
};

/**
 * Runs every check and answers the exit code. A function of its own rather
 * than the body of `main`, so that `tests/link/crypto_hkdf_f64` can run the
 * same checks under `--number-mode f64`.
 */
export const hkdfChecks = (): i32 => {
  const t = new Suite("hkdf");
  // Typed locals rather than bare literals, as in the other crypto suites: a
  // literal can be an `f64` under `--number-mode f64`.
  const refused: i32 = -1;
  const empty: i32 = 0;
  const l42: i32 = 42;
  const l82: i32 = 82;
  const max256: i32 = 8160; // 255 * 32
  const max384: i32 = 12240; // 255 * 48
  const hashLen256: i32 = 32;
  const hashLen384: i32 = 48;
  const none: u8[] = [];

  // --- RFC 5869 §A.1: basic test case with SHA-256 --------------------------
  const ikm1: u8[] = repeated(0x0b, 22);
  const salt1: u8[] = counting(0x00, 0x0d);
  const info1: u8[] = counting(0xf0, 0xfa);
  const prk1: u8[] = hkdfExtractSha256(salt1, ikm1);
  t.eqStr("RFC 5869 A.1 PRK", hexOf(prk1), "077709362c2e32df0ddc3f0dc47bba6390b6c73bb50f9c3122ec844ad7c2b3e5");
  t.eqStr(
    "RFC 5869 A.1 OKM (42 bytes, ending mid-block)",
    hexOrNull(hkdfExpandSha256(prk1, info1, l42)),
    "3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865"
  );

  // --- RFC 5869 §A.2: longer inputs and outputs with SHA-256 ----------------
  const ikm2: u8[] = counting(0x00, 0x50);
  const salt2: u8[] = counting(0x60, 0xb0);
  const info2: u8[] = counting(0xb0, 0x100);
  const prk2: u8[] = hkdfExtractSha256(salt2, ikm2);
  t.eqStr("RFC 5869 A.2 PRK", hexOf(prk2), "06a6b88c5853361a06104c9ceb35b45cef760014904671014a193f40c15fc244");
  t.eqStr(
    "RFC 5869 A.2 OKM (82 bytes, three blocks)",
    hexOrNull(hkdfExpandSha256(prk2, info2, l82)),
    "b11e398dc80327a1c8e7f78c596a49344f012eda2d4efad8a050cc4c19afa97c59045a99cac7827271cb41c65e590e09da3275600c2f09b8367793a9aca3db71cc30c58179ec3e87c14c01d5c1f3434f1d87"
  );

  // --- RFC 5869 §A.3: zero-length salt and info with SHA-256 ----------------
  const prk3: u8[] = hkdfExtractSha256(none, ikm1);
  t.eqStr(
    "RFC 5869 A.3 PRK (empty salt)",
    hexOf(prk3),
    "19ef24a32c717b167f33a91d6f648bdf96596776afdb6377ac434c1c293ccb04"
  );
  t.eqStr(
    "RFC 5869 A.3 OKM (empty info)",
    hexOrNull(hkdfExpandSha256(prk3, none, l42)),
    "8da4e775a563c18f715f802a063c5a31b8a11f5c5ee1879ec3454e5f3c738d2d9d201395faa4b61a96c8"
  );
  // §2.2: "if not provided, [salt] is set to a string of HashLen zeros".
  t.eqStr(
    "an empty salt is HashLen zero bytes",
    hexOf(hkdfExtractSha256(repeated(0, hashLen256), ikm1)),
    hexOf(prk3)
  );

  // --- The same three inputs with SHA-384 (checked against Python) ---------
  const prk1Sha384: u8[] = hkdfExtractSha384(salt1, ikm1);
  t.eqStr(
    "A.1's inputs, HKDF-SHA-384 PRK (checked against Python)",
    hexOf(prk1Sha384),
    "704b39990779ce1dc548052c7dc39f303570dd13fb39f7acc564680bef80e8dec70ee9a7e1f3e293ef68eceb072a5ade"
  );
  t.eqStr(
    "A.1's inputs, HKDF-SHA-384 OKM (checked against Python)",
    hexOrNull(hkdfExpandSha384(prk1Sha384, info1, l42)),
    "9b5097a86038b805309076a44b3a9f38063e25b516dcbf369f394cfab43685f748b6457763e4f0204fc5"
  );
  const prk2Sha384: u8[] = hkdfExtractSha384(salt2, ikm2);
  t.eqStr(
    "A.2's inputs, HKDF-SHA-384 PRK (checked against Python)",
    hexOf(prk2Sha384),
    "b319f6831dff9314efb643baa29263b30e4a8d779fe31e9c901efd7de737c85b62e676d4dc87b0895c6a7dc97b52cebb"
  );
  t.eqStr(
    "A.2's inputs, HKDF-SHA-384 OKM (checked against Python)",
    hexOrNull(hkdfExpandSha384(prk2Sha384, info2, l82)),
    "484ca052b8cc724fd1c4ec64d57b4e818c7e25a8e0f4569ed72a6a05fe0649eebf69f8d5c832856bf4e4fbc17967d54975324a94987f7f41835817d8994fdbd6f4c09c5500dca24a56222fea53d8967a8b2e"
  );
  const prk3Sha384: u8[] = hkdfExtractSha384(none, ikm1);
  t.eqStr(
    "A.3's inputs, HKDF-SHA-384 PRK (checked against Python)",
    hexOf(prk3Sha384),
    "10e40cf072a4c5626e43dd22c1cf727d4bb140975c9ad0cbc8e45b40068f8f0ba57cdb598af9dfa6963a96899af047e5"
  );
  t.eqStr(
    "A.3's inputs, HKDF-SHA-384 OKM (checked against Python)",
    hexOrNull(hkdfExpandSha384(prk3Sha384, none, l42)),
    "c8c96e710f89b0d7990bca68bcdec8cf854062e54c73a7abc743fade9b242daacc1cea5670415b52849c"
  );
  t.eqStr(
    "an empty SHA-384 salt is HashLen zero bytes",
    hexOf(hkdfExtractSha384(repeated(0, hashLen384), ikm1)),
    hexOf(prk3Sha384)
  );

  // --- §2.3's length limit, L <= 255 * HashLen ------------------------------
  // The longest output is made in full: its last block is T(255), the one
  // whose counter byte is 0xff, checked against Python.
  const longest256: u8[] | null = hkdfExpandSha256(prk1, info1, max256);
  t.eqI32("HKDF-SHA-256 expands to exactly 255 * 32 bytes", lengthOf(longest256), max256);
  t.eqStr(
    "and its last block is T(255) (checked against Python)",
    tailHex(longest256, hashLen256),
    "76a3f78bcffe95fecf91923c22ad6ee64d48a6d1b981d7e523d5c0f22154ee88"
  );
  t.eqI32(
    "HKDF-SHA-256 refuses 255 * 32 + 1 bytes",
    lengthOf(hkdfExpandSha256(prk1, info1, max256 + 1)),
    refused
  );
  const longest384: u8[] | null = hkdfExpandSha384(prk1Sha384, info1, max384);
  t.eqI32("HKDF-SHA-384 expands to exactly 255 * 48 bytes", lengthOf(longest384), max384);
  t.eqStr(
    "and its last block is T(255) (checked against Python)",
    tailHex(longest384, hashLen384),
    "51c32bc5254cef4332ed63af77508e0b5c6c2638baf7fcf25cd354f9760cab2d71e079bb1ef9867117de2b2b16cb4a4e"
  );
  t.eqI32(
    "HKDF-SHA-384 refuses 255 * 48 + 1 bytes",
    lengthOf(hkdfExpandSha384(prk1Sha384, info1, max384 + 1)),
    refused
  );
  t.eqI32("HKDF-SHA-256 refuses a negative length", lengthOf(hkdfExpandSha256(prk1, info1, refused)), refused);
  t.eqI32(
    "HKDF-SHA-384 refuses a negative length",
    lengthOf(hkdfExpandSha384(prk1Sha384, info1, refused)),
    refused
  );
  t.eqI32("HKDF-SHA-256 of zero bytes is an empty array", lengthOf(hkdfExpandSha256(prk1, info1, empty)), empty);
  t.eqI32(
    "HKDF-SHA-384 of zero bytes is an empty array",
    lengthOf(hkdfExpandSha384(prk1Sha384, info1, empty)),
    empty
  );

  // A shorter output is a prefix of a longer one: the blocks do not depend on L.
  t.eqStr(
    "the first 42 bytes of the longest SHA-256 output are A.1's OKM",
    hexOrNull(hkdfExpandSha256(prk1, info1, l42)),
    hexOf(prefixOf(longest256, l42))
  );

  return t.done();
};

