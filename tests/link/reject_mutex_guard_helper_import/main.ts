// R3 across modules: `stash`, imported from `./counter`, is a guard helper,
// and its binding of the guard is refused as it would be in this module.
import { Mutex } from "nish/threads";
import { Counter, stash } from "./counter";

export const main = (): i32 => {
  const m = new Mutex<Counter>(new Counter());
  using g = m.lock();
  return stash(g);
};
