// A module constant initialised with `0` makes `xs[IDX]` the same reference as `xs[0]` to tsc.
enum Kind {
  A,
  B,
}

const IDX: i32 = 0;

const f = (xs: Kind[]): boolean => {
  if (xs[0] === Kind.A) {
    return true;
  }
  return xs[IDX] === Kind.A;
};

export const main = (): void => {
  console.log(f([Kind.B]));
};
