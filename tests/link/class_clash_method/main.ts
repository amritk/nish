// #174, the method half: both modules' `Counter` declare `bump`, which is the
// one symbol `Counter.bump`. Neither class has a constructor. Since #193 the
// two classes are refused by name (NL3028) before the method is looked at, and
// the shared method is not reported as a second mistake.
import { one } from "./lib";

class Counter {
  n: i32 = 0;

  bump(): i32 {
    this.n = this.n + 2;
    return this.n;
  }
}

export const main = (): i32 => new Counter().bump() + one();
