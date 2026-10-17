// A `using a = arena()` block refuses a map whose body answers arrays: the map
// stores each array into its result, as a loop that pushes arrays into an
// array does, and the block's analysis stops following it. The refusal says
// what to write instead: run that map outside the block, or answer numbers or
// strings, which a map inside a block may (`mem_using_arena_map`).
import { parallelMap } from "nish/threads";

export const main = (): i32 => {
  const xs: i32[] = [1, 2, 3];
  let t = 0;
  {
    using a = arena();
    const rows = parallelMap(xs, (x) => [x, x + 1]);
    t = rows[0].length;
  }
  console.log(`${t}`);
  return 0;
};
