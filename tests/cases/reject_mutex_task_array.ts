// R8: a `Mutex` reaches a task as its argument or as a field of the class its
// argument is. An array of them would make which tasks share a lock a question
// about indices rather than types.
import { Mutex, scope } from "nish/threads";

class Counter {
  n: i32 = 0;
}

const first = (ms: Mutex<Counter>[]): i32 => {
  using g = ms[0].lock();
  g.value.n = g.value.n + 1;
  return 0;
};

export const main = (): i32 => {
  const ms: Mutex<Counter>[] = [new Mutex<Counter>(new Counter())];
  const done: i32[] = [0];
  {
    using s = scope();
    s.spawn(first, ms, done, 0);
  }
  return 0;
};
