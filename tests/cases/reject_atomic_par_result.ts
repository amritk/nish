// A parallel body hands back a number, a `boolean` or an enum, never an atomic.
import { AtomicI32, parallelMap } from "nish/threads";
export const main = (): i32 => {
  const pool: AtomicI32[] = [new AtomicI32(1), new AtomicI32(2)];
  const xs: i32[] = [0, 1];
  const ys = parallelMap(xs, (x: i32): AtomicI32 => pool[x]);
  return ys[0].load();
};
