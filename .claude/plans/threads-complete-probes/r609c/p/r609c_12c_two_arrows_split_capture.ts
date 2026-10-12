import { parallelFrom } from "nish/threads";
interface P { v: i32; }
export const main = (): i32 => {
  const ps: P[] = [];
  const p: P = { v: 1 };
  ps.push(p);
  const ys = parallelFrom(1, (i) => p.v + i);
  ps[0].v = 5;
  const zs = parallelFrom(1, (i) => p.v * 2 + i);
  console.log(`${ys[0]} ${zs[0]}`);
  return 0;
};
