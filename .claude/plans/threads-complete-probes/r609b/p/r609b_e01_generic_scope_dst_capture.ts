import { scope, parallelFrom } from "nish/threads";
const work = (x: i32): i32 => x * 2;
const g = <T>(tag: T[]): i32 => {
  const done: i32[] = [0];
  let r: i32 = 0;
  {
    using s = scope();
    s.spawn(work, 21, done, 0);
    r = parallelFrom(3, (i) => done[0] + i + toI32(tag.length))[2];
  }
  return r * 1000 + done[0];
};
export const main = (): i32 => {
  const a: f64[] = [1.0];
  const b: string[] = ["x"];
  console.log(`${g(a)} ${g(b)}`);
  return 0;
};
