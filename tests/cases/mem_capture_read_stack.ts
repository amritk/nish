// A capture is an argument to the arrow (docs/LANGUAGE.md, "Function
// parameters"): `b` is read by an arrow given to an ordinary function and kept
// by nothing, so it is an alloca in `total`'s frame, as it would be if `total`
// passed it to the arrow itself. The call that hands it over is never a tail
// call, so the slot lives until the arrow has run.

class Box {
  v: i32;

  constructor(v: i32) {
    this.v = v;
  }
}

const each = (xs: i32[], f: (x: i32) => void): void => {
  for (const x of xs) {
    f(x);
  }
};

class Sum {
  t: i32;

  constructor() {
    this.t = 0;
  }
}

const total = (xs: i32[], n: i32): i32 => {
  const b = new Box(n);
  const s = new Sum();
  each(xs, (x) => {
    s.t = s.t + b.v * x;
  });
  return s.t;
};

export const main = (): void => {
  console.log(`${total([1, 2, 3], 5)}`);
};
