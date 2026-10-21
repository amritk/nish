// Two `const`s initialised with `-1` key one element, `xs[-1]`, as they do to tsc.
enum Kind {
  A,
  B,
}

const f = (xs: Kind[]): boolean => {
  const a = -1;
  const b = -1;
  if (xs[a] === Kind.A) {
    return true;
  }
  return xs[b] === Kind.A;
};

export const main = (): void => {
  console.log(f([Kind.B]));
};
