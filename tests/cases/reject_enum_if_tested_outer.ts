// A join of the arms starts from what held before the `if`: `Kind.A` was ruled
// out above it and `Kind.B` in both arms, so `k` is `Kind.C` after it.
enum Kind {
  A,
  B,
  C,
}

const o = (k: Kind, c: boolean): boolean => {
  if (k === Kind.A) {
    return false;
  }
  if (c) {
    if (k === Kind.B) {
      return false;
    }
  } else {
    if (k === Kind.B) {
      return true;
    }
  }
  return k === Kind.A;
};

export const main = (): void => {
  console.log(o(Kind.C, true));
};
