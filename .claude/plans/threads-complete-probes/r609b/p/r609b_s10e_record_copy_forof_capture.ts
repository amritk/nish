import { parallelFrom } from "nish/threads";
interface P { v: i32; }
export const main = (): i32 => {
  const p: P = { v: 1 };
  const ps: P[] = [p];
  ps[0].v = 5;
  const ys = parallelFrom(2, (i) => p.v * 10 + ps[0].v + i);
  console.log(`${ys[0]}`);
  return 0;
};
