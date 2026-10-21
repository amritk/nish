// A tag tested through a path — a field, `this`, a field of a field, a literal
// index — stays narrowed until a store to the path, a prefix of it or its root.
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
  twice(): i32 {
    if (this.k !== Kind.A) {
      return 0;
    }
    this.k = Kind.B;
    return this.k === Kind.B ? 2 : 1;
  }
}

class G {
  h: H;
  constructor(h: H) {
    this.h = h;
  }
}

const f = (h: H, g: G, xs: H[], c: boolean): i32 => {
  let n = 0;
  if (h.k === Kind.A) {
    h.k = Kind.B;
    if (h.k === Kind.B) {
      n = n + 1;
    }
  }
  if (g.h.k === Kind.A) {
    g.h = h;
    if (g.h.k === Kind.B) {
      n = n + 2;
    }
  }
  let x = h;
  if (x.k === Kind.B) {
    x = new H(Kind.C);
    if (x.k === Kind.C) {
      n = n + 4;
    }
  }
  if (xs[0].k === Kind.A) {
    xs[0] = h;
    if (xs[0].k === Kind.B) {
      n = n + 8;
    }
  }
  if (h.k === Kind.B) {
    if (c) {
      h.k = Kind.C;
    }
    if (h.k === Kind.C) {
      n = n + 16;
    }
  }
  while (n < 100) {
    if (h.k === Kind.A) {
      n = n + 100;
    }
    h.k = Kind.A;
  }
  return n;
};

export const main = (): void => {
  const h = new H(Kind.A);
  console.log(f(h, new G(new H(Kind.A)), [new H(Kind.A)], true));
  console.log(new H(Kind.A).twice());
};
