// After a `while`, a union variable holds what it held before the loop or what
// reaches the end of an iteration, not every variant the body stores: `u` is
// `Ca` on every way out, so `u.kind === Kind.B` is always false.
enum Kind {
  A,
  B,
  C,
}

class Ca {
  readonly kind: Kind.A = Kind.A;
}
class Cb {
  readonly kind: Kind.B = Kind.B;
}
class Cc {
  readonly kind: Kind.C = Kind.C;
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

const f = (n: i32): boolean => {
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
  return u.kind === Kind.B;
};

export const main = (): void => {
  console.log(f(2));
};
