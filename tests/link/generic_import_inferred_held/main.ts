// A `Box<i32>` sent into `util.ts` as a type argument before that module calls
// `box` itself. `util.ll`, the golden beside this file, declares the methods.
import { box } from "./lib";
import { gen } from "./util";

export const main = (): i32 => {
  const x = box(1);
  console.log(`${gen(x) + x.get()}`);
  return x.value;
};
