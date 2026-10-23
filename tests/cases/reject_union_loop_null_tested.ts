// A nullable union tested for null and for a tag inside a `do` is narrowed past
// both tests at the head and after the loop.
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

const g = (u: U | null, n: i32): boolean => {
  let i = 0;
  do {
    if (u === null) {
      return true;
    }
    if (u.kind === Kind.A) {
      return false;
    }
    i++;
  } while (i < n);
  return u.kind === Kind.A;
};

const f = (n: i32): boolean => g(new T(), n);

export const main = (): void => {
  console.log(f(2));
};
