// After an `if` whose arm stores to `h.k`, the path holds what either arm left
// it: `Kind.A` or `Kind.B`, never `Kind.C`.
enum Kind {
  A,
  B,
  C,
}

class H {
  k: Kind;
  constructor(k: Kind) {
    this.k = k;
  }
}

const f = (h: H, c: boolean): i32 => {
  if (h.k === Kind.A) {
    if (c) {
      h.k = Kind.B;
    }
    if (h.k === Kind.C) {
      return 1;
    }
  }
  return 0;
};

export const main = (): void => {
  console.log(f(new H(Kind.A), true));
};
