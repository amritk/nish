// A data-parallel body runs where its call is, so a destination it captures is
// read before the scope joins (NL2394) even when the call comes before the
// spawn in the source: the loop runs the call again after an earlier pass's
// spawn, while that task may still be writing `done`.
import { parallelFrom, scope } from "nish/threads";

const work = (x: i32): i32 => x * 2;

export const main = (): i32 => {
  const done: i32[] = [0, 0];
  {
    using s = scope();
    for (let k = 0; k < 2; k = k + 1) {
      const ys = parallelFrom(1, (i) => done[i]);
      console.log(`${ys[0]}`);
      s.spawn(work, 21, done, k);
    }
  }
  return done[0];
};
