// A copy of another enum variable stored in a loop holds what that variable
// holds, not the whole enum.
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

const g = (n: i32, j0: Kind): boolean => {
  const j: Kind = j0;
  if (j === Kind.A) {
    return true;
  }
  let k: Kind = Kind.A;
  let i = 0;
  do {
    k = j;
    i++;
  } while (i < n);
  return k === Kind.A;
};

const f = (n: i32): boolean => g(n, Kind.B);

export const main = (): void => {
  console.log(f(2));
};
