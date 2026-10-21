// A `break` carries what it holds past the loop: `j` is `Kind.A` from the
// condition and `Kind.B` from the `break`, never `Kind.C`.
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
    if (i > 1) {
      j = Kind.B;
      break;
    }
  }
  return j === Kind.C;
};

export const main = (): void => {
  console.log(f(2));
};
