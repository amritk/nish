// A comparison with a tracked variable that holds one member narrows both
// ways: `j` is `Kind.B` in the loop, so `k === j` coming out false leaves `k`
// as `Kind.A | Kind.C`, and `k === Kind.B` after the loop is always false.
enum Kind {
  A,
  B,
  C,
}

const f = (k: Kind, j: Kind): boolean => {
  if (j !== Kind.B) {
    return true;
  }
  while (true) {
    if (k === j) {
      return true;
    }
    break;
  }
  return k === Kind.B;
};

export const main = (): void => {
  console.log(f(Kind.A, Kind.B));
};
