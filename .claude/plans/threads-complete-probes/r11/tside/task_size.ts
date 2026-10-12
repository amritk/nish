import { scope } from "nish/threads";
class Leaf { x: i32 = 0; }
class Holder {
  table: Map<string, Leaf>; nums: Map<string, i32>; tset: Set<string>;
  constructor() { this.table = new Map<string, Leaf>(); this.table.set("x", new Leaf()); this.nums = new Map<string, i32>(); this.nums.set("x", 1); this.tset = new Set<string>(); this.tset.add("x"); }
}
const read = (h: Holder): i32 => { return h.table.size; };
export const main = (): i32 => {
  const h = new Holder(); const done: i32[] = [0];
  { using s = scope(); s.spawn(read, h, done, 0); }
  console.log(`${done[0]} ${read(h)}`); return 0;
};
