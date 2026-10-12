import { parallelFrom } from "nish/threads";
interface P { v: i32; }
export const main = (): i32 => {
  const ps: P[] = [];
  const p: P = { v: 1 };
  ps.push(p);
  p.v = 5;
  const ys = parallelFrom(1, (i) => ps[0].v + i);
  console.log(`${ys[0]}`);
  return 0;
};
