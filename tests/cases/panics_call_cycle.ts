// Panic sites: a cycle of calls in which each function calls the next before
// it checks anything of its own. Its first function in declaration order that
// has a site of its own, or a call out of the cycle, passes over its calls back
// into the cycle, and the rest of the cycle reaches what it reaches: so every
// `"via"` into a cycle is that function's kind, whatever the others check. The
// depth is unsigned, so `d - 1` is not a site, and `k` comes from the argument
// count, so no caller proves the additions.

// Three functions, each adding after its call: all reach `a0`'s overflow.
const a0 = (d: u32, k: i32): i32 => (d === 0 ? 0 : a1(d - 1, k) + k);
const a1 = (d: u32, k: i32): i32 => (d === 0 ? 0 : a2(d - 1, k) + k);
const a2 = (d: u32, k: i32): i32 => (d === 0 ? 0 : a0(d - 1, k) + k);

// Four functions of the same shape.
const b0 = (d: u32, k: i32): i32 => (d === 0 ? 0 : b1(d - 1, k) + k);
const b1 = (d: u32, k: i32): i32 => (d === 0 ? 0 : b2(d - 1, k) + k);
const b2 = (d: u32, k: i32): i32 => (d === 0 ? 0 : b3(d - 1, k) + k);
const b3 = (d: u32, k: i32): i32 => (d === 0 ? 0 : b0(d - 1, k) + k);

// Different kinds: `c0` indexes before it adds, `c1` and `c2` only add, and
// every function of the cycle reaches `c0`'s index.
const c0 = (xs: i32[], d: u32, k: i32): i32 => (d === 0 ? 0 : c1(xs, d - 1, k) + xs[k]);
const c1 = (xs: i32[], d: u32, k: i32): i32 => (d === 0 ? 0 : c2(xs, d - 1, k) + k);
const c2 = (xs: i32[], d: u32, k: i32): i32 => (d === 0 ? 0 : c0(xs, d - 1, k) + k);

// `e0` checks nothing of its own, so the cycle is settled from `e1`.
const e0 = (d: u32, k: i32): i32 => (d === 0 ? 0 : e1(d - 1, k));
const e1 = (d: u32, k: i32): i32 => (d === 0 ? 0 : e0(d - 1, k) * k);

// Direct recursion: the call back into itself is passed over.
const f = (d: u32, k: i32): i32 => (d === 0 ? 0 : f(d - 1, k) - k);

export const main = (): number => {
  const k: i32 = process.argv.length;
  const xs: i32[] = [4, 5];
  console.log(a0(5, k));
  console.log(b0(6, k));
  console.log(c0(xs, 4, k));
  console.log(e0(4, k));
  console.log(f(3, k));
  return 0;
};
