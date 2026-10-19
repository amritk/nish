// A `using a = arena()` block may not store a map's string into an element of
// an array older than the block: the block's release frees the string, and the
// array is read after it.
import { parallelMap } from "nish/threads";

export const main = (): i32 => {
  const xs: i32[] = [1, 2, 3];
  const outer: string[] = ["", ""];
  {
    using a = arena();
    const ws = parallelMap(xs, (x) => `w${x}`);
    outer[1] = ws[2];
  }
  console.log(outer[1]);
  return 0;
};
