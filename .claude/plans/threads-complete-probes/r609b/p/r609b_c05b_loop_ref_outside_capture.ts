import { parallelFrom } from "nish/threads";
interface P { v: i32; }
const f = (): i32 => {
  const ps: P[] = [{ v: 1 }];
  const first = ps[0];
  let s: i32 = 0;
  for (let k: i32 = 0; k < 40; k++) {
    s = s + parallelFrom(1, (i) => first.v + i)[0];
    ps.push({ v: k });
    ps[0].v = 1000;
  }
  return s;
};
export const main = (): i32 => { console.log(`${f()}`); return 0; };
