import { scope } from "nish/threads";
import { getOrInsert } from "nish/map";
class Holder { v: i32 = 1; }
const read = (h: Holder): i32 => h.v;
const tally = (h: Holder): i32 => {
  const m = new Map<string, i32>();
  getOrInsert(m, "a", h.v);
  return m.size;
};
export const main = (): i32 => {
  const h = new Holder(); const done: i32[] = [0]; let r = 0;
  { using s = scope(); s.spawn(read, h, done, 0); r = tally(h); }
  console.log(`${done[0]} ${r}`); return 0;
};
