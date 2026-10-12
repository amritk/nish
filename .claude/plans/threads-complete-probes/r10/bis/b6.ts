import { scope } from "nish/threads";
class Leaf { x: i32 = 0; }
class Holder {
  leaf: Leaf; arr: i32[];
  constructor() { this.leaf = new Leaf(); this.arr = [0]; }
}
const read = (h: Holder): i32 => {
  let t = h.leaf.x + h.arr[0] * 100;
  t += 5;
  return t;
};
export const main = (): i32 => {
  const h = new Holder(); const done: i32[] = [0];
  { using s = scope(); s.spawn(read, h, done, 0); }
  console.log(`${done[0]} ${read(h)}`); return 0;
};
