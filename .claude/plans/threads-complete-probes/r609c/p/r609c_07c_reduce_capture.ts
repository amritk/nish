import { parallelReduce } from "nish/threads";
interface P { v: i32; }
export const main = (): i32 => {
  const src: i32[] = [0, 2, 3, 1];
  const ps: P[] = [];
  const p: P = { v: 1 };
  ps.push(p);
  ps[0].v = 5;
  const m = parallelReduce(src, (a, x) => {
    const b = a > x ? a : x;
    return b > p.v ? b : p.v;
  }, 0);
  console.log(`${m}`);
  return 0;
};
