// A data-parallel body runs where its call is, so a destination it captures is
// read before the scope joins (NL2394): `parallelMapInto`, between two arrays
// of the function's own, reads `done` only through the capture. The
// call itself is refused too, for the region it runs between the spawn and
// the join; each refusal is reported, so neither rests on the other.
import { parallelMapInto, scope } from "nish/threads";

const work = (x: i32): i32 => x * 2;

export const main = (): i32 => {
  const done: i32[] = [0];
  const xs: i32[] = [0];
  const ys: i32[] = [0];
  {
    using s = scope();
    s.spawn(work, 21, done, 0);
    parallelMapInto(xs, ys, (x) => done[x]);
    console.log(`${ys[0]}`);
  }
  return done[0];
};
