// `base64urlDecode` of a text longer than 2^31 - 1 bytes answers `null`. Under
// `--number-mode f64` `toI32` of that length saturates, so the decoder used to
// read only the first 2^31 - 1 characters and, when they were valid, answer
// their bytes: a second spelling of them, which a strict decoder exists to
// refuse. The text is 2^31 + 4 `A`s, built by joining 2^15 copies of a 2^16-
// character piece. docs/security/crypto-k1.md, finding K1-3.
//
// Since CG-3 (docs/security/codegen.md) no string can pass 2^31 - 1 bytes,
// so that join is refused as an allocation is (`nish: out of memory`, exit 1)
// before either check runs, and nothing reaches stdout. The decoder's own
// guard stays, for a text a C host hands in.
import { base64urlDecode } from "nish/crypto/base64url";
import { Suite } from "nish/testing";

export const main = (): i32 => {
  const t = new Suite("base64url long");
  const quads: string[] = [];
  for (let i: i32 = 0; i < 16384; i++) {
    quads.push("AAAA");
  }
  const piece: string = quads.join("");
  const pieces: string[] = [];
  for (let i: i32 = 0; i < 32768; i++) {
    pieces.push(piece);
  }
  pieces.push("AAAA");
  const text: string = pieces.join("");
  t.ok("the text is 2^31 + 4 bytes", text.length === 2147483652);
  t.ok("a 2^31 + 4 byte text answers null", base64urlDecode(text) === null);
  return t.done();
};
