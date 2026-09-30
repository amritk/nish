// Hex in and out for the AES test programs, which compare byte strings the
// specifications and Wycheproof print as hex. Lowercase only, and no
// validation: every string it reads is a literal in these programs or in the
// vector file beside them.

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
