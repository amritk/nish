// A `using a = arena()` block may not push a map's string onto an array older
// than the block: the push moves the array's storage into the block's arena,
// and the string lives there too.
import { parallelMap } from "nish/threads";

export const main = (): i32 => {
  const xs: i32[] = [1, 2, 3];
  const outer: string[] = [];
  {
    using a = arena();
    const ws = parallelMap(xs, (x) => `w${x}`);
    outer.push(ws[0]);
  }
  console.log(outer[0]);
  return 0;
};
