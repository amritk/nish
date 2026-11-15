// Excluding a member from what is already a complement leaves the members
// neither test excluded, so a third test for an excluded one is refused.
enum Kind {
  A,
  B,
  C,
  D,
  E,
}

const f = (k: Kind): boolean => {
  if (k !== Kind.A) {
    if (k !== Kind.B) {
      return k === Kind.A;
    }
  }
  return false;
};

export const main = (): void => {
  console.log(f(Kind.C));
};
