import { parallelReduce } from "nish/threads";
const bump = (a: i32[]): i32 => {
  a[0] = a[0] + 1;
  return 0;
};
export const main = (): i32 => {
  const cap: i32[] = [0];
  const xs = new Array<i32>(3000000);
  const total = parallelReduce(xs, (a, b) => a + b + bump(cap), 0);
  console.log(`${cap[0]} ${total}`);
  return 0;
};
