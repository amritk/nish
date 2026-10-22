// Both arms of the `if` set `h.k` to `Kind.A`, so after the join TypeScript
// holds `h.k` at `Kind.A` and refuses the comparison with `Kind.B`.
enum Kind {
  A,
  B,
  C,
}

class H {
  k: Kind = Kind.A;
  constructor(k: Kind) {
    this.k = k;
  }
}

const f = (h: H, c: boolean): boolean => {
  if (c) {
    h.k = Kind.A;
  } else {
    h.k = Kind.A;
  }
  return h.k === Kind.B;
};

export const main = (): void => {
  console.log(f(new H(Kind.C), true));
};
