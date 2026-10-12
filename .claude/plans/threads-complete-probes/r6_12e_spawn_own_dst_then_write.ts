import { scope } from "nish/threads";
class Leaf { x: i32 = 0; }
class Mid { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Top { mid: Mid; constructor() { this.mid = new Mid(); } }
class Holder { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Wrap { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Outer { mid: Mid; top: Top; constructor() { this.mid = new Mid(); this.top = new Top(); } }
const read = (h: Holder): i32 => h.leaf.x;
const readTop = (t: Top): i32 => t.mid.leaf.x;
const readMid = (m: Mid): i32 => m.leaf.x;
export const main = (): i32 => {
  const h = new Holder(); h.leaf.x = 4; const done: i32[] = [0];
  const d: i32[] = [0];
  { using s = scope(); s.spawn(read, h, done, 0);
    s.spawn(read, h, d, 0); const e = [d]; e[0][0] = 7;
  }
  console.log(`${done[0]} ${d[0]}`); return 0;
};
