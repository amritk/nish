import { parallelFrom } from "nish/threads";
interface P { v: i32; }
const f = (): i32 => {
  const ps: P[] = [{ v: 1 }, { v: 2 }];
  let s: i32 = 0;
  for (const p of ps) {
    s = s + parallelFrom(1, (i) => p.v + i)[0];
  }
  ps.push({ v: 3 });
  return s;
};
export const main = (): i32 => { console.log(`${f()}`); return 0; };
