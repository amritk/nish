// A store through an index TypeScript cannot pin down, `xs[j] = …`, clears no
// narrowing of `xs[0]`, though `j` may be 0.
enum Kind {
  A,
  B,
}

const f = (xs: Kind[], n: i32): boolean => {
  if (xs[0] === Kind.A) {
    return true;
  }
  for (let j = 0; j < n; j++) {
    xs[j] = Kind.A;
  }
  return xs[0] === Kind.A;
};

export const main = (): void => {
  console.log(f([Kind.B], 1));
};
