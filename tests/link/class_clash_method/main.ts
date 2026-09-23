// #174, the method half: both modules' `Counter` declare `bump`, which is the
// one symbol `Counter.bump`. Neither class has a constructor, so the clash is
// the method's alone, and the message names the method as well as the class.
import { one } from "./lib";

class Counter {
  n: i32 = 0;

  bump(): i32 {
    this.n = this.n + 2;
    return this.n;
  }
}

export const main = (): i32 => new Counter().bump() + one();
