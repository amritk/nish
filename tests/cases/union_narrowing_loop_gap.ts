// The loop accept-gap for a union (docs/LANGUAGE.md, "Accepted here,
// refused by tsc"): a tag test inside a loop body narrows the union there,
// but after the loop the variable holds every variant the body may have
// stored, so each comparison below compiles here and is TS2367 to `tsc`.
// The expected errors keep `tsc` quiet and fail once it accepts them; once
// the gap closes, this case is refused here and moves to `reject_`.
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

const whileLoop = (n: i32): boolean => {
  let u: S = make(0);
  if (u.kind !== Kind.A) {
    return false;
  }
  let i = 0;
  while (i < n) {
    u = make(0);
    if (u.kind !== Kind.A) {
      return false;
    }
    i++;
  }
  // @ts-expect-error TS2367: `u.kind` is `Kind.A`, the loop accept-gap
  return u.kind === Kind.B;
};

const doLoop = (n: i32): boolean => {
  let u: S = make(0);
  let i = 0;
  do {
    u = make(1);
    if (u.kind !== Kind.B) {
      return false;
    }
    i++;
  } while (i < n);
  // @ts-expect-error TS2367: `u.kind` is `Kind.B`, the loop accept-gap
  return u.kind === Kind.A;
};

export const main = (): void => {
  console.log(whileLoop(2));
  console.log(doLoop(2));
};
