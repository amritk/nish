import { scope } from "nish/threads";
class Leaf { x: i32 = 0; }
class Mid { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Top { mid: Mid; constructor() { this.mid = new Mid(); } }
class Holder { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Wrap { leaf: Leaf; constructor() { this.leaf = new Leaf(); } }
class Outer { mid: Mid; top: Top; constructor() { this.mid = new Mid(); this.top = new Top(); } }
const read = (h: Holder): i32 => h.leaf.x;
class Num { v: i32 = 20; }
const readN = (n: Num): i32 => n.v;
const fib = (n: i32, memo: Map<i32, i32>): i32 => { const c = memo.get(n); if (c !== undefined) { return c; } const r = n < 2 ? n : fib(n - 1, memo) + fib(n - 2, memo); memo.set(n, r); return r; };
const run = (n: Num): i32 => { const memo = new Map<i32, i32>(); return fib(n.v, memo); };

export const main = (): i32 => {
  const n = new Num(); const done: i32[] = [0]; let r = 0;
  { using s = scope(); s.spawn(readN, n, done, 0); r = run(n); }
  console.log(`${done[0]} ${r}`); return 0;
};
