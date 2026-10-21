// A test against a local of a member type narrows as one against the member:
// past `if (k === a) return`, `k` is not `Kind.A`, and the test after is always false.
enum Kind {
  A,
  B,
  C,
}

const g = (k: Kind): boolean => {
  const a: Kind.A = Kind.A;
  while (true) {
    if (k === a) {
      return true;
    }
    break;
  }
  return k === Kind.A;
};

export const main = (): void => {
  console.log(g(Kind.B));
};
