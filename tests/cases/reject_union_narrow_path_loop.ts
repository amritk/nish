// A loop whose body stores `Kind.A` to `h.k` leaves it `Kind.A`.
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
    let more = c;
    while (more) {
      h.k = Kind.A;
      more = false;
    }
    if (h.k === Kind.B) {
      return 1;
    }
  }
  return 0;
};

export const main = (): void => {
  console.log(f(new H(Kind.A), true));
};
