// A `using a = arena()` block may hold a map, of numbers or of strings, so long
// as nothing it answers outlives the block. Here one of the map's strings is
// kept in a local declared outside the block, and the block's release would
// free the memory it lives in, so the block is refused, and the refusal says
// what to write instead.
import { parallelMap } from "nish/threads";

export const main = (): i32 => {
  const xs: i32[] = [1, 2, 3];
  let kept = "";
  {
    using a = arena();
    const ws = parallelMap(xs, (x) => `w${x}`);
    kept = ws[0];
  }
  console.log(kept);
  return 0;
};
