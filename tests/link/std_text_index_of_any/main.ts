// `indexOfAny` from `nish/text`, natively the runtime kernel and under Node the
// walker `std/text.ts` writes (docs/LANGUAGE.md, "Byte search"). Each line is
// an edge the doc comment decides, and `tests/run.js` runs this source under
// Node too and holds it to the same `expected.out`, so a line whose answer
// depends on the reading would fail one of the two.
import { indexOfAny } from "nish/text";

/** A text of `n` copies of `fill`, built once with `join` rather than in a loop of `+`. */
const repeated = (fill: string, n: i32): string => {
  const parts: string[] = [];
  let i: i32 = 0;
  while (i < n) {
    parts.push(fill);
    i += 1;
  }
  return parts.join("");
};

export const main = (): number => {
  // The empty text has no byte to find, from anywhere.
  console.log(`empty: ${indexOfAny("", "a", 0)} ${indexOfAny("", "a", -1)} ${indexOfAny("", "a", 1)}`);
  // `from` is clamped to [0, length]: below it searches from the start, past it finds nothing.
  console.log(`from: ${indexOfAny("a,b,c", ",", -7)} ${indexOfAny("a,b,c", ",", 2)} ${indexOfAny("a,b,c", ",", 4)} ${indexOfAny("a,b,c", ",", 5)} ${indexOfAny("a,b,c", ",", 99)}`);
  // The first byte of the set wins, whichever byte of the set it is.
  console.log(`first: ${indexOfAny("key: \"value\"", "\":", 0)} ${indexOfAny("key: \"value\"", "\"", 0)}`);
  // No byte of the set: -1, on a text long enough for the vector paths.
  const hay = repeated("abcdefgh", 100);
  console.log(`miss: ${indexOfAny(hay, "xyz", 0)}`);
  // The last byte, past every whole vector, and one before a 32-byte boundary.
  console.log(`last: ${indexOfAny(`${hay}!`, "!?", 0)} ${indexOfAny(`${repeated("a", 31)}!${repeated("a", 40)}`, "!", 0)}`);
  // A 1-byte set and a 16-byte set, the two ends of what the kernel takes.
  console.log(`one: ${indexOfAny(hay, "h", 8)}`);
  console.log(`sixteen: ${indexOfAny(`${hay}~`, "0123456789!#$%&~", 0)} ${indexOfAny(hay, "0123456789!#$%&h", 100)}`);
  // An ASCII byte never occurs inside a multi-byte sequence, so non-ASCII text
  // passes through and only its ASCII bytes can match. Natively the answer is
  // a byte offset and under Node a UTF-16 one, so the line prints what was
  // found rather than where.
  const accented = "héllo wörld; ünïcödé, done";
  const semi = indexOfAny(accented, ";,", 0);
  console.log(`non-ascii: ${accented.substring(semi, semi + 1)} ${indexOfAny(accented, "xq", 0)} ${indexOfAny("ab;cdé", ";", 0)}`);
  return 0;
};
