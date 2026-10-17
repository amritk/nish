// A `using a = arena()` block refuses a `spawn` whose task answers an array:
// the spawn stores the answer into `rows`, where the block's analysis stops
// following it. The refusal is the plain one for a callee that stores, without
// the hint `reject_using_arena_map_arrays` gives a map.
import { scope } from "nish/threads";

const rowOf = (x: i32): i32[] => [x, x + 1];

export const main = (): i32 => {
  let t = 0;
  {
    using a = arena();
    const rows: i32[][] = [[], []];
    {
      using s = scope();
      s.spawn(rowOf, 4, rows, 0);
    }
    t = rows[0].length;
  }
  console.log(`${t}`);
  return 0;
};
