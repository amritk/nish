// The DER reader the Wycheproof cases need, and only that: an ECDSA signature
// is `SEQUENCE { INTEGER r, INTEGER s }` (RFC 3279 §2.2.3), and
// `nish/crypto/p256` takes `r || s`. DER belongs to the X.509 module that comes
// later, so this lives in the test rather than the library.
//
// It is strict on purpose, because about a hundred of the invalid cases are
// the right `r` and `s` in a wrong encoding — a long-form length, a leading
// zero too many, a negative integer, bytes after the sequence — and each must
// be refused somewhere. A signature is at most 72 bytes, so every length is
// short-form, and a long-form one is non-minimal and refused.

/** One DER length-prefixed element: the tag, where its contents start, and how long they are. */
interface DerElement {
  tag: i32;
  start: i32;
  length: i32;
}

/** The element at `at`, or `null` when its header or contents run past `end` or its length is not short-form. */
const derElement = (der: u8[], at: i32, end: i32): DerElement | null => {
  const total: i32 = toI32(der.length);
  if (at < 0 || at + 2 > end || end > total) {
    return null;
  }
  const length: i32 = toI32(der[at + 1]);
  if (length >= 0x80 || at + 2 + length > end) {
    return null;
  }
  // Bound first rather than returned directly: an object literal where
  // `DerElement | null` is expected crashes the emitter (issue #330).
  const e: DerElement = { tag: toI32(der[at]), start: at + 2, length: length };
  return e;
};

/**
 * An INTEGER's contents as 32 big-endian bytes at `out[off .. off + 32)`, or
 * `false` when it is not a minimal, non-negative integer that fits. A single
 * leading zero is allowed only in front of a byte with its top bit set.
 */
const derUnsigned = (der: u8[], e: DerElement, out: u8[], off: i32): boolean => {
  if (e.tag !== 0x02 || e.length < 1) {
    return false;
  }
  let start: i32 = e.start;
  let length: i32 = e.length;
  if (toI32(der[start]) >= 0x80) {
    return false;
  }
  if (length > 1 && toI32(der[start]) === 0) {
    if (toI32(der[start + 1]) < 0x80) {
      return false;
    }
    start = start + 1;
    length = length - 1;
  }
  if (length > 32) {
    return false;
  }
  for (let i: i32 = 0; i < length; i++) {
    out[off + 32 - length + i] = der[start + i];
  }
  return true;
};

/** `r || s` out of a DER `ECDSA-Sig-Value`, or `null` for anything that is not exactly one. */
export const derSignature = (der: u8[]): u8[] | null => {
  const total: i32 = toI32(der.length);
  const seq: DerElement | null = derElement(der, 0, total);
  if (seq === null || seq.tag !== 0x30 || seq.start + seq.length !== total) {
    return null;
  }
  const end: i32 = seq.start + seq.length;
  const r: DerElement | null = derElement(der, seq.start, end);
  if (r === null) {
    return null;
  }
  const s: DerElement | null = derElement(der, r.start + r.length, end);
  if (s === null || s.start + s.length !== end) {
    return null;
  }
  const out: u8[] = new Array<u8>(64);
  if (!derUnsigned(der, r, out, 0) || !derUnsigned(der, s, out, 32)) {
    return null;
  }
  return out;
};
