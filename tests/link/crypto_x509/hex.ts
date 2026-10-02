// Hex in and out for the X.509 test programs, which compare keys, hashes and
// certificates as hex. Lowercase only, and no validation: every string it
// reads is a literal in these programs. The hex half is a copy of
// crypto_p256's, so each slice's tests stand alone; the byte-string helpers
// after it serve crypto_x509_audit and crypto_x509_malformed.

const HEX_DIGITS: string = "0123456789abcdef";

/** The value of one lowercase hex digit. */
const hexNibble = (code: i32): i32 => (code <= 57 ? code - 48 : code - 87);

/** Lowercase hex, two digits a byte, into bytes. */
export const fromHex = (text: string): u8[] => {
  const out: u8[] = [];
  const length: i32 = toI32(text.length);
  for (let i: i32 = 1; i < length; i = i + 2) {
    const at: i32 = i - 1;
    if (at >= 0) {
      const high: i32 = hexNibble(toI32(text.charCodeAt(at)));
      const low: i32 = hexNibble(toI32(text.charCodeAt(i)));
      out.push(toU8(high * 16 + low));
    }
  }
  return out;
};

/** Bytes as lowercase hex, or `null` spelled out so a refusal reads in a diff. */
export const toHex = (bytes: u8[] | null): string => {
  if (bytes === null) {
    return "null";
  }
  const digits: string[] = [];
  for (let i: i32 = 0; i < toI32(bytes.length); i++) {
    const v: i32 = toI32(bytes[i]);
    digits.push(HEX_DIGITS.substring(v >> 4, (v >> 4) + 1));
    digits.push(HEX_DIGITS.substring(v & 15, (v & 15) + 1));
  }
  return digits.join("");
};

/** The bytes of `text`, one per character code. */
export const bytesOf = (text: string): u8[] => {
  const out: u8[] = [];
  for (let i: i32 = 0; i < toI32(text.length); i++) {
    out.push(toU8(toI32(text.charCodeAt(i))));
  }
  return out;
};

/** `bytes` as a string of those bytes, which need not be UTF-8. */
export const textOf = (bytes: u8[]): string => {
  const parts: string[] = [];
  for (let i: i32 = 0; i < toI32(bytes.length); i++) {
    parts.push(String.fromCharCode(toI32(bytes[i])));
  }
  return parts.join("");
};

/** Whether two byte strings are equal. */
export const sameBytes = (a: u8[], b: u8[]): boolean => {
  if (toI32(a.length) !== toI32(b.length)) {
    return false;
  }
  for (let i: i32 = 0; i < toI32(a.length) && i < toI32(b.length); i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
};
