// An element of an array that holds its elements inline is the address of a
// slot in that array's data block, so keeping the element keeps the array.
// Before this was followed, `fill` stored `xs[n - 1]` into its parameter's
// object, was told nothing escaped, took an automatic arena scope, and
// released the block `h.p` pointed into: this printed `7777 7777`. The loop
// and `for...of` versions are the same hole in a pass; `pick` is it through a
// callee, which now captures its parameter, and `fillVia` through a local.
interface P {
  x: i32;
  y: i32;
}

class Holder {
  p: P | null = null;
}

const points = (n: i32): P[] => {
  const xs: P[] = [];
  for (let i = 0; i < n; i++) {
    xs.push({ x: i, y: i * 2 });
  }
  return xs;
};

// The function scope.
const fill = (h: Holder, n: i32): i32 => {
  const xs = points(n);
  h.p = xs[n - 1];
  return n;
};

// The function scope, through a local holding the element: a holder whose
// every use reads a field keeps nothing, and this one is stored.
const fillVia = (h: Holder, n: i32): i32 => {
  const xs = points(n);
  const last = xs[n - 1];
  h.p = last;
  return last.x;
};

// A pass, keeping an element in an outer local.
const lastOfEach = (rounds: i32): P => {
  let keep: P = { x: 0, y: 0 };
  for (let r = 1; r <= rounds; r++) {
    const xs = points(r);
    keep = xs[r - 1];
  }
  return keep;
};

// A pass, keeping the variable of a `for...of` over a fresh array.
const lastSeen = (h: Holder, rounds: i32): i32 => {
  for (let r = 1; r <= rounds; r++) {
    for (const p of points(r)) {
      h.p = p;
    }
  }
  return rounds;
};

// Through a callee that stores the element it was handed.
const pick = (h: Holder, xs: P[], i: i32): void => {
  h.p = xs[i];
};

const viaCallee = (h: Holder, rounds: i32): i32 => {
  for (let r = 1; r <= rounds; r++) {
    pick(h, points(r), r - 1);
  }
  return rounds;
};

const churn = (): i32 => {
  const junk: i32[] = [];
  for (let i = 0; i < 400; i++) {
    junk.push(7777);
  }
  return junk.length;
};

const show = (h: Holder): string => {
  const p = h.p;
  return p === null ? "null" : `${p.x} ${p.y}`;
};

export const main = (): void => {
  const h = new Holder();
  fill(h, 50);
  const v = new Holder();
  fillVia(v, 30);
  const k = lastOfEach(20);
  const g = new Holder();
  lastSeen(g, 20);
  const c = new Holder();
  viaCallee(c, 20);
  const n = churn();
  console.log(`${show(h)} ${n}`);
  console.log(show(v));
  console.log(`${k.x} ${k.y}`);
  console.log(show(g));
  console.log(show(c));
};
