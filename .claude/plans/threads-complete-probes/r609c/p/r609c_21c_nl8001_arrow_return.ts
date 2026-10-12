import { parallelFrom } from "nish/threads";
export const main = (): i32 => {
  const n: i32 = 2;
  const at = "héllo".indexOf("l");
  const ys = parallelFrom(n, (i): i32 => {
    return at + i;
  });
  console.log(`${ys[1]}`);
  return 0;
};
