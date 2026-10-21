// A tag read through a path is joined across the arms of an `if` too.
enum Kind {
  A,
  B,
  C,
}

class VA {
  readonly kind: Kind.A = Kind.A;
  a: i32 = 1;
}

class VB {
  readonly kind: Kind.B = Kind.B;
  b: i32 = 2;
}

class VC {
  readonly kind: Kind.C = Kind.C;
  c: i32 = 3;
}

type U = VA | VB | VC;

class H {
  u: U;
  constructor(u: U) {
    this.u = u;
  }
}

const p = (h: H, c: boolean): boolean => {
  if (c) {
    if (h.u.kind === Kind.A) {
      return false;
    }
  } else {
    if (h.u.kind === Kind.A) {
      return true;
    }
  }
  return h.u.kind === Kind.A;
};

export const main = (): void => {
  console.log(p(new H(new VB()), true));
};
