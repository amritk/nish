// The helper lives in its own module: the guard's rules hold its parameter
// across the import, so binding the guard to a second name is refused here.
import { MutexGuard } from "nish/threads";

export class Counter {
  n: i32 = 0;
}

export const stash = (g: MutexGuard<Counter>): i32 => {
  const h = g;
  return h.value.n;
};
