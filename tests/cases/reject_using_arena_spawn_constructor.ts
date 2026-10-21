// A task may read an object made in a `using a = arena()` block from a scope
// the block declares, but the constructor that makes it is still followed: one
// that hands `this` to an older list stores the block's allocation past the
// release.
import { scope } from "nish/threads";

class Job {
  ys: i32[];
  constructor(list: Job[], ys: i32[]) {
    this.ys = ys;
    list.push(this);
  }
}

const size = (j: Job): i32 => j.ys.length;

export const main = (): i32 => {
  const out: i32[] = [0];
  const list: Job[] = [];
  {
    using a = arena();
    const ys = new Array<i32>(8);
    {
      using s = scope();
      s.spawn(size, new Job(list, ys), out, 0);
    }
  }
  console.log(`${out[0]} ${list.length}`);
  return 0;
};
