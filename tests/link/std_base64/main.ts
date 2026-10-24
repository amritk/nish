// `nish/crypto/base64url`'s standard base64 (`base64Encode`, `base64Decode`)
// against RFC 4648: the §10 test vectors with their `=` padding, the two §4
// letters (`+` and `/`), every byte value as a final character, round trips
// over every group shape, and each refusal — misplaced or missing padding, a
// non-canonical final sextet, and a character outside the alphabet.
import { base64Decode, base64Encode } from "nish/crypto/base64url";
import { Suite } from "nish/testing";

const HEX_DIGITS: string = "0123456789abcdef";

/** Lower-case hex of `bytes`, so that a failure prints something readable. */
const hexOfBytes = (bytes: u8[]): string => {
  const parts: string[] = [];
  for (const b of bytes) {
    const v: i32 = toI32(b);
    parts.push(HEX_DIGITS.substring(v >> 4, (v >> 4) + 1));
    parts.push(HEX_DIGITS.substring(v & 15, (v & 15) + 1));
  }
  return parts.join("");
};

/** The bytes of an ASCII string, as the RFC's vectors are written. */
const bytesOfAscii = (text: string): u8[] => {
  const out: u8[] = [];
  for (let i: i32 = 0; i < toI32(text.length); i++) {
    out.push(toU8(text.charCodeAt(i)));
  }
  return out;
};

/** The hex of what `text` decodes to, or `null` spelled out when it is refused. */
const decodedHex = (text: string): string => {
  const bytes: u8[] | null = base64Decode(text);
  if (bytes === null) {
    return "null";
  }
  return hexOfBytes(bytes);
};

/** One encoding vector, checked in both directions. */
const checkVector = (t: Suite, name: string, bytes: u8[], text: string): void => {
  t.eqStr(`encode ${name}`, base64Encode(bytes), text);
  t.eqStr(`decode ${name}`, decodedHex(text), hexOfBytes(bytes));
};

/** A text the decoder must refuse. */
const checkRefused = (t: Suite, name: string, text: string): void => {
  t.eqStr(`refuse ${name}`, decodedHex(text), "null");
};

export const main = (): number => {
  const t = new Suite("base64");

  // --- RFC 4648 §10 -------------------------------------------------------------
  checkVector(t, "RFC 4648 §10: empty", bytesOfAscii(""), "");
  checkVector(t, "RFC 4648 §10: f", bytesOfAscii("f"), "Zg==");
  checkVector(t, "RFC 4648 §10: fo", bytesOfAscii("fo"), "Zm8=");
  checkVector(t, "RFC 4648 §10: foo", bytesOfAscii("foo"), "Zm9v");
  checkVector(t, "RFC 4648 §10: foob", bytesOfAscii("foob"), "Zm9vYg==");
  checkVector(t, "RFC 4648 §10: fooba", bytesOfAscii("fooba"), "Zm9vYmE=");
  checkVector(t, "RFC 4648 §10: foobar", bytesOfAscii("foobar"), "Zm9vYmFy");

  // --- RFC 4648 §4: sextets 62 and 63 ------------------------------------------
  checkVector(t, "RFC 4648 §4: fb ff uses + and /", [toU8(0xfb), toU8(0xff)], "+/8=");
  checkVector(t, "RFC 4648 §4: ff fe uses /", [toU8(0xff), toU8(0xfe)], "//4=");

  // --- RFC 4648 §4, Table 1: every sextet, in order ------------------------------
  const alphabet: string = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const tableHex: string =
    "00108310518720928b30d38f41149351559761969b71d79f8218a39259a7a29aabb2dbafc31cb3d35db7e39ebbf3dfbf";
  t.eqStr("RFC 4648 §4 Table 1: the alphabet decodes to sextets 0..63", decodedHex(alphabet), tableHex);
  const table: u8[] | null = base64Decode(alphabet);
  if (table !== null) {
    t.eqStr("RFC 4648 §4 Table 1: and encodes back to the alphabet", base64Encode(table), alphabet);
  }

  // Every byte value as the final character of a group: exactly the 64 alphabet
  // letters are accepted, each decoding to its Table 1 value.
  let accepted: i32 = 0;
  let misread: i32 = 0;
  for (let c: i32 = 0; c < 256; c++) {
    const bytes: u8[] | null = base64Decode(`AAA${String.fromCharCode(c)}`);
    const index: i32 = toI32(alphabet.indexOf(String.fromCharCode(c)));
    if (bytes !== null) {
      accepted++;
      if (c !== 61 && (bytes.length !== 3 || index < 0 || toI32(bytes[2]) !== index)) {
        misread++;
      }
    } else if (index >= 0) {
      misread++;
    }
  }
  // `AAA=` is two zero bytes, padded: the 65th accepted text.
  t.eqI32("every byte value: the 64 alphabet characters and = are accepted", accepted, 65);
  t.eqI32("every byte value: each accepted one decodes to its Table 1 value", misread, 0);

  // Round trips across the three group shapes, over bytes that cover the range.
  for (let n: i32 = 0; n <= 10; n++) {
    const bytes: u8[] = [];
    for (let i: i32 = 0; i < n; i++) {
      bytes.push(toU8((i * 97 + 13) & 255));
    }
    t.eqStr(`round trip: ${n} bytes`, decodedHex(base64Encode(bytes)), hexOfBytes(bytes));
  }

  // --- The refusals -------------------------------------------------------------
  // Padding is required, and only at the end.
  checkRefused(t, "missing padding after one byte", "Zg");
  checkRefused(t, "missing padding after two bytes", "Zm8");
  checkRefused(t, "one = where two are due", "Zg=");
  checkRefused(t, "three =", "Z===");
  checkRefused(t, "= alone", "====");
  checkRefused(t, "= inside the text", "Zg==Zm9v");
  checkRefused(t, "= in the middle of a group", "Z=9v");
  // Characters of the §5 alphabet and others outside §4.
  checkRefused(t, "- from the URL alphabet", "Zm9-");
  checkRefused(t, "_ from the URL alphabet", "Zm_v");
  checkRefused(t, "a space", "Zm 9");
  checkRefused(t, "a trailing newline", "Zm9v\n");
  checkRefused(t, "a multi-byte UTF-8 character", "Zmé=");
  // A length that is not a multiple of four.
  checkRefused(t, "length 1", "Z");
  checkRefused(t, "length 5", "Zm9vY");
  // Non-zero bits after the last byte: each is one bit from the canonical spelling.
  checkRefused(t, "trailing bits after one byte (Zh==, not Zg==)", "Zh==");
  checkRefused(t, "trailing bits after one byte (AB==, not AA==)", "AB==");
  checkRefused(t, "trailing bits after two bytes (Zm9=, not Zm8=)", "Zm9=");
  checkRefused(t, "trailing bits after two bytes (AAB=, not AAA=)", "AAB=");
  t.eqStr("AA== is the one spelling of a zero byte", decodedHex("AA=="), "00");
  t.eqStr("AAA= is the one spelling of two zero bytes", decodedHex("AAA="), "0000");

  return t.done();
};
