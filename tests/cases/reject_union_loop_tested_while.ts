// A union the loop condition only tests is narrowed after the loop, as an enum is.
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
  while (u.kind === Kind.A) {
    i++;
    if (i > n) {
      return true;
    }
  }
  return u.kind === Kind.A;
};

const f = (n: i32): boolean => g(new T(), n);

export const main = (): void => {
  console.log(f(2));
};
