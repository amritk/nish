// A lock is shared only by its own rules (R5: no lock inside a parallel
// body), so it is not captured.
import { Mutex, parallelMap } from "nish/threads";

export const main = (): i32 => {
  const m = new Mutex<i32>(0);
  const ys = parallelMap([1, 2], (x): i32 => {
    using g = m.lock();
    return x + g.value;
  });
  return ys[0];
};
