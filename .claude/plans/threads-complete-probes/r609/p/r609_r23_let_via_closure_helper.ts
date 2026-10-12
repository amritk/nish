import { parallelFrom } from "nish/threads";
export const main = (): i32 => {
  let n: i32 = 1;
  n = n * 2;
  const ys = parallelFrom(3, (i): i32 => {
    const q = n;
    return q + i;
  });
  console.log(`${ys[2]}`);
  return 0;
};
