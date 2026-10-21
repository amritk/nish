// A tested-only variable leaves the loop by its `break` narrowed by the test
// before it.
enum Kind {
  A,
  B,
  C,
}

const g = (k: Kind): boolean => {
  while (true) {
    if (k === Kind.A) {
      return true;
    }
    break;
  }
  return k === Kind.A;
};

const f = (n: i32): boolean => g(n > 0 ? Kind.B : Kind.C);

export const main = (): void => {
  console.log(f(2));
};
