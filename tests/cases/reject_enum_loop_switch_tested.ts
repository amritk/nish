// A variable a `switch` in the loop only tests is narrowed at the head too: the
// clauses that return leave what the default lets through.
enum Kind {
  A,
  B,
  C,
}

const g = (k: Kind, n: i32): boolean => {
  let i = 0;
  do {
    switch (k) {
      case Kind.A:
      case Kind.B:
        return true;
      default:
        break;
    }
    i++;
  } while (i < n);
  return k === Kind.B;
};

const f = (n: i32): boolean => g(Kind.C, n);

export const main = (): void => {
  console.log(f(2));
};
