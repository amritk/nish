// A scope is only ever the receiver of `spawn` in its own block.
import { parallelMap, scope } from "nish/threads";

const id = (x: i32): i32 => x;

export const main = (): i32 => {
  const out: i32[] = [0];
  using s = scope();
  const ys = parallelMap([1, 2], (x): i32 => {
    s.spawn(id, x, out, 0);
    return x;
  });
  return ys[0];
};
