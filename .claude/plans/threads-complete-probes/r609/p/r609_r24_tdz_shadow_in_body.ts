import { parallelFrom } from "nish/threads";
export const main = (): i32 => {
  const k: i32 = 5;
  const ys = parallelFrom(3, (i): i32 => {
    const a = k + i;
    let k2: i32 = a;
    k2 = k2 + 1;
    return k2;
  });
  console.log(`${ys[2]}`);
  return 0;
};
