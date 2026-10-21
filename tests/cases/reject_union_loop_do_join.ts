// A `do` body runs before its condition, so what its end holds is what the
// loop leaves: `u` is `Cb`, and `u.kind === Kind.A` is always false.
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
  let i = 0;
  do {
    u = make(1);
    if (u.kind !== Kind.B) {
      return false;
    }
    i++;
  } while (i < n);
  return u.kind === Kind.A;
};

export const main = (): void => {
  console.log(f(2));
};
