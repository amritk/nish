import { parallelFrom } from "nish/threads";
export const main = (): i32 => {
  const k: i32 = 5;
  const ys = parallelFrom(3, (i): i32 => {
    const a = k + i;
    let k: i32 = a;
    k = k + 1;
    return k;
  });
  console.log(`${ys[2]}`);
  return 0;
};
