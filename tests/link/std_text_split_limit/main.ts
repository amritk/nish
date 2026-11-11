// `splitLimit` from `nish/text` against JavaScript's own `split(sep, limit)`.
// Each line prints the text, the separator and the limit, then how many pieces
// came back and the pieces joined by `|`. `tests/run.js` runs this natively and
// under the Node prelude, holds both to expected.out, and holds every line to
// `text.split(sep, limit)` computed by Node itself.
//
// JavaScript keeps the first `limit` pieces and drops the rest rather than
// joining them into the last; 0 keeps none; and a negative limit is read
// through `ToUint32`, so -1 keeps every piece.
import { split, splitLimit } from "../../../std/text.ts";

const show = (text: string, sep: string, limit: i32): void => {
  const pieces: string[] = splitLimit(text, sep, limit);
  console.log(`"${text}" "${sep}" ${limit} -> ${pieces.length}: ${pieces.join("|")}`);
};

export const main = (): number => {
  show("a,b,c", ",", 2);
  show("a,b,c", ",", 0);
  show("a,b,c", ",", 1);
  show("a,b,c", ",", 3);
  show("a,b,c", ",", 4);
  show("a,b,c", ",", -1);
  show("a,b,c", ",", -2147483648);
  show(",a,,b,", ",", 3);
  show(",a,,b,", ",", 5);
  show(",a,,b,", ",", 6);
  show("", ",", 1);
  show("", ",", 0);
  show("abc", ",", 1);
  show("a::b::c", "::", 2);
  show("é-ü-€", "-", 2);
  show("x😀y😀z", "😀", 2);
  // A negative limit is `split` itself.
  console.log(`same as split: ${splitLimit(",a,,b,", ",", -1).join("|") === split(",a,,b,", ",").join("|")}`);
  return 0;
};
