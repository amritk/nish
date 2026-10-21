// A comparison with a tracked variable that holds several members narrows
// only the way that keeps them: `j` is `Kind.B | Kind.C` in the loop, so
// `k !== j` coming out true leaves `k` whole, and `k === Kind.B` after the
// loop compiles, as `tsc` reads it.
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
      break;
    }
    return false;
  }
  return k === Kind.B;
};

export const main = (): void => {
  console.log(f(Kind.B, Kind.C));
  console.log(f(Kind.A, Kind.B));
  console.log(f(Kind.C, Kind.C));
};
