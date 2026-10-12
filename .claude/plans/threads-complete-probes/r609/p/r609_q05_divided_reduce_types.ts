import { parallelFrom, parallelMap, parallelReduce } from "nish/threads";
const run = (n: i32, mode: i32): string => {
  const tab: i32[] = [3, 1, 4, 1, 5, 9, 2, 6];
  const fk: f64 = 0.5;
  const ik: i64 = toI64(3);
  const on: boolean = n > 100;
  const bk: u8 = toU8(9);
  const xs = parallelFrom(n, (i) => (i % 1000) + tab[i % 8]);
  const r1 = parallelReduce(xs, (a, b) => a + b, 0);
  const fs = parallelMap(xs, (x) => toF64(x) * fk + (on ? 1.0 : 0.0));
  const r2 = parallelReduce(fs, (a, b) => a + b, 0.0);
  const is = parallelMap(xs, (x) => toI64(x) * ik + toI64(toI32(bk)));
  const r3 = parallelReduce(parallelMap(is, (v) => toF64(v)), (a, b) => a + b, 0.0);
  const ms = parallelMap(xs, (x) => (mode === 7 ? x * 7 : x) % 1000 + (on ? 1 : 0));
  const r4 = parallelReduce(ms, (a, b) => a + b, 0);
  const bs = parallelMap(xs, (x) => toU8(x % 100) + bk);
  const r5 = parallelReduce(parallelMap(bs, (b) => toI32(b)), (a, b) => a + b, 0);
  const bools = parallelMap(xs, (x) => on && x % 3 === 0);
  const r6 = parallelReduce(parallelMap(bools, (b) => (b ? 1 : 0)), (a, b) => a + b, 0);
  return `${r1} ${r2} ${r3} ${r4} ${r5} ${r6}`;
};
export const main = (): i32 => {
  console.log(run(3000000, 7));
  console.log(run(2100000, 1));
  console.log(run(50, 7));
  return 0;
};
