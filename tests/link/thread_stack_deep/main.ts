// A task that recurses a million calls deep, on a scope that gives its thread
// a 256 MiB stack. Every call keeps a frame live across the next one, so the
// recursion needs at least 16 MB of stack: more than the 8 MB a thread gets by
// default, where the same program written with `scope()` faults.
import { scopeWithStack } from "nish/threads";

const chain = (n: i32): i32 => {
  if (n === 0) {
    return 0;
  }
  const below = chain(n - 1);
  return (below * 31 + n) % 1000003;
};

export const main = (): i32 => {
  const out: i32[] = [0, 0];
  {
    using s = scopeWithStack(256 * 1024 * 1024);
    s.spawn(chain, 1000000, out, 0);
    s.spawn(chain, 999999, out, 1);
  }
  console.log(`${out[0]} ${out[1]}`);
  return 0;
};
