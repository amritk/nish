import { scope } from "nish/threads";
import { getOrInsert } from "nish/map";
class Leaf { x: i32 = 0; }
class Mid { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Holder { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
const read = (h: Holder): i32 => h.leaf.x;
const put = (pm: Map<string, Mid>, h: Holder): void => { const g = pm.get("k"); if (g !== undefined) { g.leaf = h.leaf; } };
const work = (h: Holder): i32 => {
  const m = new Map<string, Mid>();
  m.set("a", new Mid());
  const m2 = new Map<string, Mid>();
  m2.set("k", getOrInsert(m, "a", new Mid()));
  put(m2, h);
  const l = m.get("a");
  if (l !== undefined) { l.leaf.x = 1; }
  return 0;
};
export const main = (): i32 => {
  const h = new Holder(); const done: i32[] = [0]; let r = 0;
  { using s = scope(); s.spawn(read, h, done, 0); r = work(h); }
  console.log(`${done[0]} ${r}`); return 0;
};
