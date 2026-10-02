// The verifiers take a tag from the wire, so what they refuse matters as much
// as what they accept. `tests/link/crypto_hmac` holds a one-bit flip, a
// truncated tag and another message's tag; this adds the rest of the ways a
// received tag can have the wrong length — longer with the right prefix, empty,
// a single byte — and a flip at every position, so that a compare that
// stopped reading early, or checked a prefix, would show.
import { hmacSha256, hmacSha256Verify, hmacSha384, hmacSha384Verify } from "nish/crypto/hmac";
import { Suite } from "nish/testing";

/** A fresh copy of `bytes`. */
const hmacCopy = (bytes: u8[]): u8[] => {
  const out: u8[] = [];
  for (const b of bytes) {
    out.push(b);
  }
  return out;
};

/** `bytes` with `extra` appended. */
const hmacLonger = (bytes: u8[], extra: i32): u8[] => {
  const out: u8[] = hmacCopy(bytes);
  out.push(toU8(extra));
  return out;
};

/** How many single-bit flips of `tag` the verifier still accepts: SHA-384's when `wide`, else SHA-256's. */
const acceptedFlips = (key: u8[], data: u8[], tag: u8[], wide: boolean): i32 => {
  let n: i32 = 0;
  for (let at: i32 = 0; at < toI32(tag.length); at++) {
    for (let bit: i32 = 0; bit < 8; bit++) {
      const other: u8[] = hmacCopy(tag);
      other[at] = toU8(toI32(other[at]) ^ (1 << bit));
      if (wide ? hmacSha384Verify(key, data, other) : hmacSha256Verify(key, data, other)) {
        n++;
      }
    }
  }
  return n;
};

export const verifyChecks = (): i32 => {
  const t = new Suite("hmac k1 verify");
  const key: u8[] = [toU8(0x4a), toU8(0x65), toU8(0x66), toU8(0x65)];
  const data: u8[] = [toU8(0x77), toU8(0x68), toU8(0x61), toU8(0x74)];
  const tag256: u8[] = hmacSha256(key, data);
  const tag384: u8[] = hmacSha384(key, data);
  const none: i32 = 0;
  const zeroByte: i32 = 0;
  t.eqBool("sha256: the tag verifies", hmacSha256Verify(key, data, tag256), true);
  t.eqBool("sha256: the tag and one more byte is refused", hmacSha256Verify(key, data, hmacLonger(tag256, zeroByte)), false);
  t.eqBool("sha256: an empty tag is refused", hmacSha256Verify(key, data, []), false);
  t.eqBool("sha256: a one-byte tag is refused", hmacSha256Verify(key, data, [tag256[0]]), false);
  t.eqBool("sha256: the SHA-384 tag is refused", hmacSha256Verify(key, data, tag384), false);
  t.eqI32("sha256: none of the 256 single-bit flips verifies", acceptedFlips(key, data, tag256, false), none);
  t.eqBool("sha384: the tag verifies", hmacSha384Verify(key, data, tag384), true);
  t.eqBool("sha384: the tag and one more byte is refused", hmacSha384Verify(key, data, hmacLonger(tag384, zeroByte)), false);
  t.eqBool("sha384: an empty tag is refused", hmacSha384Verify(key, data, []), false);
  t.eqBool("sha384: the SHA-256 tag is refused", hmacSha384Verify(key, data, tag256), false);
  t.eqI32("sha384: none of the 384 single-bit flips verifies", acceptedFlips(key, data, tag384, true), none);
  return t.done();
};
