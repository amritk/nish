import { parallelFrom } from "nish/threads";
const run = (n: i32): i32 => {
  const a = new Array<i32>(n);
  const b = new Array<i32>(n - 2);
  b.fill(4);
  let s: i32 = 0;
  for (let i: i32 = 0; i < a.length; i++) {
    const j: i32 = i;
    s = s + parallelFrom(2, (k) => b[j] + k)[1];
  }
  return s;
};
export const main = (): i32 => { console.log(`${run(10)}`); return 0; };
