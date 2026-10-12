import { scope } from "nish/threads";
import { getOrInsert } from "nish/map";
class Leaf { x: i32 = 0; }
class Mid { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Holder { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
const read = (h: Holder): i32 => h.leaf.x;
interface SB { s: string; }
const bump = (h: Holder): void => {
  const names = new Map<string, string>(); names.set("a", "x"); const ss: string[] = []; const m = new Map<string, Mid>();
  ss.push(getOrInsert(names, "a", "y"));
  ss.push(names.get("b") ?? "z");
  const o: SB = { s: getOrInsert(names, "c", "w") };
  getOrInsert(m, "a", new Mid()).leaf.x = 1;
  if (ss.join("") + o.s !== "xzw") { console.log("bad"); }
};
export const main = (): i32 => {
  const h = new Holder(); const done: i32[] = [0];
  { using s = scope(); s.spawn(read, h, done, 0); bump(h); }
  console.log(`${done[0]} ${h.leaf.x}`); return 0;
};
