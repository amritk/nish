// Each arm of an `if` tests `k` and leaves when it is `Kind.A`, so past the
// `if` `k` cannot be `Kind.A`, though neither arm assigns it.
enum Kind {
  A,
  B,
  C,
}

const f = (k: Kind, c: boolean): boolean => {
  if (c) {
    if (k === Kind.A) {
      return false;
    }
  } else {
    if (k === Kind.A) {
      return true;
    }
  }
  return k === Kind.A;
};

export const main = (): void => {
  console.log(f(Kind.B, true));
};
