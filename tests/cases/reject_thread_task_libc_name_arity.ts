// #610: a task the program names after a C library function takes a symbol C
// cannot spell (`@read$`), but only once every body is checked: a diagnostic
// about it names it as it was written, even after a `spawn` has handed it to
// another module's instantiation.
import { scope } from "nish/threads";

const read = (n: i32): i32 => n + 1;

export const main = (): i32 => {
  const done: i32[] = [0];
  {
    using s = scope();
    s.spawn(read, 2, done, 0);
  }
  console.log(`${read(1, 2)} ${done[0]}`);
  return 0;
};
