// A `switch` in a `while` whose clauses swap the variable between two members
// keeps the third out of the loop for good.
enum Kind {
  A,
  B,
  C,
}

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
