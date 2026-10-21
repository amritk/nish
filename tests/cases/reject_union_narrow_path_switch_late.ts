// A `switch` on a number that sets `h.k` to `Kind.A` in every clause leaves
// it at `Kind.A`, though no path was tracked before the `switch`.
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

const f = (h: H, x: number): boolean => {
  switch (x) {
    case 1:
      h.k = Kind.A;
      break;
    default:
      h.k = Kind.A;
  }
  return h.k === Kind.B;
};

export const main = (): void => {
  console.log(f(new H(Kind.C), 1));
};
