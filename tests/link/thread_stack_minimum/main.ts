// Exactly the minimum, 131072 bytes: the checker accepts the literal, the
// runtime gives each task a thread with that stack, and a trivial task on it
// runs to success. Under Node the size is checked and ignored.
import { scopeWithStack } from "nish/threads";

const twice = (n: i32): i32 => n * 2;

export const main = (): i32 => {
  const out: i32[] = [0, 0];
  {
    using s = scopeWithStack(131072);
    s.spawn(twice, 21, out, 0);
    s.spawn(twice, 50, out, 1);
  }
  console.log(`${out[0]} ${out[1]}`);
  return 0;
};
