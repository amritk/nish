// A load whose first lane is already past the end panics before it reads,
// naming that lane and the length.
import { loadI32x4, extract } from "nish:simd";

export const main = (): number => {
  const xs: i32[] = [1, 2, 3, 4, 5];
  console.log(extract(loadI32x4(xs, 0), 3));
  console.log(extract(loadI32x4(xs, 6), 0));
  return 0;
};
