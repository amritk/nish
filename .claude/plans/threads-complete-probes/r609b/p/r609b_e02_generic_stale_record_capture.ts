import { parallelFrom } from "nish/threads";
interface P { v: i32; }
const g = <T>(tag: T[]): i32 => {
  const ps: P[] = [{ v: 1 }, { v: 2 }];
  const last = ps[1];
  ps.pop();
  ps.push({ v: 50 });
  return parallelFrom(1, (i) => last.v + i + toI32(tag.length))[0];
};
export const main = (): i32 => {
  const a: f64[] = [1.0];
  const b: string[] = ["x"];
  console.log(`${g(a)} ${g(b)}`);
  return 0;
};
