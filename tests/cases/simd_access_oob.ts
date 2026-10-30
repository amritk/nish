// A load whose last lane is past the array's end panics before it reads,
// naming its last lane and the length: the check covers the whole vector.
import { loadI32x4, extract } from "nish:simd";

export const main = (): number => {
  const xs: i32[] = [1, 2, 3, 4, 5];
  console.log(extract(loadI32x4(xs, 1), 3));
  console.log(extract(loadI32x4(xs, 2), 0));
  return 0;
};
