// thread_stack_deep's program with a 128 KiB stack: the recursion runs off the
// end of it and faults on the guard page scopeWithStack puts below it, rather
// than running into whatever memory lies there.
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
    using s = scopeWithStack(128 * 1024);
    s.spawn(chain, 1000000, out, 0);
    s.spawn(chain, 999999, out, 1);
  }
  console.log(`${out[0]} ${out[1]}`);
  return 0;
};
