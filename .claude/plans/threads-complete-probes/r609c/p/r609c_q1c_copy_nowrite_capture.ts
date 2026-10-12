import { parallelFrom } from "nish/threads";
interface P { v: i32; }
export const main = (): i32 => {
  const ps: P[] = [];
  const p: P = { v: 1 };
  ps.push(p);
  const ys = parallelFrom(2, (i) => p.v + ps[0].v + i);
  console.log(`${ys[1]}`);
  return 0;
};
