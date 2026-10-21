// A ternary's arm reads a tracked variable by what it holds: `k` is not
// `Kind.A`, so `j` never is, and `j === Kind.A` after the loop is always false.
enum Kind {
  A,
  B,
  C,
}

const f = (k: Kind, n: i32): boolean => {
  if (k === Kind.A) {
    return true;
  }
  let i = 0;
  let j: Kind = Kind.A;
  do {
    j = i > 0 ? k : Kind.B;
    i++;
  } while (i < n);
  return j === Kind.A;
};

export const main = (): void => {
  console.log(f(Kind.C, 2));
};
