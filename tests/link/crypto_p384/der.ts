// A strict reader of the DER ECDSA-Sig-Value Wycheproof's ecdsa_secp384r1_sha256
// file carries, for the P-384 test programs: `nish/crypto/x509`'s
// `x509DerSignatureRS` reads P-256's 32-byte integers only. DER as X.690 asks
// it: a short-form length (a P-384 signature never needs more), two minimal,
// non-negative INTEGERs of at most 48 bytes of magnitude, and nothing after
// them.

/** The INTEGER at `at` of `der`, ending by `end`, as 48 big-endian bytes appended to `out`; answers the offset after it, or -1. */
const readInteger = (der: u8[], at: i32, end: i32, out: u8[]): i32 => {
  if (end - at < 2 || toI32(der[at]) !== 0x02) {
    return -1;
  }
  const length: i32 = toI32(der[at + 1]);
  const start: i32 = at + 2;
  if (length < 1 || length >= 0x80 || length > end - start) {
    return -1;
  }
  const first: i32 = toI32(der[start]);
  if (first >= 0x80) {
    return -1;
  }
  let skip: i32 = 0;
  if (first === 0 && length > 1) {
    if (toI32(der[start + 1]) < 0x80) {
      return -1;
    }
    skip = 1;
  }
  const magnitude: i32 = length - skip;
  if (magnitude > 48) {
    return -1;
  }
  for (let i: i32 = magnitude; i < 48; i++) {
    out.push(0);
  }
  for (let i: i32 = start + skip; i < start + length; i++) {
    out.push(der[i]);
  }
  return start + length;
};

/** The 96-byte `r || s` of the DER ECDSA-Sig-Value `der`, or null when `der` is not strict DER or an integer does not fit 48 bytes. */
export const derToRS = (der: u8[]): u8[] | null => {
  const total: i32 = toI32(der.length);
  if (total < 2 || toI32(der[0]) !== 0x30 || toI32(der[1]) >= 0x80 || toI32(der[1]) !== total - 2) {
    return null;
  }
  const out: u8[] = [];
  const afterR: i32 = readInteger(der, 2, total, out);
  if (afterR < 0) {
    return null;
  }
  const afterS: i32 = readInteger(der, afterR, total, out);
  if (afterS !== total) {
    return null;
  }
  return out;
};
