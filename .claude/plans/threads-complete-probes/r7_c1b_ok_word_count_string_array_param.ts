import { scope } from "nish/threads";
class Leaf { x: i32 = 0; }
class Mid { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Top { mid: Mid; constructor() { this.mid = new Mid(); } }
class Holder { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Wrap { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Outer { mid: Mid; top: Top; constructor() { this.mid = new Mid(); this.top = new Top(); } }
const read = (h: Holder): i32 => h.leaf.x;
const nWords = (ws: string[]): i32 => ws.length;
const count = (ws: string[]): i32 => { const m = new Map<string, i32>(); for (const x of ws) { m.set(x, (m.get(x) ?? 0) + 1); } return m.size * 100 + (m.get("a") ?? 0); };

export const main = (): i32 => {
  const ws = ["a", "b", "a", "c", "a"]; const done: i32[] = [0]; let r = 0;
  { using s = scope(); s.spawn(nWords, ws, done, 0); r = count(ws); }
  console.log(`${done[0]} ${r}`); return 0;
};
