// A `switch` in a `while` whose clauses swap the variable between two members
// keeps the third out of the loop for good.
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

const f = (n: i32): boolean => {
  let k: Kind = Kind.B;
  let i = 0;
  while (i < n) {
    switch (k) {
      case Kind.B:
        k = Kind.C;
        break;
      case Kind.C:
        k = Kind.B;
        break;
      default:
        return true;
    }
    i++;
  }
  return k === Kind.A;
};

export const main = (): void => {
  console.log(f(2));
};
