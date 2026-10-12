import { parallelMapInto } from "nish/threads";
class Acc {
  v: i32[];
  constructor() {
    this.v = [0];
  }
  add(x: i32): i32 {
    this.v[0] = this.v[0] + x;
    return this.v[0];
  }
}
const run = (acc: Acc, xs: i32[], dst: i32[]): void => {
  parallelMapInto(xs, dst, (x) => acc.add(1) - acc.v[0] + x);
};
export const main = (): i32 => {
  const acc = new Acc();
  const xs = new Array<i32>(3000000);
  const dst = new Array<i32>(3000000);
  run(acc, xs, dst);
  console.log(`${acc.v[0]}`);
  return 0;
};
