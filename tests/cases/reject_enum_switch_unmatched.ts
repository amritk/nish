// With no `default`, the `switch` also exits when no clause matches: `j` is
// then `Kind.B` or `Kind.C`, and the clause gives it `Kind.B`, never `Kind.A`.
enum Kind {
  A,
  B,
  C,
}

const f = (k: Kind): boolean => {
  let j: Kind = k;
  switch (j) {
    case Kind.A:
      j = Kind.B;
      break;
  }
  return j === Kind.A;
};

export const main = (): void => {
  console.log(f(Kind.B));
};
