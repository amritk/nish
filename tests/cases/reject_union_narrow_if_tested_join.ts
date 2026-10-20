// Each arm of an `if` rules out `VA` by testing the tag, so past the `if`
// `s` is a `VB | VC` and `s.kind` cannot be `Kind.A`.
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

const g = (s: U, c: boolean): boolean => {
  if (c) {
    if (s.kind === Kind.A) {
      return false;
    }
  } else {
    if (s.kind === Kind.A) {
      return true;
    }
  }
  return s.kind === Kind.A;
};

export const main = (): void => {
  console.log(g(new VB(), true));
};
