// `codePointLength` where the native and Node answers part, so this case runs
// natively only (`tests/run.js` runs `std_text` and `std_text_f64` under Node,
// not this one). Each line is what the doc comment on `codePointLength` and
// docs/RUN_UNDER_NODE.md, "What stays divergent", say native code answers;
// Node answers 1 for both.
import { codePointLength } from "../../../std/text.ts";

export const main = (): number => {
  // One byte, 0x80, which is not UTF-8: a stray continuation byte counts
  // nothing. Under Node it is the unit U+0080, one code point.
  console.log(`stray continuation byte: ${codePointLength(String.fromCharCode(0x80))}`);
  // The two halves of a pair, joined at run time: natively they stay two lone
  // surrogates, three WTF-8 bytes each, so two code points. Under Node they
  // are one string holding the pair, which is one.
  const halves: string[] = ["\ud83d", "\ude00"];
  const joined: string = halves.join("");
  console.log(`joined halves: ${codePointLength(joined)}, ${joined.length} bytes`);
  return 0;
};
