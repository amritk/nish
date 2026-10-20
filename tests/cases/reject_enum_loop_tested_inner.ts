// A test inside an inner loop narrows a tested-only variable of the outer one.
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

const g = (k: Kind, n: i32): boolean => {
  let i = 0;
  do {
    let j = 0;
    while (j < n) {
      if (k === Kind.A) {
        return true;
      }
      j++;
    }
    if (k === Kind.A) {
      return false;
    }
    i++;
  } while (i < n);
  return k === Kind.A;
};

const f = (n: i32): boolean => g(Kind.B, n);

export const main = (): void => {
  console.log(f(2));
};
