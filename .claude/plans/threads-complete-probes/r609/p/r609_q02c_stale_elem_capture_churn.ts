import { parallelMap } from "nish/threads";
class P { v: i32 = 1; w: i32 = 2; }
const f = (xs: i32[]): i32 => {
  const ps: P[] = [new P()];
  const first = ps[0];
  for (let i: i32 = 0; i < 1000; i++) ps.push(new P());
  ps[0].v = 9;
  const junk = new Int32Array(100000);
  junk.fill(12345);
  return parallelMap(xs, (x) => first.v * 1000 + first.w + x)[0] + junk[0] * 0;
};
export const main = (): i32 => { console.log(`${f([1, 2])}`); return 0; };
