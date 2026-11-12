// WP51 stage 2: a scope's `spawn` takes no function reference: its task
// runs beside the scope's other tasks.
import { scope } from "nish/threads";
type F = (x: i32) => i32;
const double = (x: i32): i32 => x * 2;
export const main = (): i32 => {
  const h: F = double;
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(h, 2, out, 0);
  }
  return out[0];
};
