import { parallelReduce, parallelFrom } from "nish/threads";
export const main = (): i32 => {
  let total: i32 = 0;
  for (let k: i32 = 0; k < 6; k++) {
    const t: i32[] = [];
    for (let i: i32 = 0; i < 500; i++) t.push(i + k);
    const label = `pass ${k}`;
    const ys = parallelFrom(1000000, (i) => t[i % 500] + label.length);
    total = (total + parallelReduce(ys, (a, b) => (a + b) % 1000003, 0)) % 1000003;
  }
  console.log(`${total}`);
  return 0;
};
