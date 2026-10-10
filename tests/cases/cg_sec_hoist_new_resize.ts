// A loop's array header is hoisted only when nothing in the loop can move it,
// and a `new` runs its class's constructor, which can: `new P(xs)` pushes until
// the elements move to a new block. The loop read `len` and `data` once, before
// it, and went on reading the old block and stopping at the old length, so
// `whileLoop` summed 6 where JavaScript sums 706. The constructor's fixpoint
// fact decides it, so `new Q(xs)`, whose constructor only reads, keeps the
// hoist in `keepsHoist`. The same fact decides whether a `for...of` is
// counted: `forOfGrows` pushes on every pass through `new R(xs)`, never ends
// over a non-empty array, and was marked `willreturn`. It is not called. And
// it decides CG-10's question, so `compoundNew` stores into the block
// `new P(xs)` left, not the one it read `xs[0]` from.
// docs/security/codegen.md, CG-11.
class P {
  n: i32;
  constructor(xs: i32[]) {
    let k = 0;
    while (k < 100) {
      xs.push(7);
      k = k + 1;
    }
    this.n = 1;
  }
}

class Q {
  n: i32;
  constructor(xs: i32[]) {
    this.n = xs[0];
  }
}

class R {
  n: i32;
  constructor(xs: i32[]) {
    xs.push(1);
    this.n = 1;
  }
}

const whileLoop = (): i32 => {
  const xs: i32[] = [1, 2, 3];
  let s = 0;
  let i = 0;
  while (i < xs.length) {
    s = s + xs[i];
    if (i === 0) {
      const p = new P(xs);
      s = s + p.n - 1;
    }
    i = i + 1;
  }
  return s;
};

const forOfLoop = (): i32 => {
  const xs: i32[] = [1, 2, 3];
  let s = 0;
  for (const x of xs) {
    s = s + x;
    if (x === 1) {
      const p = new P(xs);
      s = s + p.n - 1;
    }
  }
  return s;
};

const keepsHoist = (): i32 => {
  const xs: i32[] = [1, 2, 3];
  let s = 0;
  let i = 0;
  while (i < xs.length) {
    const q = new Q(xs);
    s = s + xs[i] + q.n;
    i = i + 1;
  }
  return s;
};

const compoundNew = (): i32 => {
  const xs: i32[] = [1];
  xs[0] += new P(xs).n;
  return xs[0];
};

export const forOfGrows = (xs: i32[]): i32 => {
  let s = 0;
  for (const x of xs) {
    const r = new R(xs);
    s = r.n + x;
  }
  return s;
};

export const test = (): i32 => whileLoop() * 100000 + forOfLoop() * 100 + keepsHoist() * 10 + compoundNew();
