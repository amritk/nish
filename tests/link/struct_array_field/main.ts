// An importer of a class with an array field has to declare the array header
// itself: it emits `%struct.Bag`'s whole body, `%struct.nish_array*` and all,
// so the type is referenced here even though nothing in this module touches an
// array. Nothing else in this module would ever ask for the header — no
// signature mentions an array and `add` does the pushing next door — and before
// the fix `main.ll` named `%struct.nish_array` without defining it, which
// `llvm-as` and clang both refuse.
import { Bag } from "./lib";

export const main = (): number => {
  const bag = new Bag();
  bag.add(7);
  return bag.add(8);
};
