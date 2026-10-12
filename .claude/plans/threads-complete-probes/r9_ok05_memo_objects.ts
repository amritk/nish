import { scope } from "nish/threads";
import { getOrInsert } from "nish/map";
class Leaf { x: i32 = 0; }
class Mid { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Holder { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
const read = (h: Holder): i32 => h.leaf.x;
const fibo = (n: i32, memo: Map<i32, Leaf>): i32 => {
  if (n < 2) { return n; }
  const hit = memo.get(n);
  if (hit !== undefined) { return hit.x; }
  const r = fibo(n - 1, memo) + fibo(n - 2, memo);
  const l = new Leaf(); l.x = r; memo.set(n, l);
  return r;
};
const bump = (h: Holder): void => {
  const memo = new Map<i32, Leaf>();
  if (fibo(20, memo) !== 6765) { console.log("bad"); }
  getOrInsert(memo, 1, new Leaf()).x = 7;
};
export const main = (): i32 => {
  const h = new Holder(); const done: i32[] = [0];
  { using s = scope(); s.spawn(read, h, done, 0); bump(h); }
  console.log(`${done[0]} ${h.leaf.x}`); return 0;
};
