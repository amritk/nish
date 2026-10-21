// `const a = -0` keys `xs[a]` as `xs[0]`: tsc names the literal `-0` `"0"`.
enum Kind {
  A,
  B,
}

const f = (xs: Kind[]): boolean => {
  const a = -0;
  if (xs[a] === Kind.A) {
    return true;
  }
  return xs[0] === Kind.A;
};

export const main = (): void => {
  console.log(f([Kind.B]));
};
