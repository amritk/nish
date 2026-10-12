import { scope } from "nish/threads";
import { getOrInsert, reserve } from "nish/map";
import { Channel } from "nish/threads";
class Leaf { x: i32 = 0; }
class Mid { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Holder {
  leaf: Leaf; mid: Mid; arr: i32[]; table: Map<string, Leaf>; leaves: Leaf[];
  constructor() {
    this.leaf = new Leaf(); this.mid = new Mid(); this.arr = [0];
    this.table = new Map<string, Leaf>(); this.table.set("x", this.leaf); this.leaves = [new Leaf()];
  }
}
const read = (h: Holder): i32 => {
  let t = h.leaf.x + h.mid.leaf.x * 10 + h.arr[0] * 100 + h.leaves[0].x * 10000;
  t += h.leaves.length * 1000;
  t += h.table.size * 100000;
  return t;
};
class Root { a: Holder; b: Holder; constructor() { this.a = new Holder(); this.b = new Holder(); } }
const readRoot = (r: Root): i32 => read(r.a) * 10 + read(r.b);
class Box {
  items: Leaf[];
  constructor() { this.items = []; }
  set(k: i32, v: Leaf): void { if (k >= 0) { this.items.push(v); } }
  get(k: i32): Leaf { return this.items[k - 1]; }
  has(k: i32): boolean { return k > 0 && this.items.length > 0; }
  add(v: Leaf): Box { this.items.push(v); return this; }
}
const bump = (p: Holder, q: Holder, c1: boolean, c2: boolean): void => {
  const box = new Box(); box.add(p.leaf); box.items[0].x = 1;
};
export const main = (): i32 => {
  const r = new Root(); const done: i32[] = [0];
  const c1 = r.a.leaf.x === 0; const c2 = r.b.leaf.x !== 0;
  { using s = scope(); s.spawn(readRoot, r, done, 0); bump(r.a, r.b, c1, c2); }
  console.log(`${done[0]} ${readRoot(r)}`); return 0;
};
