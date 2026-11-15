// An arm that has excluded every member adds none to a join, so after it the
// variable holds only what the other arm left.
enum Kind {
  A,
  B,
  C,
}

const f = (k: Kind, n: i32): boolean => {
  if (n > 0) {
    if (k === Kind.A || k === Kind.B || k === Kind.C) {
      return true;
    }
  } else if (k !== Kind.A) {
    return true;
  }
  return k === Kind.B;
};

export const main = (): void => {
  console.log(f(Kind.A, 0));
};
