// After an unannotated `const i = 0`, `const j = i` has the literal type `0`, so `xs[j]` is `xs[i]` to tsc.
enum Kind {
  A,
  B,
}

const f = (xs: Kind[]): boolean => {
  const i = 0;
  const j = i;
  if (xs[i] === Kind.A) {
    return true;
  }
  return xs[j] === Kind.A;
};

export const main = (): void => {
  console.log(f([Kind.B]));
};
