import { parallelFrom } from "nish/threads";
interface P {
  v: i32;
}
const grow = (ps: P[]): void => {
  for (let i: i32 = 0; i < 100; i++) ps.push({ v: 100 + i });
};
const f = (): i32 => {
  const ps: P[] = [{ v: 1 }];
  const first = ps[0];
  grow(ps);
  ps[0].v = 9;
  return parallelFrom(1, (i) => first.v + i)[0];
};
export const main = (): i32 => { console.log(`${f()}`); return 0; };
