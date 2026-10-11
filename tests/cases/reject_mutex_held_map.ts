// R5: nothing is waited on while a lock is held, and `parallelMapInto`
// waits for every thread it divides the work across.
import { Mutex, parallelMapInto, parallelReduce, scope } from "nish/threads";

class Counter {
  n: i32 = 0;
}

const twice = (x: i32): i32 => x * 2;

export const main = (): i32 => {
  const m = new Mutex<Counter>(new Counter());
  const src: i32[] = [1, 2];
  const dst: i32[] = [0, 0];
  using g = m.lock();
  parallelMapInto(src, dst, twice);
  return dst[1] + g.value.n;
};
