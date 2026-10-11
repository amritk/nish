// R4: a store through a guard stores a scalar. A string a task built lives in
// its arena, which is freed when the task is joined.
import { Mutex } from "nish/threads";

class Named {
  name: string = "";
}

export const main = (): i32 => {
  const m = new Mutex<Named>(new Named());
  {
    using g = m.lock();
    g.value.name = "x";
  }
  return 0;
};
