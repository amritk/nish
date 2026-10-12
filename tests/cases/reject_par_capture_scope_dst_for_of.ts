// The same read as the iterable of a `for...of` in the body.
import { parallelFrom, scope } from "nish/threads";

const work = (x: i32): i32 => x * 2;

export const main = (): i32 => {
  const done: i32[] = [0];
  {
    using s = scope();
    s.spawn(work, 21, done, 0);
    const ys = parallelFrom(1, (i): i32 => {
      let t: i32 = i;
      for (const d of done) {
        t = t + d;
      }
      return t;
    });
    console.log(`${ys[0]}`);
  }
  return done[0];
};
