// A `switch` inside the loop leaves what each of its ways out holds: the
// `case` that stores `Kind.B` then `Kind.C` breaks with `Kind.C`, so `j` is
// `Kind.A | Kind.C` after the loop.
enum Kind {
  A,
  B,
  C,
}

const f = (n: i32): boolean => {
  let j: Kind = Kind.A;
  let i = 0;
  while (i < n) {
    i++;
    switch (i) {
      case 1:
        j = Kind.B;
        j = Kind.C;
        break;
      default:
        break;
    }
  }
  return j === Kind.B;
};

export const main = (): void => {
  console.log(f(2));
};
