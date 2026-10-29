// The DER signature reader the P-384 Wycheproof run uses: `nish/crypto/p384`
// takes `r || s`, and the module that reads DER for P-256
// (`x509DerSignatureRS` in `nish/crypto/x509`) answers 32-byte halves. This
// one answers 48-byte halves and is just as strict: one definite, minimal
// length per element, both integers minimal and positive, and nothing after
// the sequence.

/** The end of the length octets at `der[at]` and the length they say, or `null` unless definite and minimal (X.690 §10.1). */
const derLength = (der: u8[], at: i32): i32[] | null => {
  const total: i32 = toI32(der.length);
  if (at < 0 || at >= total) {
    return null;
  }
  const first: i32 = toI32(der[at]);
  if (first < 0x80) {
    return [at + 1, first];
  }
  // A P-384 signature is at most 104 bytes, so one length octet is all a
  // minimal long form can have, and it has to be 0x80 or more.
  if (first !== 0x81 || at + 1 >= total) {
    return null;
  }
  const length: i32 = toI32(der[at + 1]);
  if (length < 0x80) {
    return null;
  }
  return [at + 2, length];
};

/** The contents `[start, end)` of the element with tag `tag` at `der[at]` inside `[.. limit)`, or `null`. */
const derElement = (der: u8[], at: i32, limit: i32, tag: i32): i32[] | null => {
  if (at < 0 || at >= limit || toI32(der[at]) !== tag) {
    return null;
  }
  const len: i32[] | null = derLength(der, at + 1);
  if (len === null || len[0] + len[1] > limit) {
    return null;
  }
  return [len[0], len[0] + len[1]];
};

/** The positive INTEGER contents `der[start .. end)` as 48 big-endian bytes at `out[off ..]`, or `false` unless minimal, positive and below 2^384. */
const derUnsignedInto = (der: u8[], start: i32, end: i32, out: u8[], off: i32): boolean => {
  if (end <= start || toI32(der[start]) >= 0x80) {
    return false;
  }
  let from: i32 = start;
  if (toI32(der[start]) === 0 && end - start > 1) {
    // A leading zero is minimal only in front of a byte with its top bit set.
    if (toI32(der[start + 1]) < 0x80) {
      return false;
    }
    from = start + 1;
  }
  const n: i32 = end - from;
  if (n > 48) {
    return false;
  }
  for (let k: i32 = 0; k < n; k++) {
    out[off + 48 - n + k] = der[from + k];
  }
  return true;
};

/**
 * `r || s`, 48 octets each, out of an ECDSA-Sig-Value `SEQUENCE { INTEGER r,
 * INTEGER s }` (RFC 3279 §2.2.3), or `null` unless it is exactly one.
 */
export const derSignatureRS384 = (sig: u8[]): u8[] | null => {
  const total: i32 = toI32(sig.length);
  const seq: i32[] | null = derElement(sig, 0, total, 0x30);
  if (seq === null || seq[1] !== total) {
    return null;
  }
  const r: i32[] | null = derElement(sig, seq[0], seq[1], 0x02);
  if (r === null) {
    return null;
  }
  const s: i32[] | null = derElement(sig, r[1], seq[1], 0x02);
  if (s === null || s[1] !== seq[1]) {
    return null;
  }
  const out: u8[] = new Array<u8>(96);
  if (!derUnsignedInto(sig, r[0], r[1], out, 0) || !derUnsignedInto(sig, s[0], s[1], out, 48)) {
    return null;
  }
  return out;
};
