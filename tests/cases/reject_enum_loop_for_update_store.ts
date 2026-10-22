// A `for`'s update is followed: the loop leaves through its condition after
// the update stored `Kind.C`, or before the first pass with `Kind.A`, so `j`
// is `Kind.A | Kind.C` and `j === Kind.B` after the loop is always false.
enum Kind {
  A,
  B,
  C,
}

const forUpdateStore = (n: i32): boolean => {
  let j: Kind = Kind.A;
  for (let i = 0; i < n; j = Kind.C) {
    j = Kind.B;
    i++;
  }
  return j === Kind.B;
};

export const main = (): void => {
  console.log(forUpdateStore(2));
};
