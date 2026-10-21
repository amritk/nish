// `const i = 0` makes `xs[i]` the same reference as `xs[0]` to TypeScript,
// annotated or not.
enum Kind {
  A,
  B,
}

const f = (xs: Kind[]): boolean => {
  const i: i32 = 0;
  if (xs[0] === Kind.A) {
    return true;
  }
  return xs[i] === Kind.A;
};

export const main = (): void => {
  console.log(f([Kind.B]));
};
