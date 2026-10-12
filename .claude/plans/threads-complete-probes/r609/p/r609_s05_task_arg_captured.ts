import { parallelFrom, scope } from "nish/threads";
class Box {
  v: i32[];
  constructor() {
    this.v = [1, 2, 3];
  }
}
const fill = (b: Box): i32 => {
  b.v[0] = 100;
  return 0;
};
export const main = (): i32 => {
  const b = new Box();
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(fill, b, out, 0);
    const ys = parallelFrom(3, (i) => b.v[0] + i);
    console.log(`in block ${ys[2]}`);
  }
  console.log(`${b.v[0]}`);
  return 0;
};
