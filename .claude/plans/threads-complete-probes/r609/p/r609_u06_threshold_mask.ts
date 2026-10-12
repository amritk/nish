import { parallelMap } from "nish/threads";
const above = (xs: f64[], t: f64): boolean[] => parallelMap(xs, (x) => x > t);
export const main = (): i32 => {
  const m = above([0.5, 1.5, 2.5, 0.1], 1.0);
  console.log(`${m[0]} ${m[1]} ${m[2]} ${m[3]}`);
  return 0;
};
