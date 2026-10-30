// SHA-256 and HMAC-SHA-256 against published answers, through whichever block
// path this process takes: runtime-sha256.c's kernel on a CPU with SHA-NI or
// the ARMv8 SHA-256 instructions, std/crypto/sha256.ts's `sha256Compress`
// otherwise or under `NISH_SHA256=soft`. tests/run.js's "sha256 kernel" section
// runs it both ways and holds both to `expected.out`, which is the published
// values.
//
// The digests are FIPS 180-4's examples (NIST's "Examples with Intermediate
// Values", SHA-256: "abc" and the 448-bit two-block message), the empty
// message, and the NIST CAVP long messages (the 896-bit message and a million
// 'a's). The tags are RFC 4231 §4.2-§4.8, test cases 1 to 7, HMAC-SHA-256;
// case 5 is truncated to 128 bits as the RFC gives it. Each also checks
// `hmacSha256Verify` both ways, so a tag the verifier would accept wrongly
// shows here too.
import { sha256 } from "nish/crypto/sha256";
import { hmacSha256, hmacSha256Verify } from "nish/crypto/hmac";

const HEX_DIGITS: string = "0123456789abcdef";

const hexOf = (bytes: u8[]): string => {
  const parts: string[] = [];
  for (const b of bytes) {
    const v: i32 = toI32(b);
    parts.push(HEX_DIGITS.substring(v >> 4, (v >> 4) + 1));
    parts.push(HEX_DIGITS.substring(v & 15, (v & 15) + 1));
  }
  return parts.join("");
};

const bytesOf = (text: string): u8[] => {
  const out: u8[] = [];
  const n: i32 = toI32(text.length);
  for (let i: i32 = 0; i < n; i += 1) {
    out.push(toU8(text.charCodeAt(i)));
  }
  return out;
};

/** `n` copies of the byte `b`. */
const run = (b: i32, n: i32): u8[] => {
  const out: u8[] = [];
  for (let i: i32 = 0; i < n; i += 1) {
    out.push(toU8(b));
  }
  return out;
};

/** The bytes `from .. to` inclusive, as RFC 4231 case 4's key is given. */
const span = (from: i32, to: i32): u8[] => {
  const out: u8[] = [];
  for (let b: i32 = from; b <= to; b += 1) {
    out.push(toU8(b));
  }
  return out;
};

const digest = (name: string, msg: u8[]): void => {
  console.log(`sha256 ${name}: ${hexOf(sha256(msg))}`);
};

/** The first `bytes` of the tag, printed; then verify the whole tag, and refuse it with its last bit flipped. */
const tag = (name: string, key: u8[], data: u8[], bytes: i32): void => {
  const t: u8[] = hmacSha256(key, data);
  const shown: u8[] = [];
  for (let i: i32 = 0; i < bytes; i += 1) {
    shown.push(t[i]);
  }
  const bad: u8[] = hmacSha256(key, data);
  bad[31] = toU8(toI32(bad[31]) ^ 1);
  const verdict: string = hmacSha256Verify(key, data, t) && !hmacSha256Verify(key, data, bad) ? "verifies" : "VERIFY WRONG";
  console.log(`hmac-sha256 ${name}: ${hexOf(shown)} ${verdict}`);
};

export const main = (): i32 => {
  digest("empty", []);
  digest("abc", bytesOf("abc"));
  digest("448 bits", bytesOf("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"));
  digest(
    "896 bits",
    bytesOf(
      "abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu"
    )
  );
  digest("a million a", run(97, 1000000));

  tag("case 1", run(0x0b, 20), bytesOf("Hi There"), 32);
  tag("case 2", bytesOf("Jefe"), bytesOf("what do ya want for nothing?"), 32);
  tag("case 3", run(0xaa, 20), run(0xdd, 50), 32);
  tag("case 4", span(0x01, 0x19), run(0xcd, 50), 32);
  tag("case 5", run(0x0c, 20), bytesOf("Test With Truncation"), 16);
  tag("case 6", run(0xaa, 131), bytesOf("Test Using Larger Than Block-Size Key - Hash Key First"), 32);
  tag(
    "case 7",
    run(0xaa, 131),
    bytesOf(
      "This is a test using a larger than block-size key and a larger than block-size data. The key needs to be hashed before being used by the HMAC algorithm."
    ),
    32
  );
  return 0;
};
