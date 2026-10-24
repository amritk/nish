// `nish/base64` and `nish/crypto/base64url` in one program. Std modules share
// the program's one namespace, so this compiles only while no function in the
// one is named like a function in the other: the padded standard base64 in
// `base64url` is `base64StdPadEncode`, not `base64Encode`. Both encoders run on
// the same inputs, each output is pinned, and the strict decoder reads the
// pixel encoder's output back.
import { base64Encode } from "nish/base64";
import { base64StdPadDecode, base64StdPadEncode } from "nish/crypto/base64url";
import { Suite } from "nish/testing";

/** The bytes of an ASCII string, as the RFC's vectors are written. */
const bytesOfAscii = (text: string): u8[] => {
  const out: u8[] = [];
  for (let i: i32 = 0; i < toI32(text.length); i++) {
    out.push(toU8(text.charCodeAt(i)));
  }
  return out;
};

/** Whether two byte arrays hold the same bytes. */
const sameBytes = (a: u8[], b: u8[]): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  for (let i: i32 = 0; i < toI32(a.length); i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
};

/** Both encoders on `bytes`, each pinned to `text`, and the decoder back. */
const checkBoth = (t: Suite, name: string, bytes: u8[], text: string): void => {
  const pixels: string = base64Encode(bytes);
  t.eqStr(`nish/base64 ${name}`, pixels, text);
  t.eqStr(`base64StdPadEncode ${name}`, base64StdPadEncode(bytes), text);
  const back: u8[] | null = base64StdPadDecode(pixels);
  t.ok(`base64StdPadDecode reads nish/base64 ${name}`, back !== null && sameBytes(back, bytes));
};

export const main = (): number => {
  const t = new Suite("two base64 modules");
  checkBoth(t, "empty", bytesOfAscii(""), "");
  checkBoth(t, "f", bytesOfAscii("f"), "Zg==");
  checkBoth(t, "fo", bytesOfAscii("fo"), "Zm8=");
  checkBoth(t, "foobar", bytesOfAscii("foobar"), "Zm9vYmFy");
  checkBoth(t, "fb ff", [toU8(0xfb), toU8(0xff)], "+/8=");
  return t.done();
};
