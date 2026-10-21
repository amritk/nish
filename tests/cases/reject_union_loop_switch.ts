// A `switch` on a tested-only union's tag inside a loop narrows it the way the
// checker narrows the clauses.
enum Kind {
  A,
  B,
  C,
}

class S {
  readonly kind: Kind.A = Kind.A
}

class T {
  readonly kind: Kind.B = Kind.B
}

class V {
  readonly kind: Kind.C = Kind.C
}

type U = S | T | V

const g = (u: U, n: i32): boolean => {
  let i = 0;
  do {
    switch (u.kind) {
      case Kind.A:
        return true;
      default:
        break;
    }
    i++;
  } while (i < n);
  return u.kind === Kind.A;
};

const f = (n: i32): boolean => g(new T(), n);

export const main = (): void => {
  console.log(f(2));
};
