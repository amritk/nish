// A returned array is the callee's own until the `return`, so `build` may fill
// it and answer it. The caller holds the answer as a call result, memory it
// does not know: its own stores into it are shared writes, and the task that
// makes them writes memory its caller can see.
import { scope } from "nish/threads";

const build = (n: i32): i32[] => {
  const xs = new Array<i32>(n);
  xs[0] = n;
  return xs;
};

const first = (n: i32): i32 => {
  const ys = build(n);
  ys[0] = n + 1;
  return ys[0];
};

export const main = (): i32 => {
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(first, 4, out, 0);
  }
  return out[0];
};
