// NL2345: the same rule for an arrow body of `parallelMap`, which writes the
// caller's `seen` on every element.
import { parallelMap } from "nish/threads";

class Seen {
  n: i32 = 0;
}

export const main = (): i32 => {
  const seen = new Seen();
  const src: i32[] = [1, 2, 3];
  const doubled = parallelMap(src, (x: i32): i32 => {
    seen.n = x;
    return x * 2;
  });
  return doubled[0] + seen.n;
};
