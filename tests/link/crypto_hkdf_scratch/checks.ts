// The caller-owned scratch of `nish/crypto/hmac` and `nish/crypto/hkdf`
// against the published answers: RFC 4231 §4.2 and §4.7 for the HMAC scratch
// (a short key, and one longer than either block, which is hashed first), and
// RFC 5869 Appendix A (§A.1-§A.3) for `hkdfExtractInto` and `hkdfExpandInto`,
// with the SHA-384 answers `tests/link/crypto_hkdf` already checks against
// Python. Every key length from 0 to 199 bytes, across both block sizes, is
// held to the one-shot `hmacSha256` and `hmacSha384`, and HKDF-Expand-Label to
// `hkdfExpandLabelSha256` and `hkdfExpandLabelSha384`.
//
// What the scratch is for is the last part: a hundred derivations of every
// kind inside one `using a = arena()` block a pass — which the compiler
// refuses around the one-shot functions (NL2424) — leave `Arena.mark()`
// exactly where it was, and the scratch holds no key material afterwards.
import { Suite } from "nish/testing";
import {
  HmacSha256Scratch,
  HmacSha384Scratch,
  hmacCopySha256,
  hmacCopySha384,
  hmacSha256,
  hmacSha384,
} from "nish/crypto/hmac";
import {
  HkdfScratch,
  hkdfExpandInto,
  hkdfExpandLabelInto,
  hkdfExpandLabelSha256,
  hkdfExpandLabelSha384,
  hkdfExtractInto,
} from "nish/crypto/hkdf";
import { Sha256, sha256 } from "nish/crypto/sha256";
import { Sha384, sha384 } from "nish/crypto/sha512";

const HEX_DIGITS: string = "0123456789abcdef";

/** `bytes[off .. off + len)` as lowercase hex. */
const hexOf = (bytes: u8[], off: i32, len: i32): string => {
  const parts: string[] = [];
  for (let i: i32 = off; i < off + len && i >= 0 && i < toI32(bytes.length); i += 1) {
    const v: i32 = toI32(bytes[i]);
    parts.push(HEX_DIGITS.substring(v >> 4, (v >> 4) + 1));
    parts.push(HEX_DIGITS.substring(v & 15, (v & 15) + 1));
  }
  return parts.join("");
};

/** All of `bytes` as hex. */
const hexAll = (bytes: u8[]): string => hexOf(bytes, toI32(0), toI32(bytes.length));

/** The bytes of an ASCII string. */
const bytesOf = (text: string): u8[] => {
  const out: u8[] = [];
  for (let i: i32 = 0; i < toI32(text.length); i += 1) {
    out.push(toU8(text.charCodeAt(i)));
  }
  return out;
};

/** `n` copies of the byte `b`. */
const repeated = (b: i32, n: i32): u8[] => {
  const out: u8[] = new Array<u8>(n);
  for (let i: i32 = 0; i < toI32(out.length); i += 1) {
    out[i] = toU8(b);
  }
  return out;
};

/** The bytes `from, from + 1, …` below `to`: every salt, IKM and info of RFC 5869 Appendix A. */
const counting = (from: i32, to: i32): u8[] => {
  const out: u8[] = [];
  for (let v: i32 = from; v < to; v += 1) {
    out.push(toU8(v));
  }
  return out;
};

/** The first `n` bytes of `data`, copied. */
const prefix = (data: u8[], n: i32): u8[] => {
  const out: u8[] = new Array<u8>(n);
  for (let i: i32 = 0; i < n && i < toI32(data.length); i += 1) {
    out[i] = data[i];
  }
  return out;
};

/** Whether every byte of `bytes` is zero. */
const allZero = (bytes: u8[]): boolean => {
  for (const b of bytes) {
    if (toI32(b) !== 0) {
      return false;
    }
  }
  return true;
};

/** The HMAC-SHA-256 tag of `data` under `key` through `mac`, as hex. */
const tag256 = (mac: HmacSha256Scratch, key: u8[], data: u8[]): string => {
  const out: u8[] = new Array<u8>(32);
  mac.begin(key, toI32(0), toI32(key.length));
  mac.update(data, toI32(0), toI32(data.length));
  mac.finishInto(out, toI32(0));
  return hexAll(out);
};

/** The HMAC-SHA-384 tag of `data` under `key` through `mac`, as hex. */
const tag384 = (mac: HmacSha384Scratch, key: u8[], data: u8[]): string => {
  const out: u8[] = new Array<u8>(48);
  mac.begin(key, toI32(0), toI32(key.length));
  mac.update(data, toI32(0), toI32(data.length));
  mac.finishInto(out, toI32(0));
  return hexAll(out);
};

/** HKDF-Extract through the scratch, as hex. */
const extract = (s: HkdfScratch, hashLength: i32, salt: u8[], ikm: u8[]): string => {
  const out: u8[] = new Array<u8>(hashLength);
  hkdfExtractInto(s, hashLength, salt, ikm, out, toI32(0));
  return hexAll(out);
};

/** HKDF-Expand through the scratch, as hex, or "false" for a refusal. */
const expand = (s: HkdfScratch, hashLength: i32, prk: u8[], info: u8[], length: i32): string => {
  const out: u8[] = new Array<u8>(length < 0 ? toI32(0) : length);
  return hkdfExpandInto(s, hashLength, prk, info, out, toI32(0), length) ? hexAll(out) : "false";
};

/** Runs every check and answers the exit code; `crypto_hkdf_scratch_f64` runs them under `--number-mode f64`. */
export const hkdfScratchChecks = (): i32 => {
  const t = new Suite("hkdf scratch");
  const zero: i32 = 0;
  const h256: i32 = 32;
  const h384: i32 = 48;
  const none: u8[] = [];
  const mac256 = new HmacSha256Scratch();
  const mac384 = new HmacSha384Scratch();
  const kdf = new HkdfScratch();

  // --- The HMAC scratch, RFC 4231 -------------------------------------------
  const key1: u8[] = repeated(0x0b, 20);
  const data1: u8[] = bytesOf("Hi There");
  t.eqStr("HmacSha256Scratch, RFC 4231 test case 1", tag256(mac256, key1, data1), "b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7");
  t.eqStr(
    "HmacSha384Scratch, RFC 4231 test case 1",
    tag384(mac384, key1, data1),
    "afd03944d84895626b0825f4ab46907f15f9dadbe4101ec682aa034c7cebc59cfaea9ea9076ede7f4af152e8b2fa9cb6"
  );
  const key6: u8[] = repeated(0xaa, 131);
  const data6: u8[] = bytesOf("Test Using Larger Than Block-Size Key - Hash Key First");
  t.eqStr(
    "HmacSha256Scratch, RFC 4231 test case 6 (131-byte key, hashed first)",
    tag256(mac256, key6, data6),
    "60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54"
  );
  t.eqStr(
    "HmacSha384Scratch, RFC 4231 test case 6 (131-byte key, hashed first)",
    tag384(mac384, key6, data6),
    "4ece084485813e9088d2c63a041bc5b44f9ef1012a2b588f3cd11f05033ac4c60c2ef6ab4030fe8296248df163f44952"
  );
  // A key window: the same 20 bytes of 0x0b, found in the middle of a longer array.
  const framed: u8[] = [toU8(1), toU8(2)];
  for (const b of key1) {
    framed.push(b);
  }
  framed.push(toU8(3));
  const windowed: u8[] = new Array<u8>(40);
  mac256.begin(framed, toI32(2), toI32(20));
  mac256.update(data1, zero, toI32(data1.length));
  mac256.finishInto(windowed, toI32(8));
  t.eqStr("a key window and a tag window at an offset give the same tag", hexOf(windowed, toI32(8), h256), tag256(mac256, key1, data1));

  // Every key length across both block sizes, against the one-shot functions.
  const longKey: u8[] = counting(0, 200);
  const message: u8[] = counting(7, 84);
  let mismatches: i32 = 0;
  for (let n: i32 = 0; n < 200; n += 1) {
    const key: u8[] = prefix(longKey, n);
    if (tag256(mac256, key, message) !== hexAll(hmacSha256(key, message))) {
      mismatches += 1;
    }
    if (tag384(mac384, key, message) !== hexAll(hmacSha384(key, message))) {
      mismatches += 1;
    }
  }
  t.eqI32("keys of 0 to 199 bytes give the one-shot functions' tags, under both hashes", mismatches, zero);

  // --- The hasher copies -----------------------------------------------------
  const running256 = new Sha256();
  running256.update(message, zero, toI32(message.length));
  const twin256 = new Sha256();
  hmacCopySha256(running256, twin256);
  t.eqStr("hmacCopySha256 makes a hasher at the same point", hexAll(twin256.digest()), hexAll(sha256(message)));
  hmacCopySha256(new Sha256(), twin256);
  t.eqStr("and copying a fresh one starts it again", hexAll(twin256.digest()), hexAll(sha256(none)));
  const running384 = new Sha384();
  running384.update(message, zero, toI32(message.length));
  const twin384 = new Sha384();
  hmacCopySha384(running384, twin384);
  t.eqStr("hmacCopySha384 makes a hasher at the same point", hexAll(twin384.digest()), hexAll(sha384(message)));
  hmacCopySha384(new Sha384(), twin384);
  t.eqStr("and copying a fresh one starts it again", hexAll(twin384.digest()), hexAll(sha384(none)));

  // --- HKDF, RFC 5869 Appendix A ----------------------------------------------
  const ikm1: u8[] = repeated(0x0b, 22);
  const salt1: u8[] = counting(0x00, 0x0d);
  const info1: u8[] = counting(0xf0, 0xfa);
  const prk1: u8[] = new Array<u8>(h256);
  hkdfExtractInto(kdf, h256, salt1, ikm1, prk1, zero);
  t.eqStr("RFC 5869 A.1 PRK", hexAll(prk1), "077709362c2e32df0ddc3f0dc47bba6390b6c73bb50f9c3122ec844ad7c2b3e5");
  t.eqStr(
    "RFC 5869 A.1 OKM (42 bytes, ending mid-block)",
    expand(kdf, h256, prk1, info1, toI32(42)),
    "3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865"
  );
  const ikm2: u8[] = counting(0x00, 0x50);
  const salt2: u8[] = counting(0x60, 0xb0);
  const info2: u8[] = counting(0xb0, 0x100);
  const prk2: u8[] = new Array<u8>(h256);
  hkdfExtractInto(kdf, h256, salt2, ikm2, prk2, zero);
  t.eqStr("RFC 5869 A.2 PRK", hexAll(prk2), "06a6b88c5853361a06104c9ceb35b45cef760014904671014a193f40c15fc244");
  t.eqStr(
    "RFC 5869 A.2 OKM (82 bytes, three blocks)",
    expand(kdf, h256, prk2, info2, toI32(82)),
    "b11e398dc80327a1c8e7f78c596a49344f012eda2d4efad8a050cc4c19afa97c59045a99cac7827271cb41c65e590e09da3275600c2f09b8367793a9aca3db71cc30c58179ec3e87c14c01d5c1f3434f1d87"
  );
  t.eqStr("RFC 5869 A.3 PRK (empty salt)", extract(kdf, h256, none, ikm1), "19ef24a32c717b167f33a91d6f648bdf96596776afdb6377ac434c1c293ccb04");
  t.eqStr(
    "A.1's inputs, HKDF-SHA-384 PRK",
    extract(kdf, h384, salt1, ikm1),
    "704b39990779ce1dc548052c7dc39f303570dd13fb39f7acc564680bef80e8dec70ee9a7e1f3e293ef68eceb072a5ade"
  );
  const prk2Sha384: u8[] = new Array<u8>(h384);
  hkdfExtractInto(kdf, h384, salt2, ikm2, prk2Sha384, zero);
  t.eqStr(
    "A.2's inputs, HKDF-SHA-384 OKM (82 bytes, two blocks)",
    expand(kdf, h384, prk2Sha384, info2, toI32(82)),
    "484ca052b8cc724fd1c4ec64d57b4e818c7e25a8e0f4569ed72a6a05fe0649eebf69f8d5c832856bf4e4fbc17967d54975324a94987f7f41835817d8994fdbd6f4c09c5500dca24a56222fea53d8967a8b2e"
  );
  t.eqStr(
    "A.3's inputs, HKDF-SHA-384 PRK (empty salt)",
    extract(kdf, h384, none, ikm1),
    "10e40cf072a4c5626e43dd22c1cf727d4bb140975c9ad0cbc8e45b40068f8f0ba57cdb598af9dfa6963a96899af047e5"
  );
  const atOffset: u8[] = new Array<u8>(50);
  t.ok("an expand into a window at an offset", hkdfExpandInto(kdf, h256, prk1, info1, atOffset, toI32(8), toI32(42)));
  t.eqStr("writes there and nowhere else", `${hexOf(atOffset, zero, toI32(8))} ${hexOf(atOffset, toI32(8), toI32(42))}`, `0000000000000000 ${expand(kdf, h256, prk1, info1, toI32(42))}`);

  // §2.3's limits, answered `false` where the one-shot functions answer null.
  t.eqI32("8160 bytes, 255 * 32, are made", toI32(expand(kdf, h256, prk1, info1, toI32(8160)).length), toI32(16320));
  t.eqStr("8161 are refused", expand(kdf, h256, prk1, info1, toI32(8161)), "false");
  t.eqStr("12241 are refused under SHA-384", expand(kdf, h384, prk2Sha384, info1, toI32(12241)), "false");
  t.eqStr("so is a negative length", expand(kdf, h256, prk1, info1, toI32(-1)), "false");
  t.eqStr("and a PRK shorter than HashLen", expand(kdf, h384, prk1, info1, toI32(16)), "false");
  t.eqStr("zero bytes are an empty answer", expand(kdf, h256, prk1, info1, zero), "");

  // --- HKDF-Expand-Label, against the one-shot functions ----------------------
  const context: u8[] = counting(0x40, 0x70);
  const labelled: u8[] = new Array<u8>(h384);
  hkdfExpandLabelInto(kdf, h256, prk1, "c hs traffic", context, toI32(3), h256, labelled, zero, h256);
  t.eqStr(
    "hkdfExpandLabelInto with a context window is hkdfExpandLabelSha256",
    hexOf(labelled, zero, h256),
    hexAll(hkdfExpandLabelSha256(prk1, "c hs traffic", prefix(counting(0x43, 0x70), h256), h256))
  );
  hkdfExpandLabelInto(kdf, h384, prk2Sha384, "key", none, zero, zero, labelled, toI32(16), toI32(32));
  t.eqStr("and with no context is hkdfExpandLabelSha384", hexOf(labelled, toI32(16), toI32(32)), hexAll(hkdfExpandLabelSha384(prk2Sha384, "key", none, toI32(32))));

  // --- What the scratch is for: nothing outlives a derivation -----------------
  const out: u8[] = new Array<u8>(256);
  const before: i64 = Arena.mark();
  for (let pass: i32 = 0; pass < 100; pass += 1) {
    using a = arena();
    mac256.begin(key6, zero, toI32(key6.length));
    mac256.update(message, zero, toI32(message.length));
    mac256.finishInto(out, zero);
    mac384.begin(key6, zero, toI32(key6.length));
    mac384.update(message, zero, toI32(message.length));
    mac384.finishInto(out, zero);
    hkdfExtractInto(kdf, h384, salt2, ikm2, out, zero);
    hkdfExpandInto(kdf, h256, prk1, info2, out, zero, toI32(200));
    hkdfExpandLabelInto(kdf, h384, prk2Sha384, "s ap traffic", context, zero, h384, out, zero, h384);
  }
  t.ok("a hundred passes of every kind inside `using a = arena()` leave Arena.mark() where it was", Arena.mark() === before);
  t.ok("and HKDF wipes its last block and the keyed hashers it used before it returns", allZero(kdf.previous) && allZero(kdf.sha256.inner.block) && allZero(kdf.sha384.outer.engine.block));
  mac256.wipe();
  mac384.wipe();
  t.ok("an HMAC scratch's wipe zeroes its hashers", mac256.inner.state[0] === toU32(0) && mac384.outer.engine.state[7] === toU64(0) && mac384.inner.engine.finished);
  return t.done();
};
