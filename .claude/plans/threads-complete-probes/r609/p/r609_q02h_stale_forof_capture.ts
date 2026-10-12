import { parallelFrom } from "nish/threads";
interface P {
  v: i32;
}
const f = (): i32 => {
  const ps: P[] = [{ v: 1 }];
  let t: i32 = 0;
  for (const p of ps) {
    ps.push({ v: 5 });
    ps[0].v = 7;
    t = t + parallelFrom(1, (i) => p.v + i)[0];
    if (ps.length > 3) break;
  }
  return t;
};
export const main = (): i32 => { console.log(`${f()}`); return 0; };
