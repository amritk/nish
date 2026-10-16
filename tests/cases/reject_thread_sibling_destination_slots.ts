// A destination two sibling scopes both name, at different slots: the array
// is one block of memory the two scopes' joins write in different orders.
import { scope } from "nish/threads";
const f = (x: i32): i32 => x * 10;
const g = (x: i32): i32 => x * 100;
export const main = (): i32 => {
  const out: i32[] = [0, 0];
  {
    using s = scope(), t = scope();
    s.spawn(f, 1, out, 0);
    t.spawn(g, 2, out, 1);
  }
  console.log(`${out[0]} ${out[1]}`);
  return 0;
};
