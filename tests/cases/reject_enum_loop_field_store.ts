// A field of a member type reads as that member, through `this` and through
// a field of a field: `k` leaves each loop as `Kind.A | Kind.B`, and
// `k === Kind.C` is always false.
enum Kind {
  A,
  B,
  C,
}

class Inner {
  readonly b: Kind.B = Kind.B;
}

class G {
  readonly b: Kind.B = Kind.B;
  inner: Inner;
  constructor() {
    this.inner = new Inner();
  }
  viaThis(n: i32): boolean {
    let k: Kind = Kind.A;
    let i = 0;
    while (i < n) {
      k = this.b;
      i++;
    }
    return k === Kind.C;
  }
}

const viaPath = (g: G, n: i32): boolean => {
  let k: Kind = Kind.A;
  for (let i = 0; i < n; i++) {
    k = g.inner.b;
  }
  return k === Kind.C;
};

export const main = (): void => {
  console.log(new G().viaThis(2));
  console.log(viaPath(new G(), 2));
};
