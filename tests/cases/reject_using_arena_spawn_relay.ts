// A task that answers the array it was handed relays the block's allocation
// into the destination: `rows` is older than the `using a = arena()` block, so
// the block is refused although its scope joins before the release.
import { scope } from "nish/threads";

const same = (ys: i32[]): i32[] => ys;

export const main = (): i32 => {
  const rows: i32[][] = [[]];
  {
    using a = arena();
    const ys = new Array<i32>(8);
    {
      using s = scope();
      s.spawn(same, ys, rows, 0);
    }
  }
  console.log(`${rows[0].length}`);
  return 0;
};
