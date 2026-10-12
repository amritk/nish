import { parallelFrom, parallelMap, parallelReduce } from "nish/threads";
export const main = (): i32 => {
  const k: i32 = 3;
  const xs: i32[] = [1, 2, 3];
  console.log(`${parallelMap(xs, (x) => x * k)[2]}`);
  const m = Math.max(parallelReduce(xs, (a, b) => a + b, 0), parallelFrom(3, (i) => i * k)[2]);
  const t = k > 2 ? parallelFrom(3, (i) => i + k)[2] : 0;
  const f = toF64(parallelMap(xs, (x) => x + k)[0]);
  console.log(`${m} ${t} ${f}`);
  return 0;
};
