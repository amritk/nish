// A loop pass that allocates what only a read-only arrow captures releases
// it at the end of the pass: each capture is an argument to the arrow, which
// keeps nothing, so nothing allocated in the pass is reachable after it. The
// string `label` is the pass scope's to release, and `b` is an alloca.

class Box {
  v: i32;

  constructor(v: i32) {
    this.v = v;
  }
}

class Sum {
  t: i32;

  constructor() {
    this.t = 0;
  }
}

const each = (xs: i32[], f: (x: i32) => void): void => {
  for (const x of xs) {
    f(x);
  }
};

const run = (xs: i32[], n: i32, s: Sum): void => {
  for (let i = 0; i < n; i++) {
    const label = `pass-${i}`;
    const b = new Box(label.length);
    each(xs, (x) => {
      s.t = s.t + b.v * x + label.length;
    });
  }
};

export const main = (): void => {
  const s = new Sum();
  run([1, 2], 1000, s);
  console.log(`${s.t}`);
};
