// A module constant initialised with a name keys `xs[J]` by the constant itself, as tsc does.
enum Kind {
  A,
  B,
}

const IDX: i32 = 0;
const J: i32 = IDX;

const f = (xs: Kind[]): boolean => {
  if (xs[J] === Kind.A) {
    return true;
  }
  return xs[J] === Kind.A;
};

export const main = (): void => {
  console.log(f([Kind.B]));
};
