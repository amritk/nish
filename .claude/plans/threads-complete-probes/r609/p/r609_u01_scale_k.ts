import { parallelMap } from "nish/threads";
export const main = (): i32 => {
  const xs: f64[] = [1.0, 2.0, 3.0];
  const k: f64 = 2.5;
  const ys = parallelMap(xs, (x) => x * k);
  console.log(`${ys[0]} ${ys[1]} ${ys[2]}`);
  return 0;
};
