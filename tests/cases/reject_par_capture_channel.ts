// A channel is never captured (C2).
import { Channel, parallelMap } from "nish/threads";

export const main = (): i32 => {
  const c = new Channel<i32>();
  const ys = parallelMap([1, 2], (x): i32 => {
    c.send(x);
    return x;
  });
  return ys[0];
};
