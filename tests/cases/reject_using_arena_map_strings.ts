// A `using a = arena()` block may hold a map that answers numbers, but not one
// that answers strings: such a map stores each string its body allocates into
// its result, where the block's analysis stops following it, as it refuses a
// loop body that pushes them through a callee. The refusal says what to write
// instead: a function that runs the map and answers a number gives the map's
// result back when it returns.
import { parallelMap } from "nish/threads";

export const main = (): i32 => {
  const xs: i32[] = [1, 2, 3];
  let t = 0;
  {
    using a = arena();
    const ws = parallelMap(xs, (x) => `w${x}`);
    t = ws[0].length;
  }
  console.log(`${t}`);
  return 0;
};
