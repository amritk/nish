// Hex in and out for the `nish/net/quic-packet` checks, the way RFC 9000 and
// RFC 9001 print bytes: lowercase, two digits a byte, no separators.

const HEX_DIGITS: string = "0123456789abcdef";

/** `bytes` as lowercase hex. */
export const hexOf = (bytes: u8[]): string => {
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

/** `bytes` as hex, or `null` spelled out, so a refusal prints as a value. */
export const hexOrNull = (bytes: u8[] | null): string => {
  if (bytes !== null) {
    return hexOf(bytes);
  }
  return "null";
};

/** The value of one lowercase hex digit. */
const hexDigitValue = (c: i32): i32 => (c >= 97 ? c - 87 : c - 48);

/** The bytes a lowercase hex string spells; the strings here are the RFCs' and always even. */
export const bytesOf = (hex: string): u8[] => {
  const out: u8[] = [];
  const length: i32 = toI32(hex.length);
  for (let k: i32 = 0; k + 1 < length; k += 2) {
    if (k >= 0 && k < toI32(hex.length) && k + 1 < toI32(hex.length)) {
      const hi: i32 = hexDigitValue(toI32(hex.charCodeAt(k)));
      const lo: i32 = hexDigitValue(toI32(hex.charCodeAt(k + 1)));
      out.push(toU8((hi << 4) | lo));
    }
  }
  return out;
};

/** `a` followed by `b`, in a fresh array. */
export const joined = (a: u8[], b: u8[]): u8[] => {
  const out: u8[] = [];
  for (const x of a) {
    out.push(x);
  }
  for (const x of b) {
    out.push(x);
  }
  return out;
};

/** The first `n` bytes of `bytes`, or all of them when it is shorter. */
export const prefix = (bytes: u8[], n: i32): u8[] => {
  const out: u8[] = [];
  const length: i32 = toI32(bytes.length);
  for (let k: i32 = 0; k < n && k < length; k += 1) {
    if (k < toI32(bytes.length)) {
      out.push(bytes[k]);
    }
  }
  return out;
};

/** A copy of `bytes` with `bytes[at]` XORed with `flip`; `at` is inside it. */
export const flipped = (bytes: u8[], at: i32, flip: i32): u8[] => {
  const out: u8[] = prefix(bytes, toI32(bytes.length));
  if (at >= 0 && at < toI32(out.length)) {
    out[at] = out[at] ^ toU8(flip);
  }
  return out;
};

/** `n` zero bytes. */
export const zeros = (n: i32): u8[] => new Array<u8>(n);
