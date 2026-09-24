// #193: two modules of one package each declare a class `Base`, with fields
// alone. A struct type is interned by its name, so the two were one type id:
// `makeBase()`'s `Base` was accepted as this module's, and `b.c` read `./lib`'s
// object at this layout's offsets and printed 0. Neither class has a member
// symbol for `rejectSymbolClashes` to see, so the name itself is refused.
import { makeBase } from "./lib";

class Base {
  a: f64 = 1.5;
  b: string = "hi";
  c: i32 = 7;
}

export const main = (): i32 => {
  const b: Base = makeBase();
  console.log(b.c);
  return 0;
};
