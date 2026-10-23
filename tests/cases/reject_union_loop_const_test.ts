// A tag test against a local of a member type narrows the union as one
// against the member: past it, `s` is not `Ca`, and `s.kind === Kind.A` is always false.
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

const g = (s: S): boolean => {
  const a: Kind.A = Kind.A;
  while (true) {
    if (s.kind === a) {
      return true;
    }
    break;
  }
  return s.kind === Kind.A;
};

export const main = (): void => {
  console.log(g(make(1)));
};
