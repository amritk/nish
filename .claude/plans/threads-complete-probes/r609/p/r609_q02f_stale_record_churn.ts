import { parallelFrom } from "nish/threads";
interface P {
  v: i32;
  w: i32;
}
const f = (): i32 => {
  const ps: P[] = [{ v: 1, w: 2 }];
  const first = ps[0];
  for (let i: i32 = 0; i < 1000; i++) ps.push({ v: i, w: i });
  ps[0].v = 9;
  return parallelFrom(3, (i) => first.v * 1000 + first.w + i)[0];
};
const churn = (): i32 => {
  const junk = new Int32Array(1000000);
  junk.fill(77);
  return junk[5];
};
export const main = (): i32 => { const a = f(); console.log(`${a} ${churn()}`); return 0; };
