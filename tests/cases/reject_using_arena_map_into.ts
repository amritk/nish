// A `using a = arena()` block may not fill an array older than it with a map of
// strings: the strings `parallelMapInto` stores into `out` live in blocks the
// block's release would free, and `out` is read after it.
import { parallelMapInto } from "nish/threads";

export const main = (): i32 => {
  const xs: i32[] = [1, 2, 3];
  const out: string[] = ["", "", ""];
  {
    using a = arena();
    parallelMapInto(xs, out, (x) => `w${x}`);
  }
  console.log(out[2]);
  return 0;
};
