// A data-parallel body runs where its call is, so a destination it captures is
// read before the scope joins (NL2394): `parallelFrom`, whose call hands the
// body no array of its own, reads `done` only through the capture.
import { parallelFrom, scope } from "nish/threads";

const work = (x: i32): i32 => x * 2;

export const main = (): i32 => {
  const done: i32[] = [0];
  {
    using s = scope();
    s.spawn(work, 21, done, 0);
    const ys = parallelFrom(1, (i) => done[i]);
    console.log(`${ys[0]}`);
  }
  return done[0];
};
