// The test narrows `h.k` to `Kind.A` and the arm moves it to `Kind.B`; the
// skipped arm keeps the rest, so `h.k` is never `Kind.A` after the `if`.
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

const f = (h: H): boolean => {
  if (h.k === Kind.A) {
    h.k = Kind.B;
  }
  return h.k === Kind.A;
};

export const main = (): void => {
  console.log(f(new H(Kind.A)));
};
