// A `switch` on the loop variable inside the loop narrows each clause, so the
// store in one clause and the break of another join to what TypeScript finds.
enum Kind {
  A,
  B,
  C,
}

const f = (n: i32): boolean => {
  let k: Kind = Kind.B;
  let i = 0;
  do {
    switch (k) {
      case Kind.B:
        k = Kind.C;
        break;
      case Kind.C:
        break;
      default:
        break;
    }
    i++;
  } while (i < n);
  return k === Kind.B;
};

export const main = (): void => {
  console.log(f(2));
};
