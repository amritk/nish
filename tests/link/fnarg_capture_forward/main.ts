// An arrow given to an ordinary function's parameter may be handed on to a
// data-parallel form or a scope's `spawn`: its captures travel as parameters
// of each instantiation, and the parallel rules check the body where it runs.
import { parallelMap, scope } from "nish/threads";

const each = (xs: i32[], f: (x: i32) => i32): i32[] => parallelMap(xs, f);

const run = (f: (x: i32) => i32, x: i32): i32 => {
  const out = new Array<i32>(1);
  {
    using s = scope();
    s.spawn(f, x, out, 0);
  }
  return out[0];
};

export const main = (): i32 => {
  const k = 10;
  const ys = each([1, 2, 3], (x) => x * k);
  console.log(`${ys[0] + ys[1] + ys[2]}`);
  console.log(`${run((x) => x + k, 1)}`);
  return 0;
};
