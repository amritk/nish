// Every exit of the `switch` leaves `h.k` at `Kind.B` or `Kind.C`, so the
// join over its exits refuses the comparison with `Kind.A`.
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
  switch (h.k) {
    case Kind.A:
      h.k = Kind.B;
      break;
    default:
      h.k = Kind.C;
      break;
  }
  return h.k === Kind.A;
};

export const main = (): void => {
  console.log(f(new H(Kind.A)));
};
