// A tag tested through a field, `h.k`, stays narrowed in TypeScript, so a
// second test for another member is always false.
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

const f = (h: H): i32 => {
  if (h.k === Kind.A) {
    if (h.k === Kind.B) {
      return 1;
    }
  }
  return 0;
};

export const main = (): void => {
  console.log(f(new H(Kind.A)));
};
