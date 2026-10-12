import { scope } from "nish/threads";
import { getOrInsert, reserve } from "nish/map";
class Leaf { x: i32 = 0; }
class Holder {
  leaf: Leaf; arr: i32[]; table: Map<string, Leaf>; tables: Map<string, Leaf>[]; am: Map<string, i32[]>;
  lset: Set<Leaf>; km: Map<Leaf, i32>; nest: Map<string, Map<string, Leaf>>; inner: Map<string, Leaf>;
  constructor() {
    this.leaf = new Leaf(); this.arr = [1];
    this.table = new Map<string, Leaf>(); this.table.set("x", this.leaf);
    const t0 = new Map<string, Leaf>(); t0.set("x", new Leaf()); this.tables = [t0];
    this.am = new Map<string, i32[]>(); this.am.set("x", this.arr);
    this.lset = new Set<Leaf>(); this.lset.add(this.leaf);
    this.km = new Map<Leaf, i32>(); this.km.set(this.leaf, 1);
    this.inner = new Map<string, Leaf>(); this.inner.set("x", new Leaf());
    this.nest = new Map<string, Map<string, Leaf>>(); this.nest.set("x", this.inner);
  }
}
class W {
  m: Map<string, Leaf>;
  constructor(m: Map<string, Leaf>) { this.m = m; }
  del(): void { this.m.delete("x"); }
  has(): boolean { return this.m.has("x"); }
}
const tableOf = (h: Holder): Map<string, Leaf> => h.table;
const read = (h: Holder): i32 => h.table.size + h.tables[0].size * 10 + h.inner.size * 100 + h.lset.size * 1000 + h.km.size * 10000;
const touch = (l: Leaf): string => { l.x = 5; return "x"; };
const name = (l: Leaf): string => l.x > 3 ? "y" : "x";
const readLeaf = (l: Leaf): i32 => l.x;
const readArr = (a: i32[]): i32 => a.length * 10 + a[0];
const bump = (p: Holder, c: boolean): void => {
  const o = new Map<string, Leaf>(); getOrInsert(o, "k", p.leaf).x = 5;
};
export const main = (): i32 => {
  const h = new Holder(); const done: i32[] = [0]; const c = h.leaf.x === 0;
  {
    using s = scope();
    s.spawn(readLeaf, h.leaf, done, 0);
    bump(h, c);
  }
  console.log(`${done[0]} ${readLeaf(h.leaf)}`);
  return 0;
};
