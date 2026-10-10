// `indexOfAny` on non-ASCII text, where the answer is a byte offset: natively
// and under `--profile wasi` both count UTF-8 bytes, so each value here is
// pinned in `expected.out` and held there by both builds (`tests/run.js`).
// Node counts UTF-16 units, so this program stays out of the Node comparison;
// `std_text_index_of_any` keeps the line Node is held to, which prints what was
// found rather than where.
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
  // One sequence of each width before the match: 2, 3, 3 + 3 and 4 bytes.
  console.log(`widths: ${indexOfAny("é;", ";", 0)} ${indexOfAny("a€;", ";", 0)} ${indexOfAny("日本;", ";", 0)} ${indexOfAny("😀;", ";", 0)}`);
  // The match on a 16-byte boundary, one before it, one past it, and past two
  // whole vectors: the offsets the vector path computes from its lane.
  console.log(`vectors: ${indexOfAny(`${repeated("é", 16)};`, ";", 0)} ${indexOfAny(`${repeated("é", 15)}a;`, ";", 0)} ${indexOfAny(`${repeated("€", 11)};`, ";", 0)} ${indexOfAny(`${repeated("é", 32)};`, ";", 0)}`);
  // `from` is a byte offset too: from inside a sequence, from past the first match.
  const accented = "héllo wörld; ünïcödé, done";
  console.log(`from: ${indexOfAny(accented, ";,", 0)} ${indexOfAny(accented, ";,", 2)} ${indexOfAny(accented, ";,", 14)} ${indexOfAny(accented, "xq", 0)}`);
  return 0;
};
