import { scope } from "nish/threads";
import { getOrInsert } from "nish/map";
class Leaf { x: i32 = 0; }
class Mid { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Holder { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
const read = (h: Holder): i32 => h.leaf.x;
class Mid2 { leaf: Leaf; constructor() { this.leaf = new Leaf(); } attach(a: Mid2[]): void { a.push(this); } attachTo(o: Box2): void { o.mid = this; } }
class Box2 { mid: Mid2; constructor() { this.mid = new Mid2(); } }
const bump = (h: Holder): void => {
  const m = new Map<string, Mid2>(); const arr: Mid2[] = [];
  getOrInsert(m, "a", new Mid2()).attach(arr);
  arr[0].leaf = h.leaf;
  getOrInsert(m, "a", new Mid2()).leaf.x = 1;
};
export const main = (): i32 => {
  const h = new Holder(); const done: i32[] = [0];
  { using s = scope(); s.spawn(read, h, done, 0); bump(h); }
  console.log(`${done[0]} ${h.leaf.x}`); return 0;
};
