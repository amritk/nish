import { scope } from "nish/threads";
class Leaf { x: i32 = 0; }
class Holder { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
interface Bag { a: Leaf; }
const read = (h: Holder): i32 => h.leaf.x;
const bump = (b: Bag): void => { b.a.x = 1; };
export const main = (): i32 => {
  const h = new Holder(); const done: i32[] = [0];
  { using s = scope(); s.spawn(read, h, done, 0); bump({ a: h.leaf }); }
  console.log(`${done[0]} ${h.leaf.x}`); return 0;
};
