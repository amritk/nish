// WP33 NL8001 (#629): offsets that stay inside the program's own counting are
// quiet. An offset compared with another offset, a loop whose cursor indexes
// the string, a data-parallel body over a captured ASCII string (a `const`
// bound to a `let` the host writes only ASCII to included), an offset
// handed to a helper that only slices with it, and a helper's offset taken of
// an ASCII argument agree in both units.
import { parallelMap } from "nish/threads";

const firstL = (s: string): i32 => s.indexOf("l");

const from = (s: string, at: i32): string => s.substring(at, s.length);

export const main = (): number => {
  const word = "héllo";
  const plain = "hello";
  if (word.indexOf("l") < word.length) {
    console.log("inside");
  }
  let spaces = 0;
  let i = 0;
  while (i < word.length) {
    if (word.charCodeAt(i) === 32) {
      spaces = spaces + 1;
    }
    i = i + 1;
  }
  console.log(spaces);
  const xs: i32[] = [1, 2, 3];
  const ys = parallelMap(xs, (k) => plain.indexOf("l") + k);
  console.log(ys[0]);
  let label = "plain";
  label = "also";
  const labelNow = label;
  const zs = parallelMap(xs, (k) => labelNow.length + k);
  console.log(zs[0]);
  console.log(from(word, word.indexOf("l")));
  console.log(firstL(plain));
  return 0;
};
