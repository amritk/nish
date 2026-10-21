// A comparison with a tracked variable narrows by what that variable holds:
// `j` is `Kind.B | Kind.C` in the loop, so `k === j` coming out true leaves
// `k` as `Kind.B | Kind.C` too, `k` cannot be `Kind.A` after it, and
// `k === Kind.A` is always false.
enum Kind {
  A,
  B,
  C,
}

const f = (k: Kind, j: Kind): boolean => {
  if (j === Kind.A) {
    return true;
  }
  while (true) {
    if (k !== j) {
      return true;
    }
    break;
  }
  return k === Kind.A;
};

export const main = (): void => {
  console.log(f(Kind.B, Kind.B));
};
