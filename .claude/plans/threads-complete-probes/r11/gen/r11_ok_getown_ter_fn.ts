import { scope } from "nish/threads";
import { getOrInsert, reserve } from "nish/map";
class Leaf { x: i32 = 0; }
class Inner { table: Map<string, Leaf>; constructor() { this.table = new Map<string, Leaf>(); this.table.set("x", new Leaf()); } }
class Holder {
  leaf: Leaf; table: Map<string, Leaf>; tset: Set<string>; tables: Map<string, Leaf>[]; inner: Inner;
  nums: Map<string, i32>; nest: Map<string, Map<string, Leaf>>;
  constructor() {
    this.leaf = new Leaf();
    this.table = new Map<string, Leaf>(); this.table.set("x", this.leaf);
    this.tset = new Set<string>(); this.tset.add("x");
    const t0 = new Map<string, Leaf>(); t0.set("x", new Leaf()); this.tables = [t0];
    this.inner = new Inner();
    this.nums = new Map<string, i32>(); this.nums.set("x", 1);
    const n0 = new Map<string, Leaf>(); n0.set("x", new Leaf());
    this.nest = new Map<string, Map<string, Leaf>>(); this.nest.set("x", n0);
  }
}
const read = (h: Holder): i32 => {
  let t = h.table.size + h.tset.size * 10 + h.tables[0].size * 100 + h.inner.table.size * 1000 + h.nums.size * 10000;
  return t;
};
const readNest = (h: Holder): i32 => h.nest.size;
const readInner = (m: Map<string, Leaf>): i32 => m.size;
const readLeaf = (l: Leaf): i32 => l.x;
const readMap = (m: Map<string, Leaf>): i32 => m.size;
const bump = (p: Holder, c: boolean): void => {
  const o = new Map<string, Leaf>(); const v = (c ? p.table : p.tables[0]).get("x"); if (v !== undefined) { o.set("k", v); } if (o.size > 3) { console.log("big"); }
};
export const main = (): i32 => {
  const h = new Holder(); const done: i32[] = [0]; const c = h.leaf.x === 0;
  {
    using s = scope();
    s.spawn(read, h, done, 0);
    bump(h, c);
  }
  console.log(`${done[0]} ${read(h)}`);
  return 0;
};
