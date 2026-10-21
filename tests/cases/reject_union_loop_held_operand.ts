// A union's tag compared with a tracked enum variable narrows by what that
// variable holds: `j` is `Kind.B` in the loop, so `s.kind === j` coming out
// false leaves `s` as `Ca | Cc`, and `s.kind === Kind.B` after the loop is
// always false.
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

const f = (s: S, j: Kind): boolean => {
  if (j !== Kind.B) {
    return true;
  }
  while (true) {
    if (s.kind === j) {
      return true;
    }
    break;
  }
  return s.kind === Kind.B;
};

export const main = (): void => {
  console.log(f(new Ca(), Kind.B));
};
