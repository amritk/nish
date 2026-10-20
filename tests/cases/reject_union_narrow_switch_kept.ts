// A union narrowed before a `switch` stays narrowed in a clause after one
// that assigns it: the store in `case 1` does not reach `default`, so
// both ways out leave `u` a `Ca`.
enum Kind {
  A,
  B,
  C,
}

class Ca {
  readonly kind: Kind.A = Kind.A;
  constructor() {}
}

class Cb {
  readonly kind: Kind.B = Kind.B;
  constructor() {}
}

class Cc {
  readonly kind: Kind.C = Kind.C;
  constructor() {}
}

type S = Ca | Cb | Cc;

const make = (n: i32): S => {
  if (n === 0) {
    return new Ca();
  }
  if (n === 1) {
    return new Cb();
  }
  return new Cc();
};

const f = (x: i32): boolean => {
  let u: S = make(0);
  if (u.kind !== Kind.A) {
    return false;
  }
  switch (x) {
    case 1:
      u = make(1);
      if (u.kind !== Kind.A) {
        return false;
      }
      break;
    default:
      break;
  }
  return u.kind === Kind.B;
};

export const main = (): void => {
  console.log(f(1));
};
