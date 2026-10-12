import { parallelMap } from "nish/threads";
export const main = (): i32 => {
  const xs64: i64[] = [1, 2, 3];
  const k: i32 = 2;
  const ys = parallelMap(xs64, (x) => x * k);
  console.log(`${ys[0]} ${ys[2]}`);
  return 0;
};
