// `using a = arena()` releases at every exit of the block that declares it —
// its end, a `return` (after the returned value is computed), and a `break` or
// `continue` that leaves it — and in the reverse of the order it opened in
// with a `using s = scope()` inside it and a scoped loop pass around it.
// Every function here is one the compiler gives no automatic scope of its
// own, so the block's release is the only one: each answers a pointer, or
// manages the arena with `Arena.mark()`. Each line ends with how far the
// arena moved across the calls, which is 0 only if every path released what
// `fill` grew. `orReturn()` is `tests/cases/mem_using_arena_or_return`,
// because it does not propagate under unmodified Node, where this runs too.
import { scope } from "nish/threads";

class Tally {
  n: i32 = 0;
}

const triple = (n: i32): i32 => n * 3;

/** A fresh array of `k` elements: arena memory that only a release around the call gives back. */
const fill = (k: i32): i32[] => {
  const xs: i32[] = [];
  for (let i = 0; i < k; i++) {
    xs.push(i);
  }
  return xs;
};

/** The block's end, and a `return` from inside it, on either side of the `if`. */
const leave = (k: i32, t: Tally): Tally => {
  {
    using a = arena();
    const xs = fill(k);
    t.n = t.n + xs.length;
  }
  using b = arena();
  const ys = fill(k);
  if (ys.length > k / 2) {
    return t;
  }
  t.n = t.n + 1;
  return t;
};

/** `continue` and `break` out of a block in a loop whose passes are not scoped. */
const passes = (k: i32, t: Tally): Tally => {
  const top = Arena.mark(); // manages the arena, so no pass gets an automatic scope
  for (let i = 0; i < 4; i++) {
    using a = arena();
    const xs = fill(k);
    if (i === 1) {
      continue;
    }
    if (i === 2) {
      break;
    }
    t.n = t.n + xs.length;
  }
  t.n = t.n + (Arena.mark() === top ? 0 : 1);
  return t;
};

/**
 * A `return` with a scoped pass and a block one inside the other releases
 * the outer of the two, whose mark is the lower: the pass in `inPass`, where
 * the block opens inside each pass, and the block in `aroundPass`, where the
 * passes run inside the block.
 */
const inPass = (k: i32, t: Tally): Tally => {
  for (let i = 0; i < 3; i++) {
    const ys = fill(k);
    using a = arena();
    const zs = fill(ys.length);
    if (i === 1) {
      return t;
    }
    t.n = t.n + zs.length;
  }
  return t;
};

const aroundPass = (k: i32, t: Tally): Tally => {
  using a = arena();
  const xs = fill(k);
  for (let i = 0; i < 3; i++) {
    const zs = fill(xs.length);
    if (i === 1) {
      return t;
    }
    t.n = t.n + zs.length;
  }
  return t;
};

/**
 * A scope inside the block joins first; a scoped pass around the block
 * releases after it. The destination is the scope's own fresh `const`, and
 * the copy of it this function hands back moves the arena by the same few
 * bytes whatever `k` is.
 */
const nested = (k: i32): i32[] => {
  const res: i32[] = [0, 0];
  {
    using a = arena();
    const xs = fill(k);
    using s = scope();
    s.spawn(triple, xs.length, res, 0);
  }
  for (let i = 0; i < 3; i++) {
    const ys = fill(k);
    using a = arena();
    const zs = fill(ys.length);
    if (i === 1) {
      continue;
    }
    res[1] = res[1] + zs.length;
  }
  return [res[0], res[1]];
};

export const main = (): i32 => {
  const t = new Tally();
  const b1 = Arena.used();
  const r1 = leave(1000, t).n;
  const r2 = leave(2, t).n;
  const d1 = Arena.used() - b1;
  const b2 = Arena.used();
  const r3 = passes(1000, t).n;
  const d2 = Arena.used() - b2;
  const b3 = Arena.used();
  const r4 = inPass(1000, t).n;
  const r5 = aroundPass(1000, t).n;
  const d3 = Arena.used() - b3;
  const b4 = Arena.used();
  const r6 = nested(1000);
  const d4 = Arena.used() - b4;
  const b5 = Arena.used();
  const r7 = nested(1);
  const d5 = Arena.used() - b5;
  console.log(`${r1} ${r2} ${d1}`);
  console.log(`${r3} ${d2}`);
  console.log(`${r4} ${r5} ${d3}`);
  console.log(`${r6[0]} ${r6[1]} ${r7[0]} ${r7[1]} ${d4 === d5}`);
  return 0;
};
