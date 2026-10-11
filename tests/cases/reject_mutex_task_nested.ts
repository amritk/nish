// R8: no `Mutex` inside another's data. A task holding the outer lock would
// reach the inner one, which is a second lock R5 cannot see from here.
import { Mutex, scope } from "nish/threads";

class Counter {
  n: i32 = 0;
}

const outer = (m: Mutex<Mutex<Counter>>): i32 => 0;

export const main = (): i32 => {
  const m = new Mutex<Mutex<Counter>>(new Mutex<Counter>(new Counter()));
  const done: i32[] = [0];
  {
    using s = scope();
    s.spawn(outer, m, done, 0);
  }
  return done[0];
};
