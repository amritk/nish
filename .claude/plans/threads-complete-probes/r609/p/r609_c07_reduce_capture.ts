import { parallelFrom, parallelReduce } from "nish/threads";
export const main = (): i32 => {
  const n: i32 = 3000000;
  const scale: f64 = 0.001;
  const off: i32 = 17;
  const xs = parallelFrom(n, (i) => toF64((i + off) % 1000) * scale);
  const total = parallelReduce(xs, (a, b) => a + b, 0.0);
  const m: i32 = 1000003;
  const ints = parallelFrom(n, (i) => (i * off) % m);
  const mx = parallelReduce(ints, (a, b) => Math.max(a, b), 0);
  console.log(`${total} ${mx}`);
  return 0;
};
