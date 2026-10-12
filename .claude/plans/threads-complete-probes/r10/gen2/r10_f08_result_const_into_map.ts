import { scope } from "nish/threads";
class Leaf { x: i32 = 0; }
class Holder { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
const read = (h: Holder): i32 => h.leaf.x;
const wrap = (l: Leaf): Result<Leaf, string> => { return Ok(l); };
const bump = (p: Holder): void => {
  const r = wrap(p.leaf); const m = new Map<string, Result<Leaf, string>>(); m.set("k", r);
  const y = m.get("k"); if (y !== undefined) { if (y.isOk()) { y.value.x = 1; } }
};
export const main = (): i32 => {
  const h = new Holder(); const done: i32[] = [0];
  { using s = scope(); s.spawn(read, h, done, 0); bump(h); }
  console.log(`${done[0]} ${h.leaf.x}`); return 0;
};
