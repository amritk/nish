// The asking half of #613: `const b = box(7)` holds a `Box<i32>` that no
// annotation here names. The layout `./lib` minted for `box`'s result comes
// with the call, so this module's IR defines `%struct.Box$i32` and declares
// the methods `lib.ll` defines; before, it used the struct and never defined
// it, and the compile stopped.
import { box, unbox } from "./lib";

export const main = (): i32 => {
  const b = box(7);
  console.log(`${b.get() + b.value}`);
  const word = box("inferred");
  console.log(word.get());
  return unbox(b);
};
