// At the head of the body, `j` holds what it held before the loop or what
// the last iteration stored, `Kind.A | Kind.B`, so `j === Kind.C` is always
// false there.
enum Kind {
  A,
  B,
  C,
}

const f = (n: i32): boolean => {
  let j: Kind = Kind.A;
  let i = 0;
  while (i < n) {
    if (j === Kind.C) {
      return true;
    }
    j = Kind.B;
    i++;
  }
  return false;
};

export const main = (): void => {
  console.log(f(2));
};
