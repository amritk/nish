import { parallelFrom } from "nish/threads";
interface P { v: i32; }
const f = (): i32 => {
  const ps: P[] = [{ v: 1 }, { v: 2 }, { v: 3 }];
  const first = ps[0];
  ps.splice(0, 1);
  ps.push({ v: 50 });
  return parallelFrom(1, (i) => first.v + i)[0];
};
export const main = (): i32 => { console.log(`${f()}`); return 0; };
