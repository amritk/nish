// A load at a negative index panics before it reads, with the words `xs[i]`
// gives one: the index as the unsigned 64-bit value the check compares.
import { loadI32x4, extract } from "nish:simd";

export const main = (): number => {
  const xs: i32[] = [1, 2, 3, 4, 5];
  console.log(extract(loadI32x4(xs, 1), 0));
  const i: i32 = 0 - 1;
  console.log(extract(loadI32x4(xs, i), 0));
  return 0;
};
