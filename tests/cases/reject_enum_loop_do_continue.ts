// A `continue` in a `do` goes to its condition, as the end of the body does:
// `j` is `Kind.B | Kind.C` on both, and after the loop.
enum Kind {
  A,
  B,
  C,
}

const f = (n: i32): boolean => {
  let j: Kind = Kind.A;
  let i = 0;
  do {
    i++;
    if (i === 1) {
      j = Kind.B;
      continue;
    }
    j = Kind.C;
  } while (i < n);
  return j === Kind.A;
};

export const main = (): void => {
  console.log(f(2));
};
