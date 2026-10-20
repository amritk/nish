// The index keys tsc gives a module constant and a `const` copied from
// another: by the literal the initialiser has, or else by the variable
// itself. Each second test below names another element, so it still compiles.
enum Kind {
  A,
  B,
}

const IDX: i32 = 0;
const ONE: i32 = 1;
const J: i32 = IDX;

// `xs[J]` is keyed by `J` itself: its initialiser is a name, not a literal.
const byIdentity = (xs: Kind[]): boolean => {
  if (xs[IDX] === Kind.A) {
    return true;
  }
  return xs[J] === Kind.A;
};

// `xs[ONE]` is `xs[1]`, another element than `xs[IDX]`.
const byValue = (xs: Kind[]): boolean => {
  if (xs[IDX] === Kind.A) {
    return true;
  }
  return xs[ONE] === Kind.A;
};

// `i` is annotated, so its type is `i32`, not the literal `0`, and `xs[j]`
// is keyed by `j` itself.
const copied = (xs: Kind[]): boolean => {
  const i: i32 = 0;
  const j = i;
  if (xs[i] === Kind.A) {
    return true;
  }
  return xs[j] === Kind.A;
};

export const main = (): void => {
  const xs: Kind[] = [Kind.B, Kind.A];
  console.log(byIdentity(xs));
  console.log(byValue(xs));
  console.log(copied(xs));
};
