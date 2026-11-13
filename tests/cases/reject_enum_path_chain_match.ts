// A path is one path when its names match from one root, however it is
// parenthesised: `(h.s).k` after a test of `h.s.k` is refused, while a path
// with another name, from another root, or through `this` is a path of its own.
enum Kind {
  A,
  B,
  C,
}

class S {
  k: Kind = Kind.A;
  j: Kind = Kind.A;
}

class H {
  s: S;
  k: Kind = Kind.A;
  constructor() {
    this.s = new S();
  }
  own(): boolean {
    if (this.k === Kind.A) {
      return this.s.k === Kind.B || (this).k === Kind.B;
    }
    return false;
  }
}

const sameChain = (h: H): boolean => {
  if (h.s.k === Kind.A) {
    return (h.s).k === Kind.B;
  }
  return false;
};

const otherName = (h: H): boolean => {
  if (h.s.k === Kind.A) {
    return h.s.j === Kind.B || h.k === Kind.B;
  }
  return false;
};

const otherRoot = (h: H, g: H): boolean => {
  if (h.s.k === Kind.A) {
    return g.s.k === Kind.B || ((h).s).k === Kind.C;
  }
  return false;
};

export const main = (): void => {
  const h = new H();
  console.log(h.own());
  console.log(sameChain(h));
  console.log(otherName(h));
  console.log(otherRoot(h, new H()));
};
