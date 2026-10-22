// #612: indexing a fresh `const` destination, reading its `length`, calling
// its `fill` or walking it with `for...of` before the call hands it to no one,
// so a body may still read a `parallelMap` result beside it.
import { parallelMap, parallelMapInto } from "nish/threads";

export const main = (): i32 => {
  const src: i32[] = [3, 14, 15, 92, 65, 35, 89, 79];
  const weights = parallelMap(src, (x) => x % 13);
  const d = new Array<i32>(8);
  d.fill(5);
  d[1] = d[0] + d.length;
  let seen: i32 = 0;
  for (const v of d) {
    seen = seen + v;
  }
  const n: i32 = d.length;
  parallelMapInto(src, d, (x) => weights[(x + 1) % n] + 1);
  console.log(`${seen} ${d[0]} ${d[7]}`);
  return 0;
};
