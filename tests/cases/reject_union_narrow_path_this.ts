// A tag tested through `this.k` stays narrowed after an early return.
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
  f(): i32 {
    if (this.k !== Kind.A) {
      return 0;
    }
    return this.k === Kind.B ? 1 : 2;
  }
}

export const main = (): void => {
  console.log(new H(Kind.A).f());
};
