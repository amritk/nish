// A field read through a nullable receiver, once a test leaves it not null,
// reads as the field's declared type: `h.m` is `Kind.B`, so `k` is
// `Kind.A | Kind.B` after the loop and `k === Kind.C` is always false.
enum Kind {
  A,
  B,
  C,
}

class Hb {
  readonly m: Kind.B = Kind.B;
}

const f = (h: Hb | null, n: i32): boolean => {
  let k: Kind = Kind.A;
  let i = 0;
  while (i < n) {
    if (h !== null) {
      k = h.m;
    }
    i++;
  }
  return k === Kind.C;
};

export const main = (): void => {
  console.log(f(new Hb(), 2));
};
