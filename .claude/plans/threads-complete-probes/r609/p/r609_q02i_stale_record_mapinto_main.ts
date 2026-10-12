import { parallelMapInto } from "nish/threads";
interface P {
  v: i32;
}
const f = (xs: i32[]): i32 => {
  const ps: P[] = [{ v: 1 }];
  const first = ps[0];
  ps.push({ v: 2 });
  ps[0].v = 9;
  const out: i32[] = [0, 0];
  parallelMapInto(xs, out, (x) => first.v + x);
  return out[0];
};
export const main = (): i32 => { console.log(`${f([1, 2])}`); return 0; };
