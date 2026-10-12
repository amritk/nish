import { scope } from "nish/threads";
class Leaf { x: i32 = 0; }
class Holder {
  leaf: Leaf;
  constructor() { this.leaf = new Leaf(); }
}
const read = (h: Holder): i32 => h.leaf.x;
export const main = (): i32 => {
  const h = new Holder(); const g = new Holder(); const done: i32[] = [0, 0];
  { using s = scope(); s.spawn(read, h, done, 0); s.spawn(read, g, done, 1); }
  console.log(`${done[0]} ${done[1]}`); return 0;
};
