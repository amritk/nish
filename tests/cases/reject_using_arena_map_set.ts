// A `using a = arena()` block may not put a map's array into a `Map` older than
// the block: the block's release frees the array, and the map is read after it.
import { parallelMap } from "nish/threads";

export const main = (): i32 => {
  const xs: i32[] = [1, 2, 3];
  const byKey = new Map<i32, string[]>();
  {
    using a = arena();
    const ws = parallelMap(xs, (x) => `w${x}`);
    byKey.set(1, ws);
  }
  console.log(`${byKey.size}`);
  return 0;
};
