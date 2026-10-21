// A ternary's arm reads a variable narrowed before the loop: `j` is
// `Kind.B` there, so both arms are `Kind.B` and `k === Kind.A` is always false.
enum Kind {
  A,
  B,
  C,
}

const f = (n: i32, j0: Kind): boolean => {
  const j: Kind = j0;
  if (j !== Kind.B) {
    return true;
  }
  let k: Kind = Kind.A;
  let i = 0;
  do {
    k = i > 1 ? Kind.B : j;
    i++;
  } while (i < n);
  return k === Kind.A;
};

export const main = (): void => {
  console.log(f(2, Kind.B));
};
