import { scope } from "nish/threads";
class Leaf { x: i32 = 0; }
class Mid { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Top { mid: Mid; constructor() { this.mid = new Mid(); } }
class Holder { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
const G: Leaf = new Leaf();
const read = (h: Holder): i32 => h.leaf.x;
const getG = (): Leaf => G;
const put = (a: Top): void => { a.mid.leaf = getG(); };
const bump = (h: Holder): void => { const t = new Top(); put(t); t.mid.leaf.x = 1; };
export const main = (): i32 => {
  const h = new Holder(); h.leaf = G; const done: i32[] = [0];
  { using s = scope(); s.spawn(read, h, done, 0); bump(h); }
  console.log(`${done[0]} ${h.leaf.x}`); return 0;
};
