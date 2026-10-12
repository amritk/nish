// A `for...of` variable is an element reference too; captured after a push in
// the loop's body, it is stale.
import { parallelFrom } from "nish/threads";

interface P {
  v: i32;
}

export const main = (): i32 => {
  const ps: P[] = [{ v: 1 }];
  let t: i32 = 0;
  for (const p of ps) {
    ps.push({ v: 5 });
    t = t + parallelFrom(1, (i) => p.v + i)[0];
    if (ps.length > 3) {
      break;
    }
  }
  return t;
};
