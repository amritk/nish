// A tag read through an index variable that holds one value — a parameter, a
// `const`, a `let` nothing assigns — narrows in TypeScript, as `xs[0]` does.
enum Kind {
  A,
  B,
}

const f = (xs: Kind[], i: i32): boolean => {
  if (xs[i] === Kind.A) {
    return true;
  }
  return xs[i] === Kind.A;
};

export const main = (): void => {
  console.log(f([Kind.B], 0));
};
