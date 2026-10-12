import { scope } from "nish/threads";
class Leaf { x: i32 = 0; }
class Mid { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Top { mid: Mid; constructor() { this.mid = new Mid(); } }
class Holder { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Wrap { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Outer { mid: Mid; top: Top; constructor() { this.mid = new Mid(); this.top = new Top(); } }
const read = (h: Holder): i32 => h.leaf.x;
const sumOf = (xs: i32[]): i32 => { let t = 0; for (const x of xs) { t += x; } return t; };
const tot = (xs: i32[]): i32 => { const m = new Map<string, i32>(); let i = 0; for (const x of xs) { m.set(`k${i}`, x * 2); i++; } let t = 0; for (const v of m.values()) { t += v; } return t; };

export const main = (): i32 => {
  const xs = [1, 2, 3, 4]; const done: i32[] = [0]; let r = 0;
  { using s = scope(); s.spawn(sumOf, xs, done, 0); r = tot(xs); }
  console.log(`${done[0]} ${r}`); return 0;
};
