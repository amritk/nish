// `main.ts` calls `gen` with a `Box<i32>`, so this module holds `Box$i32` as a
// type argument first: a layout and no symbols. The unannotated `box(9)` below
// then hands it a `Box<i32>` whose methods it calls, so its IR has to declare
// `Box$i32.get` too. Before, it did not, and `llvm-as` refused `util.ll`.
import { box } from "./lib";

export const gen = <T>(v: T): i32 => {
  const b = box(9);
  return b.get() + b.value;
};
