// A union's tag copied into an enum variable inside a loop holds the tags of
// the variants the union may hold, not the whole enum.
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
  if (u.kind === Kind.A) {
    return true;
  }
  let k: Kind = Kind.A;
  let i = 0;
  do {
    k = u.kind;
    i++;
  } while (i < n);
  return k === Kind.A;
};

const f = (n: i32): boolean => g(new T(), n);

export const main = (): void => {
  console.log(f(2));
};
