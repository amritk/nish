// A task cannot open a scope of its own and spawn: the inner scope's join
// stores into its destination, which is a write another task could see.
import { scope } from "nish/threads";

const leaf = (n: i32): i32 => n + 1;

const outer = (n: i32): i32 => {
  const inner: i32[] = [0];
  {
    using s = scope();
    s.spawn(leaf, n, inner, 0);
  }
  return inner[0];
};

export const main = (): i32 => {
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(outer, 1, out, 0);
  }
  return out[0];
};
