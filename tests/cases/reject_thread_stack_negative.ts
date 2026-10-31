// A negative stack is below the minimum too, and refused the same way.
import { scopeWithStack } from "nish/threads";

const twice = (n: i32): i32 => n * 2;

export const main = (): i32 => {
  const out: i32[] = [0];
  {
    using s = scopeWithStack(-1);
    s.spawn(twice, 21, out, 0);
  }
  return out[0];
};
