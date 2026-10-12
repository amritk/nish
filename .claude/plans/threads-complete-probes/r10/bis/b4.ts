import { scope } from "nish/threads";
class Leaf { x: i32 = 0; }
class Holder {
  leaf: Leaf; leaves: Leaf[];
  constructor() { this.leaf = new Leaf(); this.leaves = [new Leaf()]; }
}
const read = (h: Holder): i32 => h.leaf.x + h.leaves.length;
export const main = (): i32 => {
  const h = new Holder(); const done: i32[] = [0];
  { using s = scope(); s.spawn(read, h, done, 0); }
  console.log(`${done[0]}`); return 0;
};
