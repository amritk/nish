// `nish/crypto/base64url` against RFC 4648: the §10 test vectors spelled in the
// §5 URL alphabet without padding, the two alphabet letters that differ from
// §4 (`-` and `_`), every byte value as a final character, and each of the
// refusals the module comment lists. It imports the module by its nested
// specifier, so it is also the case that proves `nish/crypto/<name>` resolves.
import { base64urlDecode, base64urlEncode } from "nish/crypto/base64url";
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
  const bytes: u8[] | null = base64urlDecode(text);
  if (bytes === null) {
    return "null";
  }
  return hexOfBytes(bytes);
};

/** One encoding vector, checked in both directions. */
const checkVector = (t: Suite, name: string, bytes: u8[], text: string): void => {
  t.eqStr(`encode ${name}`, base64urlEncode(bytes), text);
  t.eqStr(`decode ${name}`, decodedHex(text), hexOfBytes(bytes));
};

/** A text the decoder must refuse. */
const checkRefused = (t: Suite, name: string, text: string): void => {
  t.eqStr(`refuse ${name}`, decodedHex(text), "null");
};

export const main = (): number => {
  const t = new Suite("base64url");

  // --- RFC 4648 §10, with the `=` padding removed ------------------------------
  checkVector(t, "RFC 4648 §10: empty", bytesOfAscii(""), "");
  checkVector(t, "RFC 4648 §10: f", bytesOfAscii("f"), "Zg");
  checkVector(t, "RFC 4648 §10: fo", bytesOfAscii("fo"), "Zm8");
  checkVector(t, "RFC 4648 §10: foo", bytesOfAscii("foo"), "Zm9v");
  checkVector(t, "RFC 4648 §10: foob", bytesOfAscii("foob"), "Zm9vYg");
  checkVector(t, "RFC 4648 §10: fooba", bytesOfAscii("fooba"), "Zm9vYmE");
  checkVector(t, "RFC 4648 §10: foobar", bytesOfAscii("foobar"), "Zm9vYmFy");

  // --- RFC 4648 §5: the two letters the URL alphabet changes -------------------
  // fb ff is `+/8=` in §4, and ff fe is `//4=`: sextets 62 and 63.
  checkVector(t, "RFC 4648 §5: fb ff uses - and _", [toU8(0xfb), toU8(0xff)], "-_8");
  checkVector(t, "RFC 4648 §5: ff fe uses _", [toU8(0xff), toU8(0xfe)], "__4");

  // --- RFC 4648 §5, Table 2: every sextet, in order -----------------------------
  // The whole alphabet is 64 characters, so it decodes to 48 bytes and back.
  const alphabet: string = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const tableHex: string =
    "00108310518720928b30d38f41149351559761969b71d79f8218a39259a7a29aabb2dbafc31cb3d35db7e39ebbf3dfbf";
  t.eqStr("RFC 4648 §5 Table 2: the alphabet decodes to sextets 0..63", decodedHex(alphabet), tableHex);
  const table: u8[] | null = base64urlDecode(alphabet);
  if (table !== null) {
    t.eqStr("RFC 4648 §5 Table 2: and encodes back to the alphabet", base64urlEncode(table), alphabet);
  }

  // Every byte value as the final character of a group: exactly the 64 alphabet
  // letters are accepted, each decoding to its Table 2 value, which walks every
  // edge of every range mask (`@` `[` `` ` `` `{` `/` `:` `,` `.` `^` and the
  // bytes above 127 among the refusals).
  let accepted: i32 = 0;
  let misread: i32 = 0;
  for (let c: i32 = 0; c < 256; c++) {
    const bytes: u8[] | null = base64urlDecode(`AAA${String.fromCharCode(c)}`);
    const index: i32 = toI32(alphabet.indexOf(String.fromCharCode(c)));
    if (bytes !== null) {
      accepted++;
      if (bytes.length !== 3 || index < 0 || toI32(bytes[2]) !== index) {
        misread++;
      }
    } else if (index >= 0) {
      misread++;
    }
  }
  t.eqI32("every byte value: exactly the 64 alphabet characters are accepted", accepted, 64);
  t.eqI32("every byte value: each accepted one decodes to its Table 2 value", misread, 0);

  // Round trips across the three group shapes, over bytes that cover the range.
  for (let n: i32 = 0; n <= 10; n++) {
    const bytes: u8[] = [];
    for (let i: i32 = 0; i < n; i++) {
      bytes.push(toU8((i * 97 + 13) & 255));
    }
    t.eqStr(`round trip: ${n} bytes`, decodedHex(base64urlEncode(bytes)), hexOfBytes(bytes));
  }

  // --- The refusals -------------------------------------------------------------
  // Padding is not part of this encoding, wherever it stands.
  checkRefused(t, "= padding after one byte", "Zg==");
  checkRefused(t, "= padding after two bytes", "Zm8=");
  checkRefused(t, "= padding after a full group", "Zm9vYg==");
  checkRefused(t, "= alone", "====");
  // Characters of the §4 alphabet and others outside §5.
  checkRefused(t, "+ from the standard alphabet", "Zm9+");
  checkRefused(t, "/ from the standard alphabet", "Zm/v");
  checkRefused(t, "a space", "Zm 9v");
  checkRefused(t, "a trailing newline", "Zm9v\nZg");
  checkRefused(t, "a bad character in the first position", ".m9v");
  checkRefused(t, "a bad character in a short final group", "Zm9vY.");
  checkRefused(t, "a multi-byte UTF-8 character", "Zmé");
  // Six bits do not make a byte.
  checkRefused(t, "length 1", "Z");
  checkRefused(t, "length 5", "Zm9vY");
  checkRefused(t, "length 9", "Zm9vYmFyZ");
  // Non-zero bits after the last byte: each of these is one bit away from the
  // canonical spelling beside it, which is accepted.
  checkRefused(t, "trailing bits after one byte (Zh, not Zg)", "Zh");
  checkRefused(t, "trailing bits after one byte (AB, not AA)", "AB");
  checkRefused(t, "trailing bits after two bytes (Zm9, not Zm8)", "Zm9");
  checkRefused(t, "trailing bits after two bytes (AAB, not AAA)", "AAB");
  t.eqStr("AA is the one spelling of a zero byte", decodedHex("AA"), "00");
  t.eqStr("AAA is the one spelling of two zero bytes", decodedHex("AAA"), "0000");

  return t.done();
};
