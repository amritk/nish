// #618: every module of the program's own package has an empty symbol prefix,
// so a helper module's `export const write` is `@write` in the executable. On
// the last release this program crashed natively, while Node printed `wrote 7`.
import { write } from "./util";

export const main = (): i32 => {
  console.log(`wrote ${write("abc", 4)}`);
  return 0;
};
