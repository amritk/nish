// A declared class spelled like the instantiation `Box<i32>` in `./lib`. The
// two were one struct type, so `rd` read this object at `Box<i32>`'s offsets
// and printed garbage where 3 was meant. `$` is how an instantiation is named,
// so a declared name cannot contain it. This module loads first.
import { rd } from "./lib";

class Box$i32 {
  a: string = "zz";
  v: i32 = 3;
}

export const main = (): i32 => {
  console.log(rd(new Box$i32()));
  return 0;
};
