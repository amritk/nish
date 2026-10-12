import { scope } from "nish/threads";
class Leaf { x: i32 = 0; }
class Holder {
  leaf: Leaf;
  constructor() { this.leaf = new Leaf(); }
}
const read = (h: Holder): i32 => h.leaf.x;
export const main = (): i32 => {
  const h = new Holder(); const g = new Holder(); const d1: i32[] = [0]; const d2: i32[] = [0];
  { using s = scope(); s.spawn(read, h, d1, 0); s.spawn(read, g, d2, 0); }
  console.log(`${d1[0]} ${d2[0]}`); return 0;
};
