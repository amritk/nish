import { scope } from "nish/threads";
class Leaf { x: i32 = 0; }
class Mid { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Top { mid: Mid; constructor() { this.mid = new Mid(); } }
class Holder { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Wrap { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Outer { mid: Mid; top: Top; constructor() { this.mid = new Mid(); this.top = new Top(); } }
const read = (h: Holder): i32 => h.leaf.x;
const sumOf = (xs: i32[]): i32 => { let t = 0; for (const x of xs) { t += x; } return t; };
const hist = (xs: i32[]): i32 => { const m = new Map<i32, i32>(); for (const x of xs) { const b = x % 3; m.set(b, (m.get(b) ?? 0) + 1); } let t = 0; for (const k of m.keys()) { t = t * 10 + (m.get(k) ?? 0); } return t; };

export const main = (): i32 => {
  const xs = [3, 1, 4, 1, 5, 9, 2, 6]; const done: i32[] = [0]; let r = 0;
  { using s = scope(); s.spawn(sumOf, xs, done, 0); r = hist(xs); }
  console.log(`${done[0]} ${r}`); return 0;
};
