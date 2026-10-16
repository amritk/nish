// #618: under `--no-strict-exports` a function nobody exported is public, and
// one named after a C library function is refused (NL3037) -- unless another
// module's instantiation calls it, which makes it `hidden`, and a hidden
// function takes a `$` (`@read$`, #610). Its symbol is then not its name, so
// it is accepted, and the scope joins two tasks without reaching `read(2)`.
import { scope } from "nish/threads";

const read = (n: i32): i32 => n + 1;

export const main = (): i32 => {
  const done: i32[] = [0, 0];
  {
    using s = scope();
    s.spawn(read, 1, done, 0);
    s.spawn(read, 2, done, 1);
  }
  console.log(`${done[0]} ${done[1]}`);
  return 0;
};
