// NL2468: a store through a guard stores a scalar or a string, which it copies. An
// array of strings a task built lives in its arena, which is freed when the task is
// joined.
import { Mutex } from "nish/threads";

class Named {
  names: string[];
  constructor() {
    this.names = [];
  }
}

export const main = (): i32 => {
  const m = new Mutex<Named>(new Named());
  {
    using g = m.lock();
    g.value.names = ["x"];
  }
  return 0;
};
