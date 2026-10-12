import { scope } from "nish/threads";
class Leaf { x: i32 = 0; }
class Holder {
  leaf: Leaf; table: Map<string, Leaf>;
  constructor() { this.leaf = new Leaf(); this.table = new Map<string, Leaf>(); this.table.set("x", new Leaf()); }
}
const read = (h: Holder): i32 => h.leaf.x + h.table.size;
export const main = (): i32 => {
  const h = new Holder(); const done: i32[] = [0];
  { using s = scope(); s.spawn(read, h, done, 0); }
  console.log(`${done[0]}`); return 0;
};
