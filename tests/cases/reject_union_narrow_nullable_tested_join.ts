// A `U | null` that a `null` test has already narrowed joins across the arms
// like the union itself.
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

const q = (s: U | null, c: boolean): boolean => {
  if (s === null) {
    return false;
  }
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
  console.log(q(new VB(), true));
};
