// A local assigned in every clause of a `switch` with a `default` holds
// only what the clauses gave it once the `switch` is done.
enum Kind {
  A,
  B,
  C,
}

const f = (k: Kind): boolean => {
  let j: Kind = k;
  switch (j) {
    case Kind.A:
      j = Kind.B;
      break;
    default:
      j = Kind.C;
      break;
  }
  return j === Kind.A;
};

export const main = (): void => {
  console.log(f(Kind.A));
};
