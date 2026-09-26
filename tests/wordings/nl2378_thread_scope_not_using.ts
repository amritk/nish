// NL2378: A scope must be introduced by `using`: bound by `const`, nothing would join
// its tasks when the block ends.
import { scope } from "nish/threads";

const one = (n: i32): i32 => n + 1;

export const main = (): i32 => {
  const out: i32[] = [0];
  const s = scope();
  s.spawn(one, 1, out, 0);
  return out[0];
};
