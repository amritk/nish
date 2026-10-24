// `codePointLength` where the native and Node answers part. expected.out holds
// the native answers, which the doc comment on `codePointLength` and
// docs/RUN_UNDER_NODE.md, "What stays divergent", give; `tests/run.js` runs the
// same file under the Node prelude and holds it to Node's: 2, 1, and 1 with 2
// units.
import { codePointLength } from "../../../std/text.ts";

export const main = (): number => {
  // `é` built from its two UTF-8 bytes: one code point natively. Under Node
  // each byte is its own unit, so it counts two.
  const bytes: u8[] = [0xc3, 0xa9];
  console.log(`built from bytes: ${codePointLength(String.fromBytes(bytes, 0, 2))}`);
  // One byte, 0x80, which is not UTF-8: a stray continuation byte counts
  // nothing. Under Node it is the unit U+0080, one code point.
  console.log(`stray continuation byte: ${codePointLength(String.fromCharCode(0x80))}`);
  // The two halves of a pair, joined at run time: natively they stay two lone
  // surrogates, three WTF-8 bytes each, so two code points. Under Node they
  // are one string holding the pair, which is one.
  const halves: string[] = ["\ud83d", "\ude00"];
  const joined: string = halves.join("");
  console.log(`joined halves: ${codePointLength(joined)}, length ${joined.length}`);
  return 0;
};
