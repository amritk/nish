import { scope } from "nish/threads";
class Leaf { x: i32 = 0; }
class Mid { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Top { mid: Mid; constructor() { this.mid = new Mid(); } }
class Holder { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Wrap { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Outer { mid: Mid; top: Top; constructor() { this.mid = new Mid(); this.top = new Top(); } }
const read = (h: Holder): i32 => h.leaf.x;
class Words { ws: string[]; constructor(ws: string[]) { this.ws = ws; } }
const nWords = (w: Words): i32 => w.ws.length;
const count = (w: Words): i32 => { const m = new Map<string, i32>(); for (const x of w.ws) { m.set(x, (m.get(x) ?? 0) + 1); } return m.size * 100 + (m.get("a") ?? 0); };

export const main = (): i32 => {
  const w = new Words(["a", "b", "a", "c", "a"]); const done: i32[] = [0]; let r = 0;
  { using s = scope(); s.spawn(nWords, w, done, 0); r = count(w); }
  console.log(`${done[0]} ${r}`); return 0;
};
