// A ternary operand holds what its arms hold: with `j` as `Kind.B` in the
// loop, `c ? j : Kind.B` is `Kind.B`, so `k === (c ? j : Kind.B)` coming out
// false leaves `k` as `Kind.A | Kind.C`, and `k === Kind.B` after the loop is
// always false.
enum Kind {
  A,
  B,
  C,
}

const f = (k: Kind, j: Kind, c: boolean): boolean => {
  if (j !== Kind.B) {
    return true;
  }
  while (true) {
    if (k === (c ? j : Kind.B)) {
      return true;
    }
    break;
  }
  return k === Kind.B;
};

export const main = (): void => {
  console.log(f(Kind.A, Kind.B, true));
};
