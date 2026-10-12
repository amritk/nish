// The same stale reference after a thousand pushes in a loop.
import { parallelFrom } from "nish/threads";

interface P {
  v: i32;
  w: i32;
}

export const main = (): i32 => {
  const ps: P[] = [{ v: 1, w: 2 }];
  const first = ps[0];
  for (let i: i32 = 0; i < 1000; i++) {
    ps.push({ v: i, w: i });
  }
  return parallelFrom(3, (i) => first.v * 1000 + first.w + i)[0];
};
