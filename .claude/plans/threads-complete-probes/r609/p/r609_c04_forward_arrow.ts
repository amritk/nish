import { parallelMap } from "nish/threads";
const fwd = <T>(xs: T[], f: (x: T) => T): T[] => parallelMap(xs, f);
export const main = (): i32 => {
  const k: i32 = 3;
  const ys = fwd([1, 2, 3], (x) => x * k);
  console.log(`${ys[2]}`);
  return 0;
};
