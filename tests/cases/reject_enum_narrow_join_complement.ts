// Arms that leave one member and a complement join to their union: the one
// member both arms exclude is the one a later test cannot meet.
enum Kind {
  A,
  B,
  C,
  D,
}

const f = (k: Kind): boolean => {
  if (k === Kind.A) {
    console.log("a");
  } else if (k !== Kind.B) {
    console.log("not b");
  } else {
    return false;
  }
  return k === Kind.B;
};

export const main = (): void => {
  console.log(f(Kind.C));
};
