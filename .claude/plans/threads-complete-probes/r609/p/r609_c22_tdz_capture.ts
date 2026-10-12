import { parallelFrom } from "nish/threads";
const k: i32 = 1;
export const main = (): i32 => {
  const ys = parallelFrom(3, (i) => i * k);
  const k: i32 = 5;
  console.log(`${ys[2]} ${k}`);
  return 0;
};
