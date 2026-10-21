// A `switch` on a union's tag joins what its clauses' tests left in another
// variable as well.
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

const t = (s: U, k: Kind): boolean => {
  switch (s.kind) {
    case Kind.A:
      if (k === Kind.C) {
        return false;
      }
      break;
    default:
      if (k === Kind.C) {
        return true;
      }
      break;
  }
  return k === Kind.C;
};

export const main = (): void => {
  console.log(t(new VB(), Kind.A));
};
