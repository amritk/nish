// `nish/crypto/sha256` against the published answers. Every digest below is a
// vector from FIPS 180-4's own examples (NIST's "Examples with Intermediate
// Values", SHA-256) or from NIST CAVP's `SHA256ShortMsg.rsp` (byte-oriented,
// CAVS 11.0), cited beside it — except the two marked otherwise, which
// are longer than any short-message vector and were checked against OpenSSL.
//
// The one-shot vectors pin the arithmetic. The lengths 55, 56, 63, 64 and 65
// pin the padding of §5.1.1, which is where a SHA-256 goes wrong: 55 bytes is
// the longest message whose padding fits in its own block, 56 the shortest that
// needs a second one, and 64 and 65 put the padding in a block of its own and
// then after a whole one. The streaming checks pin `update` and `copy`: the
// digest may not depend on where a message was cut, and a copy is a second
// hasher, not a view of the first.
import { Suite } from "nish/testing";
import { SHA256_BLOCK, SHA256_SIZE, Sha256, sha256 } from "nish/crypto/sha256";

const HEX_DIGITS: string = "0123456789abcdef";

/** `bytes` as lowercase hex, two digits a byte, the way the vectors print them. */
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

/** The value of one lowercase hex digit. The vectors are fixtures, so anything else is a typo here. */
const hexDigit = (c: i32): i32 => {
  if (c >= 48 && c <= 57) {
    return c - 48;
  }
  if (c >= 97 && c <= 102) {
    return c - 87;
  }
  panic("crypto_sha256: not a hex digit in a fixture");
};

/** The bytes a hex string spells, for the CAVP messages, which are given in hex. */
const fromHex = (hex: string): u8[] => {
  const out: u8[] = [];
  const n: i32 = toI32(hex.length);
  for (let i: i32 = 0; i < n; i += 2) {
    out.push(toU8(hexDigit(toI32(hex.charCodeAt(i))) * 16 + hexDigit(toI32(hex.charCodeAt(i + 1)))));
  }
  return out;
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

/** `n` copies of the byte `b`. */
const repeated = (b: u8, n: i32): u8[] => {
  const out: u8[] = new Array<u8>(n);
  const outLength: i32 = toI32(out.length);
  for (let i: i32 = 0; i < outLength; i += 1) {
    out[i] = b;
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

/** The digest of `data` fed as `data[0 .. cut)` then `data[cut ..)`. */
const digestSplitAt = (data: u8[], cut: i32): string => {
  const h: Sha256 = new Sha256();
  const start: i32 = 0;
  h.update(data, start, cut);
  h.update(data, cut, toI32(data.length) - cut);
  return hexOf(h.digest());
};

/**
 * Whether cutting `data` at every point from 0 to its length gives `expected`.
 * Answers the first cut that does not, or -1, so the failure names the cut.
 */
const firstBadSplit = (data: u8[], expected: string): i32 => {
  const n: i32 = toI32(data.length);
  for (let cut: i32 = 0; cut <= n; cut += 1) {
    if (digestSplitAt(data, cut) !== expected) {
      return cut;
    }
  }
  return -1;
};

/** The digest of `data` fed in chunks of `chunk` bytes, the last one short. */
const digestInChunks = (data: u8[], chunk: i32): string => {
  const h: Sha256 = new Sha256();
  const n: i32 = toI32(data.length);
  let at: i32 = 0;
  while (at < n) {
    const take: i32 = n - at < chunk ? n - at : chunk;
    h.update(data, at, take);
    at += take;
  }
  return hexOf(h.digest());
};

/**
 * Whether a `copy()` taken after every prefix of `data` digests that prefix,
 * while the original, fed the rest, still digests all of `data`. Answers the
 * first prefix length at which either half is wrong, or -1.
 */
const firstBadCopy = (data: u8[], expected: string): i32 => {
  const n: i32 = toI32(data.length);
  const start: i32 = 0;
  for (let cut: i32 = 0; cut <= n; cut += 1) {
    // Each pass allocates two hashers and their digests, and nothing of them
    // outlives the pass, so the pass gives the memory back.
    const mark: i64 = Arena.mark();
    const h: Sha256 = new Sha256();
    h.update(data, start, cut);
    const twin: Sha256 = h.copy();
    // Feed the original before digesting the copy, so a copy that shared the
    // original's buffers would see the rest of the message and fail.
    h.update(data, cut, n - cut);
    const good: boolean =
      hexOf(twin.digest()) === hexOf(sha256(prefix(data, cut))) && hexOf(h.digest()) === expected;
    Arena.release(mark);
    if (!good) {
      return cut;
    }
  }
  return -1;
};

/**
 * Runs every check and answers the exit code. A function of its own rather
 * than the body of `main`, so that `tests/link/crypto_sha256_f64` can run the
 * same checks under `--number-mode f64`.
 */
export const sha256Checks = (): i32 => {
  const t = new Suite("sha256");
  // Typed locals rather than bare literals: a literal passed to a method is an
  // `f64` under `--number-mode f64`, and `tests/link/crypto_sha256_f64` runs
  // these same checks in that mode.
  const none: i32 = -1;
  const digestBytes: i32 = 32;
  const blockBytes: i32 = 64;

  t.eqI32("SHA256_SIZE is 32 bytes (FIPS 180-4 §1)", SHA256_SIZE, digestBytes);
  t.eqI32("SHA256_BLOCK is 64 bytes (FIPS 180-4 §1)", SHA256_BLOCK, blockBytes);

  // --- FIPS 180-4 examples --------------------------------------------------
  // The empty message; also CAVP SHA256ShortMsg Len = 0.
  const empty: u8[] = [];
  t.eqStr(
    "empty message (CAVP ShortMsg Len = 0)",
    hexOf(sha256(empty)),
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  );
  // FIPS 180-4 examples, SHA-256 "One-Block Message Sample": "abc".
  t.eqStr(
    "\"abc\" (FIPS 180-4 example, one block)",
    hexOf(sha256(bytesOf("abc"))),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
  );
  // FIPS 180-4 examples, SHA-256 "Two-Block Message Sample": the 448-bit message.
  const msg448: u8[] = bytesOf("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq");
  t.eqStr(
    "the 448-bit message (FIPS 180-4 example, two blocks)",
    hexOf(sha256(msg448)),
    "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1"
  );
  // FIPS 180-4 examples (SHA-512's two-block message, and the 896-bit message
  // of the SHA-2 additional examples), hashed with SHA-256.
  const msg896: u8[] = bytesOf(
    "abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu"
  );
  t.eqStr(
    "the 896-bit message (FIPS 180-4 additional example)",
    hexOf(sha256(msg896)),
    "cf5b16a778af8380036ce59e7b0492370b249b11e8f07a51afac45037afee9d1"
  );
  // FIPS 180-4 additional examples: one million repetitions of "a".
  const million: u8[] = repeated(toU8(97), 1000000);
  const millionDigest: string = "cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0";
  t.eqStr("one million \"a\" (FIPS 180-4 additional example)", hexOf(sha256(million)), millionDigest);
  t.eqStr("one million \"a\" in 997-byte chunks", digestInChunks(million, 997), millionDigest);

  // --- NIST CAVP SHA256ShortMsg: short messages and the padding boundaries --
  t.eqStr(
    "one byte (CAVP ShortMsg Len = 8)",
    hexOf(sha256(fromHex("d3"))),
    "28969cdfa74a12c82f3bad960b0b000aca2ac329deea5c2328ebc6f2ba9802c1"
  );
  t.eqStr(
    "three bytes (CAVP ShortMsg Len = 24)",
    hexOf(sha256(fromHex("b4190e"))),
    "dff2e73091f6c05e528896c4c831b9448653dc2ff043528f6769437bc7b975c2"
  );
  // 55 bytes: 0x80 and the 8-byte length fill the block exactly.
  t.eqStr(
    "55 bytes, the longest one-block padding (CAVP ShortMsg Len = 440)",
    hexOf(
      sha256(
        fromHex(
          "3ebfb06db8c38d5ba037f1363e118550aad94606e26835a01af05078533cc25f2f39573c04b632f62f68c294ab31f2a3e2a1a0d8c2be51"
        )
      )
    ),
    "6595a2ef537a69ba8583dfbf7f5bec0ab1f93ce4c8ee1916eff44a93af5749c4"
  );
  // 56 bytes: the length no longer fits, so the padding spills into a second block.
  t.eqStr(
    "56 bytes, the shortest two-block padding (CAVP ShortMsg Len = 448)",
    hexOf(
      sha256(
        fromHex(
          "2d52447d1244d2ebc28650e7b05654bad35b3a68eedc7f8515306b496d75f3e73385dd1b002625024b81a02f2fd6dffb6e6d561cb7d0bd7a"
        )
      )
    ),
    "cfb88d6faf2de3a69d36195acec2e255e2af2b7d933997f348e09f6ce5758360"
  );
  // 63 bytes: only the 0x80 byte fits after the message.
  t.eqStr(
    "63 bytes, one byte short of a block (CAVP ShortMsg Len = 504)",
    hexOf(
      sha256(
        fromHex(
          "e2f76e97606a872e317439f1a03fcd92e632e5bd4e7cbc4e97f1afc19a16fde92d77cbe546416b51640cddb92af996534dfd81edb17c4424cf1ac4d75aceeb"
        )
      )
    ),
    "18041bd4665083001fba8c5411d2d748e8abbfdcdfd9218cb02b68a78e7d4c23"
  );
  // 64 bytes: one whole block, then a block that is all padding.
  const block64: u8[] = fromHex(
    "5a86b737eaea8ee976a0a24da63e7ed7eefad18a101c1211e2b3650c5187c2a8a650547208251f6d4237e661c7bf4c77f335390394c37fa1a9f9be836ac28509"
  );
  t.eqStr(
    "64 bytes, exactly one block (CAVP ShortMsg Len = 512)",
    hexOf(sha256(block64)),
    "42e61e174fbb3897d6dd6cef3dd2802fe67b331953b06114a65c772859dfc1aa"
  );
  // 65 bytes is past the end of SHA256ShortMsg (which stops at one block) and
  // short of SHA256LongMsg (which starts at 163 bytes), so this digest is the
  // one marked in the header: the 64-byte CAVP message with a 0x00 appended,
  // checked against OpenSSL.
  const block65: u8[] = prefix(block64, 64);
  block65.push(0);
  t.eqStr(
    "65 bytes, one byte into a second block (checked against OpenSSL)",
    hexOf(sha256(block65)),
    "1046b893c1737d3c59b8da34874c48cd912ac9dbb88b070efb902345ab19c03e"
  );

  // --- Streaming ------------------------------------------------------------
  // Every cut of the 896-bit message: a cut inside the first block, at its
  // end, and inside the second, each topping up a partial block differently.
  t.eqI32(
    "the 896-bit message gives one digest wherever it is cut in two",
    firstBadSplit(msg896, "cf5b16a778af8380036ce59e7b0492370b249b11e8f07a51afac45037afee9d1"),
    none
  );
  // 300 bytes is four whole blocks and a tail, so a cut near the start tops up
  // a partial block and then compresses whole blocks straight from the
  // caller's buffer. Its digest is the second one checked against OpenSSL.
  const pattern: u8[] = new Array<u8>(300);
  for (let i: i32 = 0; i < 300; i += 1) {
    pattern[i] = toU8((i * 7 + 3) % 251);
  }
  const patternDigest: string = "36da72897e604580cf2b86856c904efddc5f84d90fa1766492cf6ccf35b97ddc";
  t.eqStr("300 bytes of (7i + 3) mod 251 (checked against OpenSSL)", hexOf(sha256(pattern)), patternDigest);
  t.eqI32("300 bytes give one digest wherever they are cut in two", firstBadSplit(pattern, patternDigest), none);
  t.eqStr("300 bytes fed one byte at a time", digestInChunks(pattern, 1), patternDigest);
  t.eqStr("the 448-bit message fed one byte at a time", digestInChunks(msg448, 1), hexOf(sha256(msg448)));

  // An empty window changes nothing, at the start, in the middle and at the end.
  const h: Sha256 = new Sha256();
  const start: i32 = 0;
  const nothing: i32 = 0;
  const cut: i32 = 20;
  const rest: i32 = 36;
  const whole: i32 = 56;
  h.update(msg448, start, nothing);
  h.update(msg448, start, cut);
  h.update(msg448, cut, nothing);
  h.update(msg448, cut, rest);
  h.update(msg448, whole, nothing);
  t.eqStr(
    "empty windows are no-ops, even at the end of the buffer",
    hexOf(h.digest()),
    "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1"
  );

  // --- copy -----------------------------------------------------------------
  t.eqI32(
    "a copy after every prefix digests the prefix and leaves the original alone",
    firstBadCopy(pattern, patternDigest),
    none
  );
  // The transcript-hash shape: digest a copy, keep feeding the original, and
  // take another copy later.
  const transcript: Sha256 = new Sha256();
  const abc: i32 = 3;
  const afterAbcLength: i32 = 109;
  transcript.update(msg896, start, abc);
  const afterAbc: string = hexOf(transcript.copy().digest());
  transcript.update(msg896, abc, afterAbcLength);
  const afterAll: string = hexOf(transcript.copy().digest());
  t.eqStr(
    "a copy of a hasher that has seen \"abc\" digests \"abc\"",
    afterAbc,
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
  );
  t.eqStr(
    "a second copy, later, digests everything fed since",
    afterAll,
    "cf5b16a778af8380036ce59e7b0492370b249b11e8f07a51afac45037afee9d1"
  );
  t.eqStr("and the original still digests the same", hexOf(transcript.digest()), afterAll);

  // A digest is a fresh array each time, so writing into one cannot change another.
  const first: u8[] = sha256(empty);
  const second: u8[] = sha256(empty);
  first[0] = 0;
  t.eqStr(
    "each digest is a fresh array",
    hexOf(second),
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  );
  t.eqI32("a digest is SHA256_SIZE bytes long", toI32(second.length), SHA256_SIZE);

  return t.done();
};
