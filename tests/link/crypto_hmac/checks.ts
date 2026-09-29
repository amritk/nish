// `nish/crypto/hmac` against the published answers. Every tag below is from
// RFC 4231 §4 ("Test Cases"), cited by its case number, except the four
// block-size keys marked otherwise, which no RFC case sits on and were checked
// against Python's `hmac` module.
//
// Cases 1-4 pin the construction on short keys, case 5 the truncated compare
// the RFC prints (the first 128 bits), and cases 6 and 7 a key longer than the
// block, which RFC 2104 §2 hashes first. The block-size keys pin that boundary
// itself: a key of exactly one block is used as it is, one byte more is hashed.
// The streaming checks pin `update`, and the verify checks pin the compare.
import { Suite } from "nish/testing";
import { HmacSha256, HmacSha384, hmacSha256, hmacSha256Verify, hmacSha384, hmacSha384Verify } from "nish/crypto/hmac";

const HEX_DIGITS: string = "0123456789abcdef";

/** `bytes` as lowercase hex, two digits a byte, the way RFC 4231 prints them. */
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

/** The bytes of an ASCII string, for the RFC's text messages. */
const bytesOf = (text: string): u8[] => {
  const out: u8[] = [];
  const n: i32 = toI32(text.length);
  for (let i: i32 = 0; i < n; i += 1) {
    out.push(toU8(text.charCodeAt(i)));
  }
  return out;
};

/** `n` copies of the byte `b`, the shape of most of RFC 4231's keys and data. */
const repeated = (b: i32, n: i32): u8[] => {
  const out: u8[] = new Array<u8>(n);
  const outLength: i32 = toI32(out.length);
  for (let i: i32 = 0; i < outLength; i += 1) {
    out[i] = toU8(b);
  }
  return out;
};

/** The bytes `from, from + 1, …` up to but not including `to`. */
const counting = (from: i32, to: i32): u8[] => {
  const out: u8[] = [];
  for (let v: i32 = from; v < to; v += 1) {
    out.push(toU8(v));
  }
  return out;
};

/** The first `n` bytes of `data`, as a fresh array; `n` is at most `data.length`. */
const prefix = (data: u8[], n: i32): u8[] => {
  const out: u8[] = new Array<u8>(n);
  const outLength: i32 = toI32(out.length);
  if (outLength <= toI32(data.length)) {
    for (let i: i32 = 0; i < outLength; i += 1) {
      out[i] = data[i];
    }
  }
  return out;
};

/** A copy of `data` with the lowest bit of its last byte flipped. */
const flipLastBit = (data: u8[]): u8[] => {
  const out: u8[] = prefix(data, toI32(data.length));
  const last: i32 = toI32(out.length) - 1;
  if (last >= 0) {
    out[last] = out[last] ^ toU8(1);
  }
  return out;
};

/** HMAC-SHA-256 of `data` fed in chunks of `chunk` bytes, the last one short. */
const sha256InChunks = (key: u8[], data: u8[], chunk: i32): string => {
  const mac = new HmacSha256(key);
  const n: i32 = toI32(data.length);
  let at: i32 = 0;
  while (at < n) {
    const take: i32 = n - at < chunk ? n - at : chunk;
    mac.update(data, at, take);
    at += take;
  }
  return hexOf(mac.digest());
};

/** HMAC-SHA-384 of `data` fed in chunks of `chunk` bytes, the last one short. */
const sha384InChunks = (key: u8[], data: u8[], chunk: i32): string => {
  const mac = new HmacSha384(key);
  const n: i32 = toI32(data.length);
  let at: i32 = 0;
  while (at < n) {
    const take: i32 = n - at < chunk ? n - at : chunk;
    mac.update(data, at, take);
    at += take;
  }
  return hexOf(mac.digest());
};

/**
 * Runs every check and answers the exit code. A function of its own rather
 * than the body of `main`, so that `tests/link/crypto_hmac_f64` can run the
 * same checks under `--number-mode f64`.
 */
export const hmacChecks = (): i32 => {
  const t = new Suite("hmac");
  // Typed locals rather than bare literals: a literal passed to a method is an
  // `f64` under `--number-mode f64`, which `crypto_hmac_f64` runs these in.
  const start: i32 = 0;
  const nothing: i32 = 0;
  const truncated: i32 = 16;

  // --- RFC 4231 §4.2: Test Case 1 -------------------------------------------
  const key1: u8[] = repeated(0x0b, 20);
  const data1: u8[] = bytesOf("Hi There");
  t.eqStr(
    "HMAC-SHA-256, RFC 4231 test case 1",
    hexOf(hmacSha256(key1, data1)),
    "b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7"
  );
  t.eqStr(
    "HMAC-SHA-384, RFC 4231 test case 1",
    hexOf(hmacSha384(key1, data1)),
    "afd03944d84895626b0825f4ab46907f15f9dadbe4101ec682aa034c7cebc59cfaea9ea9076ede7f4af152e8b2fa9cb6"
  );

  // --- RFC 4231 §4.3: Test Case 2, a key shorter than the output ------------
  const key2: u8[] = bytesOf("Jefe");
  const data2: u8[] = bytesOf("what do ya want for nothing?");
  t.eqStr(
    "HMAC-SHA-256, RFC 4231 test case 2",
    hexOf(hmacSha256(key2, data2)),
    "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843"
  );
  t.eqStr(
    "HMAC-SHA-384, RFC 4231 test case 2",
    hexOf(hmacSha384(key2, data2)),
    "af45d2e376484031617f78d2b58a6b1b9c7ef464f5a01b47e42ec3736322445e8e2240ca5e69e2c78b3239ecfab21649"
  );

  // --- RFC 4231 §4.4: Test Case 3, key and data made of repeated bytes ------
  const key3: u8[] = repeated(0xaa, 20);
  const data3: u8[] = repeated(0xdd, 50);
  t.eqStr(
    "HMAC-SHA-256, RFC 4231 test case 3",
    hexOf(hmacSha256(key3, data3)),
    "773ea91e36800e46854db8ebd09181a72959098b3ef8c122d9635514ced565fe"
  );
  t.eqStr(
    "HMAC-SHA-384, RFC 4231 test case 3",
    hexOf(hmacSha384(key3, data3)),
    "88062608d3e6ad8a0aa2ace014c8a86f0aa635d947ac9febe83ef4e55966144b2a5ab39dc13814b94e3ab6e101a34f27"
  );

  // --- RFC 4231 §4.5: Test Case 4, the key 0x01 .. 0x19 ---------------------
  const key4: u8[] = counting(0x01, 0x1a);
  const data4: u8[] = repeated(0xcd, 50);
  t.eqStr(
    "HMAC-SHA-256, RFC 4231 test case 4",
    hexOf(hmacSha256(key4, data4)),
    "82558a389a443c0ea4cc819899f2083a85f0faa3e578f8077a2e3ff46729665b"
  );
  t.eqStr(
    "HMAC-SHA-384, RFC 4231 test case 4",
    hexOf(hmacSha384(key4, data4)),
    "3e8a69b7783c25851933ab6290af6ca77a9981480850009cc5577c6e1f573b4e6801dd23c4a7d679ccf8a386c674cffb"
  );

  // --- RFC 4231 §4.6: Test Case 5, truncated to 128 bits --------------------
  // The RFC prints only the first 128 bits, so that is all that is compared.
  const key5: u8[] = repeated(0x0c, 20);
  const data5: u8[] = bytesOf("Test With Truncation");
  t.eqStr(
    "HMAC-SHA-256, RFC 4231 test case 5 (first 128 bits)",
    hexOf(prefix(hmacSha256(key5, data5), truncated)),
    "a3b6167473100ee06e0c796c2955552b"
  );
  t.eqStr(
    "HMAC-SHA-384, RFC 4231 test case 5 (first 128 bits)",
    hexOf(prefix(hmacSha384(key5, data5), truncated)),
    "3abf34c3503b2a23a46efc619baef897"
  );

  // --- RFC 4231 §4.7: Test Case 6, a key longer than either block ----------
  const key6: u8[] = repeated(0xaa, 131);
  const data6: u8[] = bytesOf("Test Using Larger Than Block-Size Key - Hash Key First");
  t.eqStr(
    "HMAC-SHA-256, RFC 4231 test case 6 (131-byte key, hashed first)",
    hexOf(hmacSha256(key6, data6)),
    "60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54"
  );
  t.eqStr(
    "HMAC-SHA-384, RFC 4231 test case 6 (131-byte key, hashed first)",
    hexOf(hmacSha384(key6, data6)),
    "4ece084485813e9088d2c63a041bc5b44f9ef1012a2b588f3cd11f05033ac4c60c2ef6ab4030fe8296248df163f44952"
  );

  // --- RFC 4231 §4.8: Test Case 7, a long key and data longer than a block -
  const data7: u8[] = bytesOf(
    "This is a test using a larger than block-size key and a larger than block-size data. The key needs to be hashed before being used by the HMAC algorithm."
  );
  const tag7Sha256: string = "9b09ffa71b942fcb27635fbcd5b0e944bfdc63644f0713938a7f51535c3a35e2";
  const tag7Sha384: string =
    "6617178e941f020d351e2f254e8fd32c602420feb0b8fb9adccebb82461e99c5a678cc31e799176d3860e6110c46523e";
  t.eqStr("HMAC-SHA-256, RFC 4231 test case 7", hexOf(hmacSha256(key6, data7)), tag7Sha256);
  t.eqStr("HMAC-SHA-384, RFC 4231 test case 7", hexOf(hmacSha384(key6, data7)), tag7Sha384);

  // --- The block-size boundary of RFC 2104 §2 (checked against Python) -----
  // A key of exactly one block is padded, not hashed; one byte more is hashed.
  const boundaryData: u8[] = bytesOf("block-size key");
  t.eqStr(
    "HMAC-SHA-256 with a 64-byte key, used as it is (checked against Python)",
    hexOf(hmacSha256(counting(0, 64), boundaryData)),
    "1dad230598e011a4e4eabc6c8da8f55ef9a66a8881d1e16e23ea116ae28231ec"
  );
  t.eqStr(
    "HMAC-SHA-256 with a 65-byte key, hashed first (checked against Python)",
    hexOf(hmacSha256(counting(0, 65), boundaryData)),
    "d0b754c1861695b26bca3bd3a8581ef73f46ba28ada969cf73dbdb39d991eb2d"
  );
  t.eqStr(
    "HMAC-SHA-384 with a 128-byte key, used as it is (checked against Python)",
    hexOf(hmacSha384(counting(0, 128), boundaryData)),
    "0534177b30cf3f731c5e94f988d86dba6ca5e2496ac14e278e5bc62a7cb08b8cfe47b7e5884ab04bb5ceb3e6fde1dc08"
  );
  t.eqStr(
    "HMAC-SHA-384 with a 129-byte key, hashed first (checked against Python)",
    hexOf(hmacSha384(counting(0, 129), boundaryData)),
    "41b716fdc05cdbf749230caf91f627050721a28e40b90425a4df345942d10aacee2c122099f1ecd3be945871b8ae6a0e"
  );

  // --- Streaming ------------------------------------------------------------
  // Test case 7's 152 bytes of data span more than one SHA-256 block and more
  // than one SHA-384 block, so byte-at-a-time and 50-byte chunks both top up
  // a partial block before a whole one is compressed.
  t.eqStr("HMAC-SHA-256 of test case 7 fed one byte at a time", sha256InChunks(key6, data7, 1), tag7Sha256);
  t.eqStr("HMAC-SHA-256 of test case 7 fed in 50-byte chunks", sha256InChunks(key6, data7, 50), tag7Sha256);
  t.eqStr("HMAC-SHA-384 of test case 7 fed one byte at a time", sha384InChunks(key6, data7, 1), tag7Sha384);
  t.eqStr("HMAC-SHA-384 of test case 7 fed in 50-byte chunks", sha384InChunks(key6, data7, 50), tag7Sha384);
  // No update at all is the HMAC of the empty message; an empty window is a no-op.
  const empty: u8[] = [];
  const mac256 = new HmacSha256(key2);
  mac256.update(data2, start, nothing);
  t.eqStr(
    "HmacSha256 with only an empty window is the HMAC of nothing",
    hexOf(mac256.digest()),
    hexOf(hmacSha256(key2, empty))
  );
  const mac384 = new HmacSha384(key2);
  mac384.update(data2, start, nothing);
  t.eqStr(
    "HmacSha384 with only an empty window is the HMAC of nothing",
    hexOf(mac384.digest()),
    hexOf(hmacSha384(key2, empty))
  );

  // --- Verify ---------------------------------------------------------------
  const tag256: u8[] = hmacSha256(key2, data2);
  const tag384: u8[] = hmacSha384(key2, data2);
  t.eqBool("hmacSha256Verify accepts the right tag", hmacSha256Verify(key2, data2, tag256), true);
  t.eqBool("hmacSha256Verify refuses a one-bit flip", hmacSha256Verify(key2, data2, flipLastBit(tag256)), false);
  t.eqBool(
    "hmacSha256Verify refuses a truncated tag",
    hmacSha256Verify(key2, data2, prefix(tag256, truncated)),
    false
  );
  t.eqBool("hmacSha256Verify refuses the tag of other data", hmacSha256Verify(key2, data1, tag256), false);
  t.eqBool("hmacSha384Verify accepts the right tag", hmacSha384Verify(key2, data2, tag384), true);
  t.eqBool("hmacSha384Verify refuses a one-bit flip", hmacSha384Verify(key2, data2, flipLastBit(tag384)), false);
  t.eqBool(
    "hmacSha384Verify refuses a truncated tag",
    hmacSha384Verify(key2, data2, prefix(tag384, truncated)),
    false
  );
  t.eqBool("hmacSha384Verify refuses the tag of other data", hmacSha384Verify(key2, data1, tag384), false);

  // Each tag is a fresh array, so writing into one cannot change another.
  const first: u8[] = hmacSha256(key1, data1);
  const second: u8[] = hmacSha256(key1, data1);
  first[0] = toU8(0);
  t.eqStr(
    "each tag is a fresh array",
    hexOf(second),
    "b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7"
  );

  return t.done();
};
