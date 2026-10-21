// An enum narrowed before a `switch` stays narrowed in a clause after one
// that assigns it, and in the case no label matches: each way out leaves
// `j` `Kind.A` or `Kind.B`.
enum Kind {
  A,
  B,
  C,
}

const f = (k: Kind, x: i32): boolean => {
  let j: Kind = k;
  if (j !== Kind.A) {
    return false;
  }
  switch (x) {
    case 1:
      j = Kind.B;
      break;
    case 2:
      break;
  }
  return j === Kind.C;
};

export const main = (): void => {
  console.log(f(Kind.A, 1));
};
