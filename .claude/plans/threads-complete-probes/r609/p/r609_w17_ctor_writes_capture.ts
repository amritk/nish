import { parallelFrom } from "nish/threads";
class Box {
  v: i32;
  constructor(sink: i32[], i: i32) {
    sink[0] = sink[0] + 1;
    this.v = i;
  }
}
export const main = (): i32 => {
  const cap: i32[] = [0];
  const ys = parallelFrom(3000000, (i): i32 => new Box(cap, i).v);
  console.log(`${cap[0]} ${ys.length}`);
  return 0;
};
