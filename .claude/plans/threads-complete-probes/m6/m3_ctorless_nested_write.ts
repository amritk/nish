import { scope } from "nish/threads";
class Holder { v: i32 = 1; }
class Acc { tot: i32[] = [0, 0]; }
const read = (h: Holder): i32 => h.v;
const fill = (h: Holder): i32 => { const a = new Acc(); a.tot[0] = h.v; return a.tot[0]; };
export const main = (): i32 => {
  const h = new Holder(); const done: i32[] = [0]; let r = 0;
  { using s = scope(); s.spawn(read, h, done, 0); r = fill(h); }
  console.log(`${done[0]} ${r}`); return 0;
};
