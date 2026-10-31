// thread_stack_deep's program written with `scope()`: its tasks get the
// default stack, 8 MiB under the `ulimit -s 8192` the `thread_stack` section
// of tests/run.js runs it with, and the million-deep recursion faults on it.
import { scope } from "nish/threads";

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
    using s = scope();
    s.spawn(chain, 1000000, out, 0);
    s.spawn(chain, 999999, out, 1);
  }
  console.log(`${out[0]} ${out[1]}`);
  return 0;
};
