// The loop's condition narrows the head, and the way out is the condition
// false: `u.kind` is `Kind.B | Kind.C` after it, so `=== Kind.A` is always
// false.
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
  while (u.kind === Kind.A) {
    u = make(i);
    i++;
  }
  return u.kind === Kind.A;
};

export const main = (): void => {
  console.log(f(2));
};
