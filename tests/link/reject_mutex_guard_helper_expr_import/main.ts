// R3 across modules: `grab`, imported from `./box`, would hand the guarded
// object past the lock; it is refused in its own module.
import { Mutex } from "nish/threads";
import { Box, grab } from "./box";

export const main = (): i32 => {
  const m = new Mutex<Box>(new Box());
  {
    using g = m.lock();
    console.log(grab(g).s);
  }
  return 0;
};
