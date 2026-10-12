import { parallelFrom } from "nish/threads";
export const main = (): i32 => {
  let total: i32 = 0;
  for (let k: i32 = 0; k < 5; k++) {
    using a = arena();
    const t = new Array<i32>(1000);
    for (let i: i32 = 0; i < 1000; i++) t[i] = i * k;
    const ys = parallelFrom(2000000, (i) => t[i % 1000]);
    let s: i32 = 0;
    for (const y of ys) s = (s + y) % 1000003;
    total = total + s;
  }
  console.log(`${total}`);
  return 0;
};
