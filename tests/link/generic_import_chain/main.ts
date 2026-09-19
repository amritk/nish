// WP18 G7, the chain: a template in one module asking a template in another,
// and a type argument that is a third module's instantiation.
//
// `Box<Pair<i32>>` is monomorphised in `box.ts`, which has never heard of
// `Pair`, so `%struct.Pair$i32` travels there with the request. `doubled<T>`'s
// body asks `num.ts` for `twice<i32>`, which nothing in this file names, so the
// only thing that finds it is the drain sweeping every module until a whole
// pass adds nothing.
import { Box, doubled } from "./box";
import { Pair } from "./pair";

export const main = (): i32 => {
  const p = new Pair<i32>(4, 9);
  const b = new Box<Pair<i32>>(p);
  console.log(`${b.get().second}`);
  return b.get().first + doubled("ignored", 3);
};
