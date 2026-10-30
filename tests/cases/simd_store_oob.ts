// A store whose last lane is past the end panics, naming that lane and the
// length, as a load does; the store before it, which fits, lands.
import { splatI32x4, store } from "nish:simd";

export const main = (): number => {
  const xs: i32[] = [1, 2, 3, 4, 5];
  store(splatI32x4(7), xs, 1);
  console.log(xs[4]);
  store(splatI32x4(9), xs, 2);
  return 0;
};
