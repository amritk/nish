// Two members of one value are one member: excluding `Kind.B` excludes
// `Kind.C`, so testing for `Kind.C` afterwards is refused.
enum Kind {
  A = 0,
  B = 1,
  C = 1,
  D = 2,
}

const f = (k: Kind): boolean => {
  if (k !== Kind.A && k !== Kind.B) {
    return k === Kind.C;
  }
  return false;
};

export const main = (): void => {
  console.log(f(Kind.D));
};
