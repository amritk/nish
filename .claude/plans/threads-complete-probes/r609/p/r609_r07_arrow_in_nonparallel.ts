import { parallelMap } from "nish/threads";
const apply = <T>(v: T, f: (x: T) => T): T => f(v);
export const main = (): i32 => {
  const k: i32 = 4;
  const ys = parallelMap([1, 2], (x) => apply(x, (y) => y + k));
  console.log(`${ys[1]}`);
  return 0;
};
