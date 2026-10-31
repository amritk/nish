// A constant stack below the minimum is refused where it is written: no target
// can start a thread on 4 KiB, and `scopeWithStack` would only panic at run time.
import { scopeWithStack } from "nish/threads";

const twice = (n: i32): i32 => n * 2;

export const main = (): i32 => {
  const out: i32[] = [0];
  {
    using s = scopeWithStack(4096);
    s.spawn(twice, 21, out, 0);
  }
  return out[0];
};
