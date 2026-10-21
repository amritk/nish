// A `let` its block never assigns indexes one element, so `xs[i]` stays
// narrowed in TypeScript; a block declaring another `i` does not change that.
enum Kind {
  A,
  B,
}

const f = (xs: Kind[]): boolean => {
  let i = 0;
  if (xs[i] === Kind.A) {
    return true;
  }
  {
    let i = 1;
    i = 2;
    console.log(i);
  }
  return xs[i] === Kind.A;
};

export const main = (): void => {
  console.log(f([Kind.B]));
};
